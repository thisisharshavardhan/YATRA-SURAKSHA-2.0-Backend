import geminiRealtimeService from '../../Services/geminiRealtime.service.js';
import Alert from '../../Models/alert.model.js';
import Group from '../../Models/group.model.js';
import User from '../../Models/user.model.js';

/**
 * Gemini Realtime Voice Assistant Socket Handler
 * Handles real-time voice communication with Gemini 2.5 Flash Native Audio Dialog
 */
export default function geminiRealtimeHandler(io, socket, userNamespace, adminNamespace) {
    const user = socket.user;
    const userId = user._id.toString();

    console.log(`Gemini Realtime handler initialized for user: ${user.name}`);

    /**
     * Connect to Gemini-Realtime service
     * Event: gemini:connect
     * Payload: { longitude?: number, latitude?: number, settings?: object }
     */
    socket.on('gemini:connect', async (data = {}) => {
        try {
            console.log(`User ${user.name} connecting to Gemini-Realtime...`);

            const currentLocation = data.longitude && data.latitude
                ? { longitude: data.longitude, latitude: data.latitude }
                : null;

            // Extract voice settings if provided
            const voiceSettings = data.settings || {};

            const result = await geminiRealtimeService.createSession(user, socket, currentLocation, voiceSettings);

            socket.emit('gemini:connected', {
                success: true,
                message: 'Connected to Gemini AI voice assistant',
                userId: userId,
                settings: voiceSettings
            });

            // Notify admin if needed
            adminNamespace.emit('gemini:user-connected', {
                userId,
                userName: user.name,
                connectedAt: new Date(),
                voiceSettings
            });

        } catch (error) {
            console.error(`Gemini connect error for ${user.name}:`, error);
            socket.emit('gemini:error', {
                message: 'Failed to connect to Gemini AI service',
                error: error.message
            });
        }
    });

    /**
     * Send audio data to Gemini-Realtime
     * Event: gemini:audio
     * Payload: { audio: string (base64 PCM16 audio at 16kHz mono) }
     */
    socket.on('gemini:audio', (data) => {
        if (!data?.audio) {
            socket.emit('gemini:error', { message: 'Audio data required' });
            return;
        }

        const result = geminiRealtimeService.sendAudio(userId, data.audio);

        if (!result.success) {
            socket.emit('gemini:error', {
                message: result.message || 'Failed to send audio',
                hint: 'Make sure to connect first using gemini:connect'
            });
        }
    });

    /**
     * Commit audio buffer (end of speech)
     * Event: gemini:audio-commit
     */
    socket.on('gemini:audio-commit', () => {
        const result = geminiRealtimeService.commitAudio(userId);

        if (!result.success) {
            socket.emit('gemini:error', {
                message: result.message || 'Failed to commit audio',
                hint: 'Make sure to connect first using gemini:connect'
            });
        }
    });

    /**
     * Send text message to Gemini
     * Event: gemini:text
     * Payload: { text: string }
     */
    socket.on('gemini:text', (data) => {
        if (!data?.text) {
            socket.emit('gemini:error', { message: 'Text message required' });
            return;
        }

        const result = geminiRealtimeService.sendText(userId, data.text);

        if (!result.success) {
            socket.emit('gemini:error', {
                message: result.message || 'Failed to send text',
                hint: 'Make sure to connect first using gemini:connect'
            });
        } else {
            socket.emit('gemini:text-sent', {
                success: true,
                text: data.text
            });
        }
    });

    /**
     * Update location context during session
     * Event: gemini:update-location
     * Payload: { longitude: number, latitude: number }
     */
    socket.on('gemini:update-location', async (data) => {
        if (!data?.longitude || !data?.latitude) {
            socket.emit('gemini:error', { message: 'Longitude and latitude required' });
            return;
        }

        try {
            const result = await geminiRealtimeService.updateLocation(
                userId,
                data.longitude,
                data.latitude
            );

            if (result.success) {
                socket.emit('gemini:location-updated', {
                    success: true,
                    location: { longitude: data.longitude, latitude: data.latitude },
                    safetyInfo: result.safetyInfo ? {
                        name: result.safetyInfo.name,
                        safetyScore: result.safetyInfo.safetyScore,
                        riskLevel: result.safetyInfo.riskLevel
                    } : null
                });
            } else {
                socket.emit('gemini:error', { message: result.message });
            }
        } catch (error) {
            console.error(`Location update error for ${user.name}:`, error);
            socket.emit('gemini:error', { message: 'Failed to update location' });
        }
    });

    /**
     * Get current session status
     * Event: gemini:status
     */
    socket.on('gemini:status', () => {
        const hasSession = geminiRealtimeService.hasActiveSession(userId);
        const sessionInfo = geminiRealtimeService.getSessionInfo(userId);

        socket.emit('gemini:status-response', {
            connected: hasSession,
            sessionInfo: sessionInfo
        });
    });

    /**
     * Disconnect from Gemini-Realtime service
     * Event: gemini:disconnect
     */
    socket.on('gemini:disconnect', async () => {
        try {
            const result = await geminiRealtimeService.closeSession(userId);

            socket.emit('gemini:disconnected', {
                success: true,
                message: 'Disconnected from Gemini AI voice assistant'
            });

            // Notify admin
            adminNamespace.emit('gemini:user-disconnected', {
                userId,
                userName: user.name,
                disconnectedAt: new Date()
            });

        } catch (error) {
            console.error(`Gemini disconnect error for ${user.name}:`, error);
            socket.emit('gemini:error', { message: 'Error disconnecting' });
        }
    });

    /**
     * Clean up on socket disconnect
     */
    socket.on('disconnect', async () => {
        try {
            if (geminiRealtimeService.hasActiveSession(userId)) {
                await geminiRealtimeService.closeSession(userId);
                console.log(`Gemini session closed for disconnected user: ${user.name}`);
            }
        } catch (error) {
            console.error(`Error closing Gemini session on disconnect:`, error);
        }
    });

    /**
     * Handle SOS triggered by Gemini voice assistant
     * Event: gemini:sos-triggered (internal, from service)
     */
    socket.on('gemini:sos-triggered', async (data) => {
        try {
            console.log(`[Gemini-SOS] AI triggered SOS for user: ${user.name}`);

            const { alertData } = data;

            // Save alert to database
            const alert = await Alert.create(alertData);
            console.log(`[Gemini-SOS] Alert saved with ID: ${alert._id}`);

            // Get user's full info for notification
            const userInfo = await User.findById(user._id)
                .select('name email phoneNumber profilePicture emergencyContacts');

            // Prepare SOS notification data
            const sosData = {
                alertId: alert._id.toString(),
                triggeredBy: 'gemini_voice_assistant',
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
                source: 'gemini_voice_assistant'
            });

            // Confirm to the user
            socket.emit('gemini:sos-confirmed', {
                success: true,
                alertId: alert._id.toString(),
                message: 'SOS alert has been sent to your emergency contacts and group members'
            });

            console.log(`[Gemini-SOS] Notifications sent for alert: ${alert._id}`);

        } catch (error) {
            console.error(`[Gemini-SOS] Error handling SOS:`, error);
            socket.emit('gemini:sos-error', {
                success: false,
                message: 'Failed to process SOS alert',
                error: error.message
            });
        }
    });
}

/**
 * Gemini Events Documentation
 *
 * CLIENT -> SERVER EVENTS:
 * ========================
 *
 * gemini:connect
 *   - Connect to Gemini-Realtime service
 *   - Payload: { longitude?: number, latitude?: number, settings?: object }
 *   - Response: gemini:connected
 *
 * gemini:audio
 *   - Send audio data (while recording)
 *   - Payload: { audio: string } (base64 PCM16 at 16kHz mono)
 *
 * gemini:audio-commit
 *   - Signal end of speech / end of audio stream
 *   - Payload: none
 *
 * gemini:text
 *   - Send text message instead of voice
 *   - Payload: { text: string }
 *   - Response: gemini:text-sent
 *
 * gemini:update-location
 *   - Update user's location context during session
 *   - Payload: { longitude: number, latitude: number }
 *   - Response: gemini:location-updated
 *
 * gemini:status
 *   - Get current session status
 *   - Response: gemini:status-response
 *
 * gemini:disconnect
 *   - Disconnect from Gemini-Realtime service
 *   - Response: gemini:disconnected
 *
 *
 * SERVER -> CLIENT EVENTS:
 * ========================
 *
 * gemini:connected
 *   - Successfully connected to Gemini AI service
 *
 * gemini:session-created
 *   - Gemini session initialized (after setupComplete)
 *
 * gemini:audio-delta
 *   - Audio chunk from AI response
 *   - Payload: { audio: string } (base64 PCM16 at 24kHz)
 *
 * gemini:audio-done
 *   - AI audio response complete (turnComplete)
 *
 * gemini:transcript-delta
 *   - Output transcription of AI response
 *   - Payload: { delta: string }
 *
 * gemini:transcript-done
 *   - Complete transcript of AI response
 *   - Payload: { transcript: string }
 *
 * gemini:text-response
 *   - Text response from AI
 *   - Payload: { text: string }
 *
 * gemini:user-transcript
 *   - Transcription of user's speech (input transcription)
 *   - Payload: { transcript: string }
 *
 * gemini:speech-started
 *   - User speech detected / model interrupted
 *
 * gemini:function-calling
 *   - AI is calling a function/tool
 *   - Payload: { function: string }
 *
 * gemini:function-executing
 *   - Function is being executed
 *   - Payload: { function: string, args: object }
 *
 * gemini:function-result
 *   - Function execution completed
 *   - Payload: { function: string, result: object }
 *
 * gemini:sos-triggered
 *   - AI triggered an SOS alert (internal event from service)
 *   - Payload: { alertData: object, timestamp: Date }
 *
 * gemini:sos-confirmed
 *   - SOS alert successfully saved and notifications sent
 *   - Payload: { success: true, alertId: string, message: string }
 *
 * gemini:sos-error
 *   - Failed to process SOS alert
 *   - Payload: { success: false, message: string, error: string }
 *
 * gemini:error
 *   - Error occurred
 *   - Payload: { message: string, code?: string }
 *
 * gemini:disconnected
 *   - Disconnected from AI service
 */
