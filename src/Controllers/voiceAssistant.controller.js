import gptRealtimeService from '../Services/gptRealtime.service.js';
import Location from '../Models/location.model.js';
import SafetyScore from '../Models/safetyScore.model.js';
import { asyncHandler, BadRequestError, NotFoundError } from '../Middlewares/error.middleware.js';

/**
 * @desc    Get AI assistant context for current user
 * @route   GET /api/voice-assistant/context
 * @access  Private
 */
export const getAssistantContext = asyncHandler(async (req, res) => {
    const user = req.user;
    
    // Get user's last known location
    const lastLocation = await gptRealtimeService.getLastLocation(user._id);
    
    // Get nearby safety info if location exists
    let safetyInfo = null;
    if (lastLocation) {
        safetyInfo = await gptRealtimeService.getNearbySafetyInfo(
            lastLocation.longitude, 
            lastLocation.latitude
        );
    }

    // Get active trips
    const activeTrips = await gptRealtimeService.getActiveTrips(user._id);
    
    // Get recent alerts
    const recentAlerts = await gptRealtimeService.getRecentAlerts(user._id);

    res.status(200).json({
        success: true,
        data: {
            user: {
                name: user.name,
                email: user.email,
                phoneNumber: user.phoneNumber,
                nationality: user.nationality,
                gender: user.gender,
                emergencyContacts: user.emergencyContacts,
                healthInfo: user.healthInfo
            },
            location: lastLocation,
            safetyInfo: safetyInfo ? {
                name: safetyInfo.name,
                safetyScore: safetyInfo.safetyScore,
                riskLevel: safetyInfo.riskLevel,
                crimeRate: safetyInfo.crimeRate,
                population: safetyInfo.population
            } : null,
            activeTrips: activeTrips.map(trip => ({
                id: trip._id,
                name: trip.tripName,
                status: trip.status,
                startDate: trip.startDate,
                endDate: trip.endDate
            })),
            recentAlerts: recentAlerts.map(alert => ({
                id: alert._id,
                type: alert.alertType,
                severity: alert.severity,
                status: alert.status,
                createdAt: alert.createdAt
            }))
        }
    });
});

/**
 * @desc    Get safety information for a specific location
 * @route   GET /api/voice-assistant/safety-info
 * @access  Private
 */
export const getLocationSafetyInfo = asyncHandler(async (req, res) => {
    const { longitude, latitude } = req.query;

    if (!longitude || !latitude) {
        throw new BadRequestError('Longitude and latitude are required');
    }

    const lng = parseFloat(longitude);
    const lat = parseFloat(latitude);

    if (isNaN(lng) || isNaN(lat)) {
        throw new BadRequestError('Invalid coordinates');
    }

    const safetyInfo = await gptRealtimeService.getNearbySafetyInfo(lng, lat);

    if (!safetyInfo) {
        return res.status(200).json({
            success: true,
            message: 'No safety data available for this location',
            data: null
        });
    }

    res.status(200).json({
        success: true,
        data: {
            name: safetyInfo.name,
            safetyScore: safetyInfo.safetyScore,
            riskLevel: safetyInfo.riskLevel,
            crimeRate: safetyInfo.crimeRate,
            population: safetyInfo.population,
            populationDensity: safetyInfo.populationDensity,
            coordinates: safetyInfo.location.coordinates,
            lastUpdated: safetyInfo.lastUpdated
        }
    });
});

/**
 * @desc    Send text message to AI assistant (REST endpoint for non-realtime use)
 * @route   POST /api/voice-assistant/chat
 * @access  Private
 */
export const chatWithAssistant = asyncHandler(async (req, res) => {
    const { message, longitude, latitude } = req.body;
    const user = req.user;

    if (!message) {
        throw new BadRequestError('Message is required');
    }

    // Get location context
    let currentLocation = null;
    if (longitude && latitude) {
        currentLocation = { longitude: parseFloat(longitude), latitude: parseFloat(latitude) };
    } else {
        currentLocation = await gptRealtimeService.getLastLocation(user._id);
    }

    // Build the context for a simple text response
    const safetyInfo = currentLocation 
        ? await gptRealtimeService.getNearbySafetyInfo(currentLocation.longitude, currentLocation.latitude)
        : null;

    // For text-only chat, we return context that can be used with any OpenAI API
    // This endpoint provides the context, the actual AI call should be made separately
    // or through the WebSocket realtime connection
    
    res.status(200).json({
        success: true,
        message: 'Use WebSocket connection for real-time voice chat. This endpoint provides context only.',
        context: {
            user: {
                name: user.name,
                nationality: user.nationality,
                gender: user.gender
            },
            location: currentLocation,
            safetyInfo: safetyInfo ? {
                name: safetyInfo.name,
                safetyScore: safetyInfo.safetyScore,
                riskLevel: safetyInfo.riskLevel
            } : null,
            userMessage: message
        },
        websocketEndpoint: '/user',
        websocketEvents: {
            connect: 'gpt:connect',
            sendAudio: 'gpt:audio',
            sendText: 'gpt:text',
            disconnect: 'gpt:disconnect'
        }
    });
});

/**
 * @desc    Get session status
 * @route   GET /api/voice-assistant/session
 * @access  Private
 */
export const getSessionStatus = asyncHandler(async (req, res) => {
    const userId = req.user._id.toString();
    
    const hasSession = gptRealtimeService.hasActiveSession(userId);
    const sessionInfo = gptRealtimeService.getSessionInfo(userId);

    res.status(200).json({
        success: true,
        data: {
            hasActiveSession: hasSession,
            sessionInfo: sessionInfo
        }
    });
});

/**
 * @desc    Get emergency information based on location
 * @route   GET /api/voice-assistant/emergency-info
 * @access  Private
 */
export const getEmergencyInfo = asyncHandler(async (req, res) => {
    const { longitude, latitude } = req.query;
    const user = req.user;

    let currentLocation = null;
    if (longitude && latitude) {
        currentLocation = { 
            longitude: parseFloat(longitude), 
            latitude: parseFloat(latitude) 
        };
    } else {
        currentLocation = await gptRealtimeService.getLastLocation(user._id);
    }

    const safetyInfo = currentLocation 
        ? await gptRealtimeService.getNearbySafetyInfo(currentLocation.longitude, currentLocation.latitude)
        : null;

    res.status(200).json({
        success: true,
        data: {
            emergencyNumbers: {
                police: '100',
                ambulance: '102 / 108',
                fire: '101',
                womenHelpline: '1091 / 181',
                touristPolice: '1363',
                nationalEmergency: '112',
                childHelpline: '1098',
                seniorCitizen: '14567',
                roadAccident: '1073',
                disasterManagement: '108'
            },
            userEmergencyContacts: user.emergencyContacts || [],
            healthInfo: user.healthInfo || null,
            currentLocation: currentLocation,
            nearestArea: safetyInfo ? {
                name: safetyInfo.name,
                riskLevel: safetyInfo.riskLevel,
                safetyScore: safetyInfo.safetyScore
            } : null,
            tips: [
                'Stay calm and assess the situation',
                'If in immediate danger, call 112 (National Emergency)',
                'Use the SOS feature in the app to alert your emergency contacts',
                'Share your live location with trusted contacts',
                'Move to a safe, well-lit area if possible',
                'Note any landmarks or addresses around you'
            ]
        }
    });
});

/**
 * @desc    Get travel tips for current location
 * @route   GET /api/voice-assistant/travel-tips
 * @access  Private
 */
export const getTravelTips = asyncHandler(async (req, res) => {
    const { longitude, latitude } = req.query;
    const user = req.user;

    let currentLocation = null;
    if (longitude && latitude) {
        currentLocation = { 
            longitude: parseFloat(longitude), 
            latitude: parseFloat(latitude) 
        };
    } else {
        currentLocation = await gptRealtimeService.getLastLocation(user._id);
    }

    const safetyInfo = currentLocation 
        ? await gptRealtimeService.getNearbySafetyInfo(currentLocation.longitude, currentLocation.latitude)
        : null;

    // Generate tips based on safety level
    let tips = [];
    if (safetyInfo) {
        const riskLevel = safetyInfo.riskLevel;
        
        // Common tips for all areas
        tips = [
            'Always keep your important documents secure',
            'Keep emergency contact numbers saved offline',
            'Inform someone about your travel plans',
            'Keep your phone charged and carry a power bank',
            'Have local currency and a backup payment method'
        ];

        // Risk-level specific tips
        if (riskLevel === 'Low Risk') {
            tips.push(
                'This is a relatively safe area, but stay aware of your surroundings',
                'Enjoy exploring but keep valuables secure'
            );
        } else if (riskLevel === 'Moderate Risk' || riskLevel === 'Medium Risk') {
            tips.push(
                'Avoid isolated areas, especially after dark',
                'Stay in well-populated tourist areas',
                'Be cautious with strangers offering unsolicited help'
            );
        } else if (riskLevel === 'High Risk' || riskLevel === 'Extreme Risk') {
            tips.push(
                'Exercise heightened caution in this area',
                'Avoid traveling alone, especially at night',
                'Keep emergency contacts readily accessible',
                'Consider hiring a local guide from reputable sources',
                'Stay updated on local news and advisories'
            );
        }
    } else {
        tips = [
            'Share your location with trusted contacts',
            'Research the area before visiting',
            'Keep emergency numbers handy',
            'Stay in well-reviewed accommodations',
            'Use registered transportation services'
        ];
    }

    res.status(200).json({
        success: true,
        data: {
            location: currentLocation,
            areaInfo: safetyInfo ? {
                name: safetyInfo.name,
                safetyScore: safetyInfo.safetyScore,
                riskLevel: safetyInfo.riskLevel
            } : null,
            tips: tips
        }
    });
});
