import gptRealtimeService from '../../Services/gptRealtime.service.js';
import Alert from '../../Models/alert.model.js';
import Group from '../../Models/group.model.js';
import User from '../../Models/user.model.js';

/**
 * GPT Realtime Voice Assistant Socket Handler
 * Handles real-time voice communication with Azure OpenAI GPT-Realtime
 */
export default function gptRealtimeHandler(io, socket, userNamespace, adminNamespace) {
    const user = socket.user;
    const userId = user._id.toString();

    console.log(`GPT Realtime handler initialized for user: ${user.name}`);

    /**
     * Connect to GPT-Realtime service
     * Event: gpt:connect
     * Payload: { longitude?: number, latitude?: number, settings?: object }
     */
    socket.on('gpt:connect', async (data = {}) => {
        try {
            console.log(`User ${user.name} connecting to GPT-Realtime...`);

            const currentLocation = data.longitude && data.latitude 
                ? { longitude: data.longitude, latitude: data.latitude }
                : null;

            // Extract voice settings if provided
            const voiceSettings = data.settings || {};

            const result = await gptRealtimeService.createSession(user, socket, currentLocation, voiceSettings);
            
            socket.emit('gpt:connected', {
                success: true,
                message: 'Connected to AI voice assistant',
                userId: userId,
                settings: voiceSettings
            });

            // Notify admin if needed
            adminNamespace.emit('gpt:user-connected', {
                userId,
                userName: user.name,
                connectedAt: new Date(),
                voiceSettings
            });

        } catch (error) {
            console.error(`GPT connect error for ${user.name}:`, error);
            socket.emit('gpt:error', {
                message: 'Failed to connect to AI service',
                error: error.message
            });
        }
    });

    /**
     * Send audio data to GPT-Realtime
     * Event: gpt:audio
     * Payload: { audio: string (base64 PCM16 audio) }
     */
    socket.on('gpt:audio', (data) => {
        if (!data?.audio) {
            socket.emit('gpt:error', { message: 'Audio data required' });
            return;
        }

        const result = gptRealtimeService.sendAudio(userId, data.audio);
        
        if (!result.success) {
            socket.emit('gpt:error', { 
                message: result.message || 'Failed to send audio',
                hint: 'Make sure to connect first using gpt:connect'
            });
        }
    });

    /**
     * Commit audio buffer (end of speech)
     * Event: gpt:audio-commit
     */
    socket.on('gpt:audio-commit', () => {
        const result = gptRealtimeService.commitAudio(userId);
        
        if (!result.success) {
            socket.emit('gpt:error', { 
                message: result.message || 'Failed to commit audio',
                hint: 'Make sure to connect first using gpt:connect'
            });
        }
    });

    /**
     * Send text message to GPT
     * Event: gpt:text
     * Payload: { text: string }
     */
    socket.on('gpt:text', (data) => {
        if (!data?.text) {
            socket.emit('gpt:error', { message: 'Text message required' });
            return;
        }

        const result = gptRealtimeService.sendText(userId, data.text);
        
        if (!result.success) {
            socket.emit('gpt:error', { 
                message: result.message || 'Failed to send text',
                hint: 'Make sure to connect first using gpt:connect'
            });
        } else {
            socket.emit('gpt:text-sent', { 
                success: true, 
                text: data.text 
            });
        }
    });

    /**
     * Update location context during session
     * Event: gpt:update-location
     * Payload: { longitude: number, latitude: number }
     */
    socket.on('gpt:update-location', async (data) => {
        if (!data?.longitude || !data?.latitude) {
            socket.emit('gpt:error', { message: 'Longitude and latitude required' });
            return;
        }

        try {
            const result = await gptRealtimeService.updateLocation(
                userId, 
                data.longitude, 
                data.latitude
            );

            if (result.success) {
                socket.emit('gpt:location-updated', {
                    success: true,
                    location: { longitude: data.longitude, latitude: data.latitude },
                    safetyInfo: result.safetyInfo ? {
                        name: result.safetyInfo.name,
                        safetyScore: result.safetyInfo.safetyScore,
                        riskLevel: result.safetyInfo.riskLevel
                    } : null
                });
            } else {
                socket.emit('gpt:error', { message: result.message });
            }
        } catch (error) {
            console.error(`Location update error for ${user.name}:`, error);
            socket.emit('gpt:error', { message: 'Failed to update location' });
        }
    });

    /**
     * Get current session status
     * Event: gpt:status
     */
    socket.on('gpt:status', () => {
        const hasSession = gptRealtimeService.hasActiveSession(userId);
        const sessionInfo = gptRealtimeService.getSessionInfo(userId);

        socket.emit('gpt:status-response', {
            connected: hasSession,
            sessionInfo: sessionInfo
        });
    });

    /**
     * Disconnect from GPT-Realtime service
     * Event: gpt:disconnect
     */
    socket.on('gpt:disconnect', async () => {
        try {
            const result = await gptRealtimeService.closeSession(userId);
            
            socket.emit('gpt:disconnected', {
                success: true,
                message: 'Disconnected from AI voice assistant'
            });

            // Notify admin
            adminNamespace.emit('gpt:user-disconnected', {
                userId,
                userName: user.name,
                disconnectedAt: new Date()
            });

        } catch (error) {
            console.error(`GPT disconnect error for ${user.name}:`, error);
            socket.emit('gpt:error', { message: 'Error disconnecting' });
        }
    });

    /**
     * Clean up on socket disconnect
     */
    socket.on('disconnect', async () => {
        try {
            if (gptRealtimeService.hasActiveSession(userId)) {
                await gptRealtimeService.closeSession(userId);
                console.log(`GPT session closed for disconnected user: ${user.name}`);
            }
        } catch (error) {
            console.error(`Error closing GPT session on disconnect:`, error);
        }
    });

    /**
     * Handle SOS triggered by AI voice assistant
     * This is emitted by gptRealtimeService when AI calls trigger_sos_alert
     * Event: gpt:sos-triggered (internal, from service)
     */
    socket.on('gpt:sos-triggered', async (data) => {
        try {
            console.log(`[GPT-SOS] AI triggered SOS for user: ${user.name}`);
            
            const { alertData } = data;

            // Save alert to database
            const alert = await Alert.create(alertData);
            console.log(`[GPT-SOS] Alert saved with ID: ${alert._id}`);

            // Get user's full info for notification
            const userInfo = await User.findById(user._id)
                .select('name email phoneNumber profilePicture emergencyContacts');

            // Prepare SOS notification data
            const sosData = {
                alertId: alert._id.toString(),
                triggeredBy: 'voice_assistant',
                user: {
                    id: user._id.toString(),
                    name: userInfo.name,
                    phone: userInfo.phoneNumber,
                    email: userInfo.email,
                    profilePicture: userInfo.profilePicture
                },
                location: {
                    latitude: alertData.location.coordinates[1],
                    longitude: alertData.location.coordinates[0],
                    googleMapsUrl: `https://maps.google.com/?q=${alertData.location.coordinates[1]},${alertData.location.coordinates[0]}`
                },
                severity: alertData.severity,
                description: alertData.description,
                timestamp: alert.createdAt,
                status: 'active'
            };

            // Notify all group members
            const groups = await Group.find({
                'members.userID': user._id,
                isActive: true
            }).select('_id name');

            groups.forEach(group => {
                socket.to(`group:${group._id}`).emit('sos:alert', {
                    ...sosData,
                    group: {
                        id: group._id.toString(),
                        name: group.name
                    }
                });
            });

            // Notify emergency contacts (if they're online)
            if (userInfo.emergencyContacts?.length > 0) {
                const contactPhones = userInfo.emergencyContacts.map(c => c.phoneNumber);
                const contactUsers = await User.find({
                    phoneNumber: { $in: contactPhones }
                }).select('_id');

                contactUsers.forEach(contactUser => {
                    userNamespace.to(`user:${contactUser._id}`).emit('sos:emergency-contact-alert', {
                        ...sosData,
                        relation: userInfo.emergencyContacts.find(c => c.phoneNumber === contactUser.phoneNumber)?.relation
                    });
                });
            }

            // Notify admins
            adminNamespace.emit('sos:emergency', {
                ...sosData,
                source: 'voice_assistant'
            });

            // Confirm to the user
            socket.emit('gpt:sos-confirmed', {
                success: true,
                alertId: alert._id.toString(),
                message: 'SOS alert has been sent to your emergency contacts and group members'
            });

            console.log(`[GPT-SOS] Notifications sent for alert: ${alert._id}`);

        } catch (error) {
            console.error(`[GPT-SOS] Error handling SOS:`, error);
            socket.emit('gpt:sos-error', {
                success: false,
                message: 'Failed to process SOS alert',
                error: error.message
            });
        }
    });
}

/**
 * GPT Events Documentation
 * 
 * CLIENT -> SERVER EVENTS:
 * ========================
 * 
 * gpt:connect
 *   - Connect to GPT-Realtime service
 *   - Payload: { longitude?: number, latitude?: number }
 *   - Response: gpt:connected
 * 
 * gpt:audio
 *   - Send audio data (while recording)
 *   - Payload: { audio: string } (base64 PCM16 at 24kHz)
 * 
 * gpt:audio-commit
 *   - Signal end of speech, request AI response
 *   - Payload: none
 * 
 * gpt:text
 *   - Send text message instead of voice
 *   - Payload: { text: string }
 *   - Response: gpt:text-sent
 * 
 * gpt:update-location
 *   - Update user's location context during session
 *   - Payload: { longitude: number, latitude: number }
 *   - Response: gpt:location-updated
 * 
 * gpt:status
 *   - Get current session status
 *   - Response: gpt:status-response
 * 
 * gpt:disconnect
 *   - Disconnect from GPT-Realtime service
 *   - Response: gpt:disconnected
 * 
 * 
 * SERVER -> CLIENT EVENTS:
 * ========================
 * 
 * gpt:connected
 *   - Successfully connected to AI service
 * 
 * gpt:session-created
 *   - Azure session initialized
 * 
 * gpt:session-updated
 *   - Session configuration updated
 * 
 * gpt:audio-delta
 *   - Audio chunk from AI response
 *   - Payload: { audio: string } (base64 PCM16)
 * 
 * gpt:audio-done
 *   - AI audio response complete
 * 
 * gpt:transcript-delta
 *   - Partial transcript of AI response
 *   - Payload: { delta: string }
 * 
 * gpt:transcript-done
 *   - Complete transcript of AI response
 *   - Payload: { transcript: string }
 * 
 * gpt:text-response
 *   - Text response from AI
 *   - Payload: { text: string }
 * 
 * gpt:user-transcript
 *   - Transcription of user's speech
 *   - Payload: { transcript: string }
 * 
 * gpt:speech-started
 *   - User speech detected
 * 
 * gpt:speech-stopped
 *   - User speech ended
 * 
 * gpt:function-calling
 *   - AI is calling a function/tool
 *   - Payload: { function: string }
 * 
 * gpt:function-executing
 *   - Function is being executed
 *   - Payload: { function: string, args: object }
 * 
 * gpt:function-result
 *   - Function execution completed
 *   - Payload: { function: string, result: object }
 * 
 * gpt:sos-triggered
 *   - AI triggered an SOS alert (internal event from service)
 *   - Payload: { alertData: object, timestamp: Date }
 * 
 * gpt:sos-confirmed
 *   - SOS alert successfully saved and notifications sent
 *   - Payload: { success: true, alertId: string, message: string }
 * 
 * gpt:sos-error
 *   - Failed to process SOS alert
 *   - Payload: { success: false, message: string, error: string }
 * 
 * gpt:error
 *   - Error occurred
 *   - Payload: { message: string, code?: string }
 * 
 * gpt:disconnected
 *   - Disconnected from AI service
 */
