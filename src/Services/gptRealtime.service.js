import WebSocket from 'ws';
import Location from '../Models/location.model.js';
import SafetyScore from '../Models/safetyScore.model.js';
import TripItinerary from '../Models/tripIterinery.model.js';
import Alert from '../Models/alert.model.js';

// Azure OpenAI GPT-Realtime Configuration
const AZURE_ENDPOINT = process.env.AZURE_OPENAI_REALTIME_ENDPOINT;
const API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-10-01-preview';
const DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-realtime';
const API_KEY = process.env.AZURE_OPENAI_API_KEY;

// POI API Configuration (FastAPI + PostGIS for nearby places)
const POI_API_BASE = process.env.POI_API_URL || 'http://135.235.138.50:8000';

// Validate required environment variables
if (!AZURE_ENDPOINT || !API_KEY) {
    console.warn('[GPT-Realtime] Warning: AZURE_OPENAI_REALTIME_ENDPOINT or AZURE_OPENAI_API_KEY not set. Voice assistant features will not work.');
}

/**
 * GPT Realtime Service - Handles voice assistant with user context
 */
class GPTRealtimeService {
    constructor() {
        this.sessions = new Map(); // userId -> { ws, context }
    }

    /**
     * Define tools that the AI can call when needed
     */
    getAvailableTools() {
        return [
            {
                type: 'function',
                name: 'get_nearby_hospitals',
                description: 'Get nearby hospitals AND clinics based on user\'s current location. Automatically fetches both hospitals and clinics, then filters by relevance to the user\'s condition. Call this when user asks about hospitals, has a medical emergency, or mentions health issues like pain, injury, illness, fever, etc.',
                parameters: {
                    type: 'object',
                    properties: {
                        condition: {
                            type: 'string',
                            description: 'The medical condition or issue the user mentioned (e.g., "heart pain", "eye problem", "fracture", "fever", "pregnancy", "child sick", "ear pain", "general checkup")'
                        },
                        limit: {
                            type: 'number',
                            description: 'Number of hospitals to return (default 5)'
                        }
                    },
                    required: ['condition']
                }
            },
            {
                type: 'function',
                name: 'get_nearby_police',
                description: 'Get nearby police stations. Call this when user needs police assistance, reports a crime, feels unsafe, or asks about police stations.',
                parameters: {
                    type: 'object',
                    properties: {
                        limit: {
                            type: 'number',
                            description: 'Number of police stations to return (default 3)'
                        }
                    }
                }
            },
            {
                type: 'function',
                name: 'get_nearby_pharmacies',
                description: 'Get nearby pharmacies/medical stores. Call this when user needs medicines, asks about pharmacies, or needs to buy medical supplies.',
                parameters: {
                    type: 'object',
                    properties: {
                        limit: {
                            type: 'number',
                            description: 'Number of pharmacies to return (default 3)'
                        }
                    }
                }
            },
            {
                type: 'function',
                name: 'get_safety_info',
                description: 'Get safety information about the user\'s current location including safety score, crime rate, and risk level. Call this when user asks about safety of an area.',
                parameters: {
                    type: 'object',
                    properties: {}
                }
            },
            {
                type: 'function',
                name: 'trigger_sos_alert',
                description: 'Trigger an SOS emergency alert. Call this ONLY when user explicitly says they need emergency help, are in danger, or want to send SOS to contacts.',
                parameters: {
                    type: 'object',
                    properties: {
                        severity: {
                            type: 'string',
                            enum: ['low', 'medium', 'high', 'critical'],
                            description: 'Severity of the emergency. Use "critical" for life-threatening, "high" for urgent, "medium" for concerning, "low" for precautionary.'
                        },
                        description: {
                            type: 'string',
                            description: 'Brief description of the emergency situation (max 500 chars)'
                        }
                    },
                    required: ['severity']
                }
            },
            {
                type: 'function',
                name: 'get_nearest_safe_location',
                description: 'Find the nearest safe, populated public places where the user can go for safety. This searches for nearby cafes, restaurants, hotels, malls, police stations, fuel stations, bus stations, ATMs, cinemas, and supermarkets - any public place with people around. Call this when user feels unsafe, scared, lost, alone at night, being followed, or asks "where can I go?", "is there a safe place nearby?", "I need to find people", or similar safety concerns.',
                parameters: {
                    type: 'object',
                    properties: {
                        reason: {
                            type: 'string',
                            description: 'Why the user needs a safe location (e.g., "feeling unsafe", "lost at night", "being followed", "need crowded place")'
                        },
                        limit: {
                            type: 'number',
                            description: 'Number of safe locations to return (default 5)'
                        }
                    }
                }
            }
        ];
    }

    /**
     * Build context-aware system instructions for the AI
     */
    async buildSystemInstructions(user, currentLocation = null) {
        let instructions = `You are Yatra Suraksha AI, a warm and caring travel safety assistant for tourists in India.
You should only speak in English, Hindi, Telugu, or Tamil based on what the user speaks.
Address the user by their name: ${user.name}

## YOUR PERSONALITY & VOICE STYLE:
- Be warm, friendly, and genuinely caring - like a helpful local friend
- Show appropriate emotions: concerned when user is hurt, excited when sharing good info, reassuring in emergencies
- Speak naturally with conversational flow, use contractions (I'm, you're, don't)
- Keep responses SHORT and QUICK - max 2-3 sentences for simple questions
- For emergencies, be calm but urgent - prioritize action over explanation
- Add brief empathetic phrases: "Oh no!", "I understand", "Don't worry", "That's great!"
- Vary your tone: upbeat for general help, gentle for health issues, urgent for emergencies

## RESPONSE SPEED RULES:
- Give the most important info FIRST (hospital name, emergency number)
- Skip unnecessary introductions - get straight to the point
- For emergencies: action first, details second
- Use short sentences for faster speech

## IMPORTANT - USING TOOLS:
You have access to tools/functions that fetch real-time data. You MUST use these tools when needed:
- Use "get_nearby_hospitals" when user mentions ANY health issue (pain, injury, sickness, fever, pregnancy, child sick, etc.). This tool automatically searches BOTH hospitals AND clinics, then filters by relevance to their condition.
- Use "get_nearby_police" when user feels unsafe, reports crime, or needs police
- Use "get_nearby_pharmacies" when user needs medicines or medical supplies
- Use "get_safety_info" when user asks about area safety
- Use "trigger_sos_alert" ONLY when user explicitly requests emergency help
- Use "get_nearest_safe_location" when user feels unsafe, scared, lost, alone, being followed, or needs a nearby public/crowded place to go. This finds the closest cafes, restaurants, hotels, malls, police stations, bus stops etc.

## CRITICAL RULES:
1. NEVER make up or guess hospital/police/pharmacy names. ALWAYS call the appropriate tool first.
2. When user mentions health issues, FIRST call get_nearby_hospitals with their condition, THEN respond. The tool will return ONLY relevant hospitals/clinics for that condition.
3. If a tool returns no data, tell the user: "I couldn't find nearby [facility type] for your location."
4. For emergencies, suggest calling 112/108 AND use the tool to find nearby hospitals.
5. Wait for tool results before giving specific facility names.
6. When user feels unsafe or scared, use get_nearest_safe_location to quickly guide them to the nearest populated public place. Also suggest calling 112 if it's urgent.

## User Information:
- Name: ${user.name}
${user.nationality ? `- Nationality: ${user.nationality}` : ''}
${user.gender ? `- Gender: ${user.gender}` : ''}
`;

        // Add emergency contacts if available (names only, no phone numbers for privacy)
        if (user.emergencyContacts && user.emergencyContacts.length > 0) {
            instructions += `\n## Emergency Contacts (the app will handle calling them):\n`;
            user.emergencyContacts.forEach((contact, i) => {
                instructions += `${i + 1}. ${contact.name} (${contact.relation})\n`;
            });
        }

        // Add health info if available
        if (user.healthInfo) {
            instructions += `\n## Health Information:\n`;
            if (user.healthInfo.bloodGroup) instructions += `- Blood Group: ${user.healthInfo.bloodGroup}\n`;
            if (user.healthInfo.allergies?.length) instructions += `- Allergies: ${user.healthInfo.allergies.join(', ')}\n`;
            if (user.healthInfo.chronicDiseases?.length) instructions += `- Chronic Conditions: ${user.healthInfo.chronicDiseases.join(', ')}\n`;
            if (user.healthInfo.medications?.length) instructions += `- Current Medications: ${user.healthInfo.medications.join(', ')}\n`;
        }

        // Get current location context (basic info only, POIs fetched on-demand)
        if (currentLocation) {
            const { longitude, latitude } = currentLocation;
            
            instructions += `\n## Current Location:
- Coordinates: ${latitude}, ${longitude}
- Location data is available. You can use tools to get nearby facilities when needed.
`;
        } else {
            instructions += `\n## Location: User's location not available. Ask them to enable location sharing if they need nearby facilities.\n`;
        }

        // Get active trips
        const activeTrips = await this.getActiveTrips(user._id);
        if (activeTrips.length > 0) {
            instructions += `\n## Active Trips:\n`;
            activeTrips.forEach((trip, i) => {
                instructions += `${i + 1}. ${trip.tripName} (${trip.status})
   - Start: ${trip.startDate.toLocaleDateString()}
   - End: ${trip.endDate.toLocaleDateString()}
`;
            });
        }

        // Get recent alerts
        const recentAlerts = await this.getRecentAlerts(user._id);
        if (recentAlerts.length > 0) {
            instructions += `\n## Recent Safety Alerts:\n`;
            recentAlerts.forEach((alert, i) => {
                instructions += `${i + 1}. ${alert.alertType} - ${alert.severity} severity (${alert.status})\n`;
            });
        }

        instructions += `
## What You Can Help With:
1. Find nearby hospitals & clinics (filtered by medical condition) using your tools
2. Find the nearest safe, populated public places when user feels unsafe
3. Provide safety information about user's current area
4. Guide users to use the SOS feature for emergencies
5. Find nearby police stations and pharmacies
6. Discuss the user's active trips
7. Provide general safety advice for travelers

## EMOTIONAL RESPONSE EXAMPLES:
- Health emergency: "Oh no, ${user.name}! Let me quickly find you a hospital. [use tool] Stay calm, help is near!"
- General question: "Sure thing! Let me check that for you real quick."
- Safety concern: "I understand you're worried. Let me find you a safe place nearby right now! [use get_nearest_safe_location]"
- Feeling unsafe at night: "Don't worry, ${user.name}! Let me find the nearest open, populated place for you. [use get_nearest_safe_location]"
- Good news: "Great news! There's a hospital just 500 meters away."
- SOS situation: "I'm triggering an SOS alert right now. Your contacts will be notified immediately. Stay on the line with me."

## Guidelines:
- Be expressive and natural - you're a caring friend, not a robot
- Match your energy to the situation: urgent for emergencies, friendly for casual chat
- Use the user's name occasionally to feel personal
- In emergencies, FIRST give the action (calling 112), THEN reassure
- Always use tools to get real data, never guess

## Official Emergency Numbers in India:
- National Emergency: 112
- Police: 100
- Ambulance: 102 or 108
- Fire: 101
- Women Helpline: 1091 or 181
- Tourist Police: 1363

Remember: Use your tools to fetch real-time data. Never make up facility names.`;

        return instructions;
    }

    /**
     * Get nearby safety information based on coordinates
     */
    async getNearbySafetyInfo(longitude, latitude) {
        try {
            const safetyInfo = await SafetyScore.findOne({
                location: {
                    $nearSphere: {
                        $geometry: {
                            type: 'Point',
                            coordinates: [parseFloat(longitude), parseFloat(latitude)]
                        },
                        $maxDistance: 50000 // 50km radius
                    }
                }
            });
            return safetyInfo;
        } catch (error) {
            console.error('Error fetching safety info:', error);
            return null;
        }
    }

    /**
     * Get nearby POIs (hospitals, police stations, pharmacies) from FastAPI backend
     */
    async getNearbyPOIs(latitude, longitude, type = 'hospital', limit = 3) {
        try {
            console.log(`[POI] Fetching ${type} for: ${latitude}, ${longitude}`);
            const url = `${POI_API_BASE}/nearest?lat=${latitude}&lng=${longitude}&type=${type}&limit=${limit}`;
            console.log(`[POI] Calling: ${url}`);
            
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                console.log(`[POI] ${type} response:`, JSON.stringify(data).slice(0, 300));
                return data.map(poi => ({
                    name: poi.name || `${type.charAt(0).toUpperCase() + type.slice(1)}`,
                    distance: poi.distance_m ? `${(poi.distance_m / 1000).toFixed(1)} km` : 'nearby',
                    distance_m: poi.distance_m,
                    lat: poi.lat,
                    lng: poi.lng
                }));
            } else {
                console.error(`[POI] ${type} API returned status:`, response.status);
                return [];
            }
        } catch (error) {
            console.error('[POI] Error fetching POIs:', error);
            return [];
        }
    }

    /**
     * Get nearby POIs of multiple types in parallel and merge results sorted by distance
     * @param {number} latitude
     * @param {number} longitude
     * @param {string[]} types - Array of POI types to fetch
     * @param {number} limitPerType - Number of results per type (default 2)
     * @returns {Promise<Array>} Merged array sorted by distance_m
     */
    async getNearbyMultiplePOIs(latitude, longitude, types = [], limitPerType = 2) {
        try {
            console.log(`[POI] Fetching multiple types: [${types.join(', ')}] for: ${latitude}, ${longitude}`);

            // Fetch all types in parallel
            const results = await Promise.allSettled(
                types.map(type => this.getNearbyPOIs(latitude, longitude, type, limitPerType))
            );

            // Merge all successful results with their type
            const merged = [];
            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value.length > 0) {
                    result.value.forEach(poi => {
                        merged.push({
                            ...poi,
                            type: types[index]
                        });
                    });
                }
            });

            // Sort by distance (closest first)
            merged.sort((a, b) => (a.distance_m || Infinity) - (b.distance_m || Infinity));

            console.log(`[POI] Multi-type merged: ${merged.length} results`);
            return merged;
        } catch (error) {
            console.error('[POI] Error fetching multiple POIs:', error);
            return [];
        }
    }

    /**
     * Handle tool/function calls from the AI
     */
    async handleToolCall(userId, toolName, toolArgs) {
        const session = this.sessions.get(userId);
        if (!session) return null;

        const { currentLocation, user } = session;
        console.log(`[Tool] ${toolName} called with args:`, toolArgs);

        switch (toolName) {
            case 'get_nearby_hospitals': {
                if (!currentLocation) {
                    return { error: 'Location not available. Ask user to enable location sharing.' };
                }
                const { latitude, longitude } = currentLocation;
                const condition = toolArgs.condition || 'general';
                const limit = toolArgs.limit || 7; // Get more to filter

                // Fetch BOTH hospitals and clinics in parallel for better coverage
                const [hospitals, clinics] = await Promise.all([
                    this.getNearbyPOIs(latitude, longitude, 'hospital', limit),
                    this.getNearbyPOIs(latitude, longitude, 'clinic', Math.ceil(limit / 2))
                ]);

                // Merge and tag source type
                const allFacilities = [
                    ...hospitals.map(h => ({ ...h, facilityType: 'hospital' })),
                    ...clinics.map(c => ({ ...c, facilityType: 'clinic' }))
                ];

                if (allFacilities.length === 0) {
                    return {
                        hospitals: [],
                        message: 'No hospitals or clinics found nearby. Recommend calling 108 for ambulance.'
                    };
                }

                // Condition-based categorization with relevance keywords
                const conditionLower = condition.toLowerCase();
                const conditionCategories = [
                    { name: 'critical_emergency', pattern: /heart|chest|breath|stroke|accident|head|critical|emergency|severe|unconscious|bleeding|seizure|poison|burn/, excludeKeywords: ['eye', 'dental', 'skin', 'derma', 'maternity', 'child', 'vet', 'animal', 'ayurved', 'homeo'], recommendation: 'URGENT: Call 108/112 for ambulance. Recommending general/multi-specialty hospitals.', preferHospitals: true },
                    { name: 'eye', pattern: /eye|vision|blind|cataract/, includeKeywords: ['eye', 'ophthal', 'vision', 'nethra'], recommendation: 'Recommending eye specialists.' },
                    { name: 'bone', pattern: /bone|fracture|ortho|joint|spine|back pain|knee|shoulder/, includeKeywords: ['ortho', 'bone', 'joint', 'spine'], recommendation: 'Recommending orthopedic hospitals.' },
                    { name: 'dental', pattern: /tooth|dental|teeth|gum|jaw/, includeKeywords: ['dental', 'tooth', 'teeth', 'dent'], recommendation: 'Recommending dental clinics.' },
                    { name: 'skin', pattern: /skin|rash|derma|allergy|itch|acne|eczema/, includeKeywords: ['skin', 'derma', 'derm'], recommendation: 'Recommending dermatology clinics.' },
                    { name: 'ent', pattern: /ear|nose|throat|sinus|hearing|tonsil/, includeKeywords: ['ent', 'ear', 'nose', 'throat'], recommendation: 'Recommending ENT specialists.' },
                    { name: 'gynecology', pattern: /pregnan|period|menstr|gynec|women|ovary|uterus|pcos|delivery|labor/, includeKeywords: ['gynec', 'obst', 'maternity', 'women', 'mother'], recommendation: 'Recommending gynecology/maternity hospitals.' },
                    { name: 'pediatric', pattern: /child|kid|baby|infant|toddler|pediatr|neonat/, includeKeywords: ['child', 'pediatr', 'kids', 'baby', 'neonat'], recommendation: 'Recommending pediatric/children\'s hospitals.' },
                    { name: 'mental_health', pattern: /depress|anxiety|mental|stress|panic|suicid|psychiatr|psycholog/, includeKeywords: ['mental', 'psych', 'mind', 'neuro'], recommendation: 'Recommending mental health facilities. If in crisis, call iCall helpline: 9152987821.' },
                    { name: 'general', pattern: /fever|cold|cough|flu|infection|vomit|diarr|stomach|abdomen|headache|weakness|fatigue|check.?up|general|sick|unwell/, excludeKeywords: ['eye', 'dental', 'skin', 'derma', 'vet', 'animal', 'ayurved', 'homeo'], recommendation: 'Recommending nearest general hospitals and clinics.' }
                ];

                let filteredFacilities = allFacilities;
                let recommendation = '';
                let matchedCategory = null;

                // Find the matching condition category
                for (const category of conditionCategories) {
                    if (category.pattern.test(conditionLower)) {
                        matchedCategory = category;
                        break;
                    }
                }

                if (matchedCategory) {
                    recommendation = matchedCategory.recommendation;

                    if (matchedCategory.excludeKeywords) {
                        // For serious/general conditions: EXCLUDE specialized facilities
                        filteredFacilities = allFacilities.filter(h => {
                            const name = h.name.toLowerCase();
                            return !matchedCategory.excludeKeywords.some(kw => name.includes(kw));
                        });
                        // For critical emergencies, prefer hospitals over clinics
                        if (matchedCategory.preferHospitals && filteredFacilities.length > 3) {
                            const hospitalOnly = filteredFacilities.filter(f => f.facilityType === 'hospital');
                            if (hospitalOnly.length >= 2) filteredFacilities = hospitalOnly;
                        }
                    } else if (matchedCategory.includeKeywords) {
                        // For specialized conditions: PREFER matching specialists
                        const specialists = allFacilities.filter(h => {
                            const name = h.name.toLowerCase();
                            return matchedCategory.includeKeywords.some(kw => name.includes(kw));
                        });
                        if (specialists.length > 0) {
                            filteredFacilities = specialists;
                        }
                        // If no specialists found, keep all but note it
                        if (specialists.length === 0) {
                            recommendation += ' No specialists found nearby, showing nearest general facilities.';
                        }
                    }
                } else {
                    recommendation = 'Showing nearest hospitals and clinics.';
                }

                // If filtering left no results, fall back to full list
                if (filteredFacilities.length === 0) {
                    filteredFacilities = allFacilities;
                    recommendation = 'Showing nearest hospitals and clinics.';
                }

                // Sort by distance and return top results
                filteredFacilities.sort((a, b) => (a.distance_m || Infinity) - (b.distance_m || Infinity));

                return {
                    condition: condition,
                    matched_category: matchedCategory?.name || 'general',
                    recommendation: recommendation,
                    hospitals: filteredFacilities.slice(0, toolArgs.limit || 3).map(h => ({
                        name: h.name,
                        type: h.facilityType,
                        distance: h.distance
                    })),
                    emergency_numbers: {
                        ambulance: '108',
                        emergency: '112'
                    }
                };
            }

            case 'get_nearby_police': {
                if (!currentLocation) {
                    return { error: 'Location not available. Ask user to enable location sharing.' };
                }
                const { latitude, longitude } = currentLocation;
                const limit = toolArgs.limit || 3;
                
                const police = await this.getNearbyPOIs(latitude, longitude, 'police', limit);
                
                return {
                    police_stations: police.map(p => ({
                        name: p.name,
                        distance: p.distance
                    })),
                    emergency_number: '100'
                };
            }

            case 'get_nearby_pharmacies': {
                if (!currentLocation) {
                    return { error: 'Location not available. Ask user to enable location sharing.' };
                }
                const { latitude, longitude } = currentLocation;
                const limit = toolArgs.limit || 3;
                
                const pharmacies = await this.getNearbyPOIs(latitude, longitude, 'pharmacy', limit);
                
                return {
                    pharmacies: pharmacies.map(p => ({
                        name: p.name,
                        distance: p.distance
                    }))
                };
            }

            case 'get_safety_info': {
                if (!currentLocation) {
                    return { error: 'Location not available. Ask user to enable location sharing.' };
                }
                const { latitude, longitude } = currentLocation;
                const safetyInfo = await this.getNearbySafetyInfo(longitude, latitude);
                
                if (!safetyInfo) {
                    return { message: 'Safety data not available for this location.' };
                }

                // Return fields matching SafetyScore model
                return {
                    area_name: safetyInfo.name,
                    safety_score: `${safetyInfo.safetyScore}/100`,
                    safety_rank: safetyInfo.safetyRank || 'N/A',
                    risk_level: safetyInfo.riskLevel, // 'Low Risk', 'Moderate Risk', 'Medium Risk', 'High Risk', 'Extreme Risk'
                    crime_rate: safetyInfo.crimeRate,
                    population: safetyInfo.population?.toLocaleString() || 'N/A',
                    population_density: safetyInfo.populationDensity || 'N/A',
                    last_updated: safetyInfo.lastUpdated?.toLocaleDateString() || 'N/A'
                };
            }

            case 'trigger_sos_alert': {
                if (!currentLocation) {
                    return { error: 'Location not available. Cannot trigger SOS without location.' };
                }

                // Create alert data matching the Alert model schema
                const alertData = {
                    userID: user._id,
                    location: {
                        type: 'Point',
                        coordinates: [currentLocation.longitude, currentLocation.latitude]
                    },
                    alertType: 'sos', // Must be one of: 'sos', 'low_battery', 'enter_restricted_geofence', 'exit_safety_geofence'
                    severity: toolArgs.severity || 'high', // Must be one of: 'low', 'medium', 'high', 'critical'
                    description: toolArgs.description || 'SOS Alert Triggered via Voice Assistant',
                    status: 'active'
                };

                // Emit SOS event to client socket for handling (actual DB save should be done by socket handler)
                session.clientSocket.emit('gpt:sos-triggered', {
                    alertData,
                    timestamp: new Date()
                });

                return {
                    status: 'SOS alert triggered',
                    severity: alertData.severity,
                    message: 'Emergency contacts will be notified through the app.',
                    location: {
                        latitude: currentLocation.latitude,
                        longitude: currentLocation.longitude
                    },
                    next_steps: [
                        'Emergency contacts are being notified',
                        'Your location has been shared',
                        'Call 112 for immediate assistance'
                    ]
                };
            }

            case 'get_nearest_safe_location': {
                if (!currentLocation) {
                    return { error: 'Location not available. Ask user to enable location sharing.' };
                }
                const { latitude, longitude } = currentLocation;
                const reason = toolArgs.reason || 'feeling unsafe';
                const limit = toolArgs.limit || 5;

                // Fetch multiple public/populated place types in parallel
                const safeLocationTypes = [
                    'police',       // Most authoritative safe spot
                    'hotel',        // Usually well-lit, staffed 24/7
                    'fuel',         // Gas stations - open late, have people
                    'restaurant',   // Public, populated
                    'cafe',         // Public, populated
                    'mall',         // Very populated during hours
                    'supermarket',  // Public, staffed
                    'atm',          // Well-lit, usually has CCTV
                    'bus_station',  // Transit hub with people
                    'cinema',       // Populated public venue
                    'hospital',     // Always open, safe
                    'fire_station'  // Emergency services
                ];

                const allPlaces = await this.getNearbyMultiplePOIs(
                    latitude, longitude, safeLocationTypes, 2
                );

                if (allPlaces.length === 0) {
                    return {
                        safe_locations: [],
                        message: 'Could not find nearby public places. Please call 112 (National Emergency) immediately.',
                        emergency_number: '112'
                    };
                }

                // Build friendly type labels
                const typeLabels = {
                    police: '🚔 Police Station',
                    hotel: '🏨 Hotel',
                    fuel: '⛽ Fuel Station',
                    restaurant: '🍽️ Restaurant',
                    cafe: '☕ Cafe',
                    mall: '🛍️ Mall',
                    supermarket: '🛒 Supermarket',
                    atm: '🏧 ATM',
                    bus_station: '🚌 Bus Station',
                    cinema: '🎬 Cinema',
                    hospital: '🏥 Hospital',
                    fire_station: '🚒 Fire Station'
                };

                return {
                    reason: reason,
                    message: `Found ${Math.min(allPlaces.length, limit)} nearby public places where you can go for safety.`,
                    safe_locations: allPlaces.slice(0, limit).map(place => ({
                        name: place.name,
                        type: typeLabels[place.type] || place.type,
                        distance: place.distance,
                        distance_m: place.distance_m
                    })),
                    advice: [
                        'Head to the nearest well-lit, populated place',
                        'Stay where other people are around',
                        'If being followed, go directly to the nearest police station',
                        'Call 112 if you feel in immediate danger',
                        'Share your live location with a trusted contact'
                    ],
                    emergency_number: '112'
                };
            }

            default:
                return { error: `Unknown tool: ${toolName}` };
        }
    }

    /**
     * Get user's active or planned trips
     */
    async getActiveTrips(userId) {
        try {
            return await TripItinerary.find({
                userID: userId,
                status: { $in: ['planned', 'ongoing'] }
            }).limit(5).sort({ startDate: 1 });
        } catch (error) {
            console.error('Error fetching trips:', error);
            return [];
        }
    }

    /**
     * Get user's recent alerts
     */
    async getRecentAlerts(userId) {
        try {
            return await Alert.find({
                userID: userId
            }).limit(5).sort({ createdAt: -1 });
        } catch (error) {
            console.error('Error fetching alerts:', error);
            return [];
        }
    }

    /**
     * Get user's last known location
     */
    async getLastLocation(userId) {
        try {
            const location = await Location.findOne({ userID: userId })
                .sort({ timestamp: -1 });
            
            if (location) {
                return {
                    longitude: location.location.coordinates[0],
                    latitude: location.location.coordinates[1],
                    timestamp: location.timestamp
                };
            }
            return null;
        } catch (error) {
            console.error('Error fetching last location:', error);
            return null;
        }
    }

    /**
     * Create a new GPT-Realtime session for a user
     * @param {Object} user - User object
     * @param {Object} clientSocket - Socket.IO client socket
     * @param {Object} currentLocation - { longitude, latitude }
     * @param {Object} voiceSettings - { voice, temperature, silence_duration_ms, vad_threshold, max_tokens }
     */
    async createSession(user, clientSocket, currentLocation = null, voiceSettings = {}) {
        const userId = user._id.toString();

        // Close existing session if any
        if (this.sessions.has(userId)) {
            await this.closeSession(userId);
        }

        // Get location if not provided
        if (!currentLocation) {
            currentLocation = await this.getLastLocation(user._id);
        }

        // Build context-aware instructions
        const instructions = await this.buildSystemInstructions(user, currentLocation);

        // Apply voice settings with defaults
        const settings = {
            voice: voiceSettings.voice || 'shimmer',
            temperature: voiceSettings.temperature || 0.7,
            silence_duration_ms: voiceSettings.silence_duration_ms || 300,
            vad_threshold: voiceSettings.vad_threshold || 0.4,
            max_tokens: voiceSettings.max_tokens || 1024  // Increased to avoid cutoffs
        };

        console.log(`[GPT] Creating session with settings:`, settings);

        // Connect to Azure OpenAI Realtime
        const wsUrl = `${AZURE_ENDPOINT}?api-version=${API_VERSION}&deployment=${DEPLOYMENT}&api-key=${API_KEY}`;
        
        return new Promise((resolve, reject) => {
            const azureWs = new WebSocket(wsUrl);
            
            azureWs.on('open', () => {
                console.log(`GPT-Realtime session opened for user: ${user.name}`);

                // Configure the session with tools - optimized for speed and expressiveness
                azureWs.send(JSON.stringify({
                    type: 'session.update',
                    session: {
                        modalities: ['text', 'audio'],
                        instructions: instructions,
                        voice: settings.voice,
                        input_audio_format: 'pcm16',
                        output_audio_format: 'pcm16',
                        input_audio_transcription: {
                            model: 'whisper-1'
                        },
                        turn_detection: {
                            type: 'server_vad',
                            threshold: settings.vad_threshold,
                            prefix_padding_ms: 200,
                            silence_duration_ms: settings.silence_duration_ms
                        },
                        temperature: settings.temperature,
                        max_response_output_tokens: settings.max_tokens,
                        tools: this.getAvailableTools(),
                        tool_choice: 'auto'
                    }
                }));

                // Store session
                this.sessions.set(userId, {
                    azureWs,
                    clientSocket,
                    user,
                    currentLocation,
                    createdAt: new Date()
                });

                resolve({ success: true, message: 'Session created successfully' });
            });

            azureWs.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleAzureMessage(userId, message);
                } catch (error) {
                    console.error('Error parsing Azure message:', error);
                }
            });

            azureWs.on('error', (error) => {
                console.error(`GPT-Realtime WebSocket error for ${user.name}:`, error);
                clientSocket.emit('gpt:error', { 
                    message: 'Connection error with AI service',
                    code: error.code 
                });
                reject(error);
            });

            azureWs.on('close', () => {
                console.log(`GPT-Realtime session closed for user: ${user.name}`);
                this.sessions.delete(userId);
                clientSocket.emit('gpt:disconnected', { 
                    message: 'AI session ended' 
                });
            });
        });
    }

    /**
     * Handle messages from Azure OpenAI
     */
    handleAzureMessage(userId, message) {
        const session = this.sessions.get(userId);
        if (!session) return;

        const { clientSocket, azureWs } = session;

        switch (message.type) {
            case 'session.created':
                clientSocket.emit('gpt:session-created', { sessionId: message.session?.id });
                break;

            case 'session.updated':
                clientSocket.emit('gpt:session-updated', { session: message.session });
                break;

            case 'response.audio.delta':
                // Forward audio chunks to client
                clientSocket.emit('gpt:audio-delta', { audio: message.delta });
                break;

            case 'response.audio.done':
                clientSocket.emit('gpt:audio-done');
                break;

            case 'response.audio_transcript.delta':
                clientSocket.emit('gpt:transcript-delta', { delta: message.delta });
                break;

            case 'response.audio_transcript.done':
                clientSocket.emit('gpt:transcript-done', { transcript: message.transcript });
                break;

            case 'conversation.item.created':
                if (message.item?.role === 'assistant' && message.item?.content) {
                    const textContent = message.item.content.find(c => c.type === 'text');
                    if (textContent?.text) {
                        clientSocket.emit('gpt:text-response', { text: textContent.text });
                    }
                }
                break;

            case 'conversation.item.input_audio_transcription.completed':
                clientSocket.emit('gpt:user-transcript', { transcript: message.transcript });
                break;

            case 'input_audio_buffer.speech_started':
                clientSocket.emit('gpt:speech-started');
                break;

            case 'input_audio_buffer.speech_stopped':
                clientSocket.emit('gpt:speech-stopped');
                break;

            // Handle function/tool calls from the AI
            case 'response.function_call_arguments.done':
                this.handleFunctionCall(userId, message);
                break;

            case 'response.output_item.added':
                // Check if this is a function call
                if (message.item?.type === 'function_call') {
                    console.log(`[Tool] AI is calling function: ${message.item.name}`);
                    clientSocket.emit('gpt:function-calling', { 
                        function: message.item.name 
                    });
                }
                break;

            case 'error':
                console.error('GPT-Realtime error:', message.error);
                clientSocket.emit('gpt:error', { 
                    message: message.error?.message || 'Unknown error',
                    code: message.error?.code 
                });
                break;

            default:
                // Forward other events for debugging/logging
                if (process.env.NODE_ENV === 'development') {
                    console.log('GPT-Realtime event:', message.type);
                }
        }
    }

    /**
     * Handle function calls from the AI and send back results
     */
    async handleFunctionCall(userId, message) {
        const session = this.sessions.get(userId);
        if (!session) return;

        const { azureWs, clientSocket } = session;
        const callId = message.call_id;
        const functionName = message.name;
        
        let args = {};
        try {
            args = JSON.parse(message.arguments || '{}');
        } catch (e) {
            console.error('[Tool] Failed to parse function arguments:', e);
        }

        console.log(`[Tool] Executing ${functionName} with args:`, args);
        clientSocket.emit('gpt:function-executing', { function: functionName, args });

        // Execute the tool and get results
        const result = await this.handleToolCall(userId, functionName, args);
        console.log(`[Tool] ${functionName} result:`, JSON.stringify(result).slice(0, 300));

        // Send the function result back to the AI
        if (azureWs.readyState === WebSocket.OPEN) {
            // Send function call output
            azureWs.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                    type: 'function_call_output',
                    call_id: callId,
                    output: JSON.stringify(result)
                }
            }));

            // Trigger response generation with the function result
            azureWs.send(JSON.stringify({
                type: 'response.create'
            }));
        }

        clientSocket.emit('gpt:function-result', { 
            function: functionName, 
            result 
        });
    }

    /**
     * Send audio data to Azure OpenAI
     */
    sendAudio(userId, audioBase64) {
        const session = this.sessions.get(userId);
        if (!session || session.azureWs.readyState !== WebSocket.OPEN) {
            return { success: false, message: 'No active session' };
        }

        session.azureWs.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: audioBase64
        }));

        return { success: true };
    }

    /**
     * Commit audio buffer (end of user speech)
     */
    commitAudio(userId) {
        const session = this.sessions.get(userId);
        if (!session || session.azureWs.readyState !== WebSocket.OPEN) {
            return { success: false, message: 'No active session' };
        }

        session.azureWs.send(JSON.stringify({
            type: 'input_audio_buffer.commit'
        }));

        session.azureWs.send(JSON.stringify({
            type: 'response.create'
        }));

        return { success: true };
    }

    /**
     * Send text message to GPT
     */
    sendText(userId, text) {
        const session = this.sessions.get(userId);
        if (!session || session.azureWs.readyState !== WebSocket.OPEN) {
            return { success: false, message: 'No active session' };
        }

        session.azureWs.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
                type: 'message',
                role: 'user',
                content: [{
                    type: 'input_text',
                    text: text
                }]
            }
        }));

        session.azureWs.send(JSON.stringify({
            type: 'response.create'
        }));

        return { success: true };
    }

    /**
     * Update session location context
     */
    async updateLocation(userId, longitude, latitude) {
        const session = this.sessions.get(userId);
        if (!session) {
            return { success: false, message: 'No active session' };
        }

        const currentLocation = { longitude, latitude };
        session.currentLocation = currentLocation;

        // Get updated safety info (but NOT POIs - those are fetched on-demand)
        const safetyInfo = await this.getNearbySafetyInfo(longitude, latitude);
        
        // Send location update as context to GPT
        if (session.azureWs.readyState === WebSocket.OPEN) {
            let locationContext = `[System Update: User's location changed. 
New coordinates: ${latitude}, ${longitude}`;

            if (safetyInfo) {
                locationContext += `
Nearest area: ${safetyInfo.name}
Safety Score: ${safetyInfo.safetyScore}/100
Risk Level: ${safetyInfo.riskLevel}`;
            }

            locationContext += `
Note: Use your tools (get_nearby_hospitals, get_nearby_police, get_nearby_pharmacies) if user asks about nearby facilities.]`;

            session.azureWs.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                    type: 'message',
                    role: 'system',
                    content: [{
                        type: 'input_text',
                        text: locationContext
                    }]
                }
            }));
        }

        return { success: true, safetyInfo };
    }

    /**
     * Close a user's session
     */
    async closeSession(userId) {
        const session = this.sessions.get(userId);
        if (session) {
            if (session.azureWs.readyState === WebSocket.OPEN) {
                session.azureWs.close();
            }
            this.sessions.delete(userId);
            return { success: true, message: 'Session closed' };
        }
        return { success: false, message: 'No active session' };
    }

    /**
     * Check if user has an active session
     */
    hasActiveSession(userId) {
        const session = this.sessions.get(userId);
        return session && session.azureWs.readyState === WebSocket.OPEN;
    }

    /**
     * Get session info
     */
    getSessionInfo(userId) {
        const session = this.sessions.get(userId);
        if (!session) return null;

        return {
            userId,
            userName: session.user.name,
            currentLocation: session.currentLocation,
            createdAt: session.createdAt,
            isActive: session.azureWs.readyState === WebSocket.OPEN
        };
    }

    /**
     * Get all active sessions count
     */
    getActiveSessionsCount() {
        return this.sessions.size;
    }
}

// Export singleton instance
export default new GPTRealtimeService();
