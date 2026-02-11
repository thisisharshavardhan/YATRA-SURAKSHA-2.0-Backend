import WebSocket from 'ws';
import Location from '../Models/location.model.js';
import SafetyScore from '../Models/safetyScore.model.js';
import TripItinerary from '../Models/tripIterinery.model.js';
import Alert from '../Models/alert.model.js';

// Gemini Live API Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-preview-native-audio-dialog';
const GEMINI_WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`;

// POI API Configuration (FastAPI + PostGIS for nearby places)
const POI_API_BASE = process.env.POI_API_URL || 'http://135.235.138.50:8000';

// Validate required environment variables
if (!GEMINI_API_KEY) {
    console.warn('[Gemini-Realtime] Warning: GEMINI_API_KEY not set. Gemini voice assistant features will not work.');
}

/**
 * Gemini Realtime Service - Handles voice assistant with user context
 * Uses Gemini 2.5 Flash Native Audio Dialog via WebSocket (Live API)
 */
class GeminiRealtimeService {
    constructor() {
        this.sessions = new Map(); // userId -> { geminiWs, clientSocket, user, currentLocation, ... }
    }

    /**
     * Define tools that the AI can call when needed
     * Format: Gemini function_declarations
     */
    getAvailableTools() {
        return [
            {
                function_declarations: [
                    {
                        name: 'get_nearby_hospitals',
                        description: 'Get nearby hospitals AND clinics based on user\'s current location. Automatically fetches both hospitals and clinics, then filters by relevance to the user\'s condition. Call this when user asks about hospitals, has a medical emergency, or mentions health issues like pain, injury, illness, fever, etc.',
                        parameters: {
                            type: 'OBJECT',
                            properties: {
                                condition: {
                                    type: 'STRING',
                                    description: 'The medical condition or issue the user mentioned (e.g., "heart pain", "eye problem", "fracture", "fever", "pregnancy", "child sick", "ear pain", "general checkup")'
                                },
                                limit: {
                                    type: 'NUMBER',
                                    description: 'Number of hospitals to return (default 5)'
                                }
                            },
                            required: ['condition']
                        }
                    },
                    {
                        name: 'get_nearby_police',
                        description: 'Get nearby police stations. Call this when user needs police assistance, reports a crime, feels unsafe, or asks about police stations.',
                        parameters: {
                            type: 'OBJECT',
                            properties: {
                                limit: {
                                    type: 'NUMBER',
                                    description: 'Number of police stations to return (default 3)'
                                }
                            }
                        }
                    },
                    {
                        name: 'get_nearby_pharmacies',
                        description: 'Get nearby pharmacies/medical stores. Call this when user needs medicines, asks about pharmacies, or needs to buy medical supplies.',
                        parameters: {
                            type: 'OBJECT',
                            properties: {
                                limit: {
                                    type: 'NUMBER',
                                    description: 'Number of pharmacies to return (default 3)'
                                }
                            }
                        }
                    },
                    {
                        name: 'get_safety_info',
                        description: 'Get safety information about the user\'s current location including safety score, crime rate, and risk level. Call this when user asks about safety of an area.',
                        parameters: {
                            type: 'OBJECT',
                            properties: {}
                        }
                    },
                    {
                        name: 'trigger_sos_alert',
                        description: 'Trigger an SOS emergency alert. Call this ONLY when user explicitly says they need emergency help, are in danger, or want to send SOS to contacts.',
                        parameters: {
                            type: 'OBJECT',
                            properties: {
                                severity: {
                                    type: 'STRING',
                                    enum: ['low', 'medium', 'high', 'critical'],
                                    description: 'Severity of the emergency. Use "critical" for life-threatening, "high" for urgent, "medium" for concerning, "low" for precautionary.'
                                },
                                description: {
                                    type: 'STRING',
                                    description: 'Brief description of the emergency situation (max 500 chars)'
                                }
                            },
                            required: ['severity']
                        }
                    },
                    {
                        name: 'get_nearest_safe_location',
                        description: 'Find the nearest safe, populated public places where the user can go for safety. This searches for nearby cafes, restaurants, hotels, malls, police stations, fuel stations, bus stations, ATMs, cinemas, and supermarkets - any public place with people around. Call this when user feels unsafe, scared, lost, alone at night, being followed, or asks "where can I go?", "is there a safe place nearby?", "I need to find people", or similar safety concerns.',
                        parameters: {
                            type: 'OBJECT',
                            properties: {
                                reason: {
                                    type: 'STRING',
                                    description: 'Why the user needs a safe location (e.g., "feeling unsafe", "lost at night", "being followed", "need crowded place")'
                                },
                                limit: {
                                    type: 'NUMBER',
                                    description: 'Number of safe locations to return (default 5)'
                                }
                            }
                        }
                    }
                ]
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

        // Get current location context
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
            console.log(`[POI-Gemini] Fetching ${type} for: ${latitude}, ${longitude}`);
            const url = `${POI_API_BASE}/nearest?lat=${latitude}&lng=${longitude}&type=${type}&limit=${limit}`;
            console.log(`[POI-Gemini] Calling: ${url}`);

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                console.log(`[POI-Gemini] ${type} response:`, JSON.stringify(data).slice(0, 300));
                return data.map(poi => ({
                    name: poi.name || `${type.charAt(0).toUpperCase() + type.slice(1)}`,
                    distance: poi.distance_m ? `${(poi.distance_m / 1000).toFixed(1)} km` : 'nearby',
                    distance_m: poi.distance_m,
                    lat: poi.lat,
                    lng: poi.lng
                }));
            } else {
                console.error(`[POI-Gemini] ${type} API returned status:`, response.status);
                return [];
            }
        } catch (error) {
            console.error('[POI-Gemini] Error fetching POIs:', error);
            return [];
        }
    }

    /**
     * Get nearby POIs of multiple types in parallel and merge results sorted by distance
     */
    async getNearbyMultiplePOIs(latitude, longitude, types = [], limitPerType = 2) {
        try {
            console.log(`[POI-Gemini] Fetching multiple types: [${types.join(', ')}] for: ${latitude}, ${longitude}`);

            const results = await Promise.allSettled(
                types.map(type => this.getNearbyPOIs(latitude, longitude, type, limitPerType))
            );

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

            merged.sort((a, b) => (a.distance_m || Infinity) - (b.distance_m || Infinity));

            console.log(`[POI-Gemini] Multi-type merged: ${merged.length} results`);
            return merged;
        } catch (error) {
            console.error('[POI-Gemini] Error fetching multiple POIs:', error);
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
        console.log(`[Gemini-Tool] ${toolName} called with args:`, toolArgs);

        switch (toolName) {
            case 'get_nearby_hospitals': {
                if (!currentLocation) {
                    return { error: 'Location not available. Ask user to enable location sharing.' };
                }
                const { latitude, longitude } = currentLocation;
                const condition = toolArgs.condition || 'general';
                const limit = toolArgs.limit || 7;

                const [hospitals, clinics] = await Promise.all([
                    this.getNearbyPOIs(latitude, longitude, 'hospital', limit),
                    this.getNearbyPOIs(latitude, longitude, 'clinic', Math.ceil(limit / 2))
                ]);

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

                for (const category of conditionCategories) {
                    if (category.pattern.test(conditionLower)) {
                        matchedCategory = category;
                        break;
                    }
                }

                if (matchedCategory) {
                    recommendation = matchedCategory.recommendation;

                    if (matchedCategory.excludeKeywords) {
                        filteredFacilities = allFacilities.filter(h => {
                            const name = h.name.toLowerCase();
                            return !matchedCategory.excludeKeywords.some(kw => name.includes(kw));
                        });
                        if (matchedCategory.preferHospitals && filteredFacilities.length > 3) {
                            const hospitalOnly = filteredFacilities.filter(f => f.facilityType === 'hospital');
                            if (hospitalOnly.length >= 2) filteredFacilities = hospitalOnly;
                        }
                    } else if (matchedCategory.includeKeywords) {
                        const specialists = allFacilities.filter(h => {
                            const name = h.name.toLowerCase();
                            return matchedCategory.includeKeywords.some(kw => name.includes(kw));
                        });
                        if (specialists.length > 0) {
                            filteredFacilities = specialists;
                        }
                        if (specialists.length === 0) {
                            recommendation += ' No specialists found nearby, showing nearest general facilities.';
                        }
                    }
                } else {
                    recommendation = 'Showing nearest hospitals and clinics.';
                }

                if (filteredFacilities.length === 0) {
                    filteredFacilities = allFacilities;
                    recommendation = 'Showing nearest hospitals and clinics.';
                }

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
                return {
                    area_name: safetyInfo.name,
                    safety_score: `${safetyInfo.safetyScore}/100`,
                    safety_rank: safetyInfo.safetyRank || 'N/A',
                    risk_level: safetyInfo.riskLevel,
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
                const alertData = {
                    userID: user._id,
                    location: {
                        type: 'Point',
                        coordinates: [currentLocation.longitude, currentLocation.latitude]
                    },
                    alertType: 'sos',
                    severity: toolArgs.severity || 'high',
                    description: toolArgs.description || 'SOS Alert Triggered via Gemini Voice Assistant',
                    status: 'active'
                };
                session.clientSocket.emit('gemini:sos-triggered', {
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
                const safeLocationTypes = [
                    'police', 'hotel', 'fuel', 'restaurant', 'cafe',
                    'mall', 'supermarket', 'atm', 'bus_station', 'cinema',
                    'hospital', 'fire_station'
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
                const typeLabels = {
                    police: '🚔 Police Station', hotel: '🏨 Hotel', fuel: '⛽ Fuel Station',
                    restaurant: '🍽️ Restaurant', cafe: '☕ Cafe', mall: '🛍️ Mall',
                    supermarket: '🛒 Supermarket', atm: '🏧 ATM', bus_station: '🚌 Bus Station',
                    cinema: '🎬 Cinema', hospital: '🏥 Hospital', fire_station: '🚒 Fire Station'
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
     * Create a new Gemini Live session for a user via WebSocket
     * Uses the Gemini Live API (BidiGenerateContent) over WebSocket
     */
    async createSession(user, socket, currentLocation = null, voiceSettings = {}) {
        try {
            // Close existing session if any
            if (this.sessions.has(user._id.toString())) {
                await this.closeSession(user._id.toString());
            }

            const userId = user._id.toString();
            console.log(`[Gemini] Creating session for user: ${userId}`);

            if (!GEMINI_API_KEY) {
                throw new Error('GEMINI_API_KEY not found in environment variables');
            }

            // Get location if not provided
            if (!currentLocation) {
                currentLocation = await this.getLastLocation(userId);
            }

            // Build system instructions
            const systemInstructions = await this.buildSystemInstructions(user, currentLocation);

            // Build the WebSocket URL with API key and model
            const wsUrl = `${GEMINI_WS_URL}?key=${GEMINI_API_KEY}`;
            console.log(`[Gemini] Connecting to Gemini Live API with model: ${GEMINI_MODEL}`);

            const modelName = GEMINI_MODEL.startsWith('models/') ? GEMINI_MODEL : `models/${GEMINI_MODEL}`;
console.log(`[Gemini] Using model: ${modelName}`);

            return new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error('Gemini WebSocket connection timed out after 15s'));
                }, 15000);

                const geminiWs = new WebSocket(wsUrl);

                geminiWs.on('open', () => {
                    console.log(`[Gemini] WebSocket connected, sending setup for model: ${modelName}`);

                    // Build generation config based on model type
                    const isNativeAudioDialog = modelName.includes('native-audio-dialog');
                    
                    const generationConfig = isNativeAudioDialog
                        ? {
                            // Native audio dialog model handles voice natively
                            // No speechConfig needed — it has its own built-in voice
                            responseModalities: ['AUDIO'],
                        }
                        : {
                            responseModalities: ['AUDIO'],
                            speechConfig: {
                                voiceConfig: {
                                    prebuiltVoiceConfig: {
                                        voiceName: voiceSettings.voice || 'Aoede'
                                    }
                                }
                            }
                        };

                    // Send the setup message (required as first message)
                    const setupMessage = {
                        setup: {
                            model: modelName,
                            generationConfig: generationConfig,
                            systemInstruction: {
                                parts: [{ text: systemInstructions }]
                            },
                            tools: this.getAvailableTools()
                        }
                    };

                    geminiWs.send(JSON.stringify(setupMessage));
                    console.log('[Gemini] Setup message sent:', JSON.stringify({ model: modelName, isNativeAudioDialog }).slice(0, 300));
                });

                geminiWs.on('message', (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        if (process.env.NODE_ENV === 'development') {
                            console.log('[Gemini] Raw message:', JSON.stringify(message).slice(0, 1000));
                        }

                        // If server returned an explicit error object
                        if (message.error) {
                            clearTimeout(timeoutId);
                            const errMsg = message.error?.message || JSON.stringify(message.error);
                            console.error('[Gemini] Setup error received:', errMsg);
                            socket.emit('gemini:error', {
                                message: `Gemini setup error: ${errMsg}`,
                                code: 'SETUP_ERROR',
                                raw: message.error
                            });
                            // Close with policy violation to ensure cleanup
                            geminiWs.close(1008, errMsg);
                            reject(new Error(errMsg));
                            return;
                        }

                        // Some responses use status codes
                        if (message.status && typeof message.status.code !== 'undefined' && message.status.code !== 0) {
                            clearTimeout(timeoutId);
                            const statusMsg = message.status?.message || `Code ${message.status.code}`;
                            console.error('[Gemini] Setup status error:', statusMsg);
                            socket.emit('gemini:error', {
                                message: `Gemini setup status error: ${statusMsg}`,
                                code: message.status.code,
                                raw: message.status
                            });
                            geminiWs.close(1008, statusMsg);
                            reject(new Error(statusMsg));
                            return;
                        }

                        // Handle setupComplete
                        if (message.setupComplete !== undefined) {
                            clearTimeout(timeoutId);
                            console.log(`[Gemini] Session setup complete for user: ${user.name}`);
                            this.sessions.set(userId, {
                                geminiWs: geminiWs,
                                clientSocket: socket,
                                user: user,
                                currentLocation: currentLocation,
                                pendingToolCalls: new Map(),
                                createdAt: new Date()
                            });
                            socket.emit('gemini:session-created', { sessionId: userId });
                            resolve({
                                success: true,
                                sessionId: userId,
                                message: 'Gemini session created successfully'
                            });
                            return;
                        }

                        // Otherwise pass to normal handler
                        this.handleGeminiMessage(userId, message);
                    } catch (error) {
                        console.error('[Gemini] Error parsing message:', error);
                    }
                });

                geminiWs.on('error', (error) => {
                    clearTimeout(timeoutId);
                    console.error('[Gemini] WebSocket error:', error.message);
                    socket.emit('gemini:error', {
                        message: `Gemini connection error: ${error.message}`,
                        code: 'WS_ERROR'
                    });
                    reject(error);
                });

                geminiWs.on('close', (code, reason) => {
                    clearTimeout(timeoutId);
                    let reasonStr = '';
                    try {
                        reasonStr = reason ? reason.toString() : '';
                    } catch (e) {
                        reasonStr = String(reason);
                    }
                    console.log(`[Gemini] WebSocket closed: code=${code} reason=${reasonStr}`);

                    if (code === 1008) {
                        // Policy error (likely invalid API key/model or malformed setup) — surface to client
                        const helpful = 'Gemini rejected the session (1008). Check GEMINI_API_KEY and GEMINI_MODEL values and try again.';
                        socket.emit('gemini:error', {
                            message: `Gemini connection rejected: ${reasonStr || 'policy violation'}. ${helpful}`,
                            code: 1008,
                            hint: 'Verify GEMINI_API_KEY and GEMINI_MODEL (example: gemini-2.5-flash)',
                            rawReason: reasonStr
                        });
                    } else {
                        socket.emit('gemini:disconnected', {
                            success: true,
                            message: `Gemini session ended (code: ${code})`,
                            reason: reasonStr
                        });
                    }

                    // Clean up session
                    if (this.sessions.has(userId)) {
                        this.sessions.delete(userId);
                    }
                });
            });

        } catch (error) {
            console.error('[Gemini] Error creating session:', error);
            throw error;
        }
    }

    /**
     * Handle messages from Gemini Live API WebSocket
     */
    handleGeminiMessage(userId, message) {
        const session = this.sessions.get(userId);
        if (!session) return;

        const { clientSocket } = session;

        // Handle serverContent (audio, text, transcriptions)
        if (message.serverContent) {
            const serverContent = message.serverContent;

            // Model turn - contains audio/text parts
            if (serverContent.modelTurn) {
                const parts = serverContent.modelTurn.parts || [];
                for (const part of parts) {
                    // Audio data
                    if (part.inlineData) {
                        const audioData = part.inlineData.data; // base64 audio
                        clientSocket.emit('gemini:audio-delta', { audio: audioData });
                    }
                    // Text content
                    if (part.text) {
                        clientSocket.emit('gemini:text-response', { text: part.text });
                    }
                }
            }

            // Input transcription (what user said)
            if (serverContent.inputTranscription) {
                clientSocket.emit('gemini:user-transcript', {
                    transcript: serverContent.inputTranscription.text
                });
            }

            // Output transcription (what AI said in text form)
            if (serverContent.outputTranscription) {
                clientSocket.emit('gemini:transcript-delta', {
                    delta: serverContent.outputTranscription.text
                });
            }

            // Turn complete
            if (serverContent.turnComplete) {
                clientSocket.emit('gemini:audio-done');
                clientSocket.emit('gemini:transcript-done', { transcript: '' });
            }

            // Interrupted (user started speaking while AI was responding)
            if (serverContent.interrupted) {
                clientSocket.emit('gemini:speech-started');
            }

            return;
        }

        // Handle toolCall (function calling from AI)
        if (message.toolCall) {
            const functionCalls = message.toolCall.functionCalls || [];
            this.handleFunctionCalls(userId, functionCalls);
            return;
        }

        // Handle toolCallCancellation
        if (message.toolCallCancellation) {
            const cancelledIds = message.toolCallCancellation.ids || [];
            console.log(`[Gemini] Tool calls cancelled: ${cancelledIds.join(', ')}`);
            cancelledIds.forEach(id => {
                session.pendingToolCalls?.delete(id);
            });
            return;
        }

        // Handle goAway (server disconnecting soon)
        if (message.goAway) {
            console.log(`[Gemini] Server sending goAway, time left: ${message.goAway.timeLeft}`);
            clientSocket.emit('gemini:error', {
                message: 'Gemini session expiring soon',
                code: 'GO_AWAY'
            });
            return;
        }

        // Log unhandled messages
        if (process.env.NODE_ENV === 'development') {
            console.log('[Gemini] Unhandled message type:', Object.keys(message));
        }
    }

    /**
     * Handle function calls from Gemini and send back results
     */
    async handleFunctionCalls(userId, functionCalls) {
        const session = this.sessions.get(userId);
        if (!session) return;

        const { geminiWs, clientSocket } = session;

        const functionResponses = [];

        for (const fc of functionCalls) {
            const functionName = fc.name;
            const args = fc.args || {};
            const callId = fc.id;

            console.log(`[Gemini-Tool] Executing ${functionName} with args:`, args);
            clientSocket.emit('gemini:function-calling', { function: functionName });
            clientSocket.emit('gemini:function-executing', { function: functionName, args });

            // Execute the tool and get results
            const result = await this.handleToolCall(userId, functionName, args);
            console.log(`[Gemini-Tool] ${functionName} result:`, JSON.stringify(result).slice(0, 300));

            functionResponses.push({
                id: callId,
                name: functionName,
                response: result
            });

            clientSocket.emit('gemini:function-result', {
                function: functionName,
                result
            });
        }

        // Send all function responses back to Gemini
        if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
            geminiWs.send(JSON.stringify({
                toolResponse: {
                    functionResponses: functionResponses
                }
            }));
            console.log(`[Gemini] Sent ${functionResponses.length} function response(s) back to Gemini`);
        }
    }

    /**
     * Send audio data to Gemini Live API
     * Audio should be base64 encoded PCM16 at 16kHz mono
     */
    sendAudio(userId, audioBase64) {
        const session = this.sessions.get(userId);
        if (!session || !session.geminiWs || session.geminiWs.readyState !== WebSocket.OPEN) {
            return { success: false, message: 'No active session' };
        }

        session.geminiWs.send(JSON.stringify({
            realtimeInput: {
                mediaChunks: [{
                    data: audioBase64,
                    mimeType: 'audio/pcm;rate=16000'
                }]
            }
        }));

        return { success: true };
    }

    /**
     * Commit audio buffer (signal end of speech)
     */
    commitAudio(userId) {
        const session = this.sessions.get(userId);
        if (!session || !session.geminiWs || session.geminiWs.readyState !== WebSocket.OPEN) {
            return { success: false, message: 'No active session' };
        }

        // Signal end of audio stream to force processing
        session.geminiWs.send(JSON.stringify({
            realtimeInput: {
                audioStreamEnd: true
            }
        }));

        return { success: true };
    }

    /**
     * Send text message to Gemini
     */
    sendText(userId, text) {
        const session = this.sessions.get(userId);
        if (!session || !session.geminiWs || session.geminiWs.readyState !== WebSocket.OPEN) {
            return { success: false, message: 'No active session' };
        }

        session.geminiWs.send(JSON.stringify({
            clientContent: {
                turns: [{
                    role: 'user',
                    parts: [{ text: text }]
                }],
                turnComplete: true
            }
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

        // Get updated safety info
        const safetyInfo = await this.getNearbySafetyInfo(longitude, latitude);

        // Send location update as context to Gemini
        if (session.geminiWs && session.geminiWs.readyState === WebSocket.OPEN) {
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

            session.geminiWs.send(JSON.stringify({
                clientContent: {
                    turns: [{
                        role: 'user',
                        parts: [{ text: locationContext }]
                    }],
                    turnComplete: false
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
            if (session.geminiWs && session.geminiWs.readyState === WebSocket.OPEN) {
                session.geminiWs.close();
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
        return session && session.geminiWs && session.geminiWs.readyState === WebSocket.OPEN;
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
            isActive: session.geminiWs && session.geminiWs.readyState === WebSocket.OPEN
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
export default new GeminiRealtimeService();
