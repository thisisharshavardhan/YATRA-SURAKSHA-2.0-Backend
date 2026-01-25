import mongoose from 'mongoose';
import Alert from '../../Models/alert.model.js';
import Group from '../../Models/group.model.js';
import User from '../../Models/user.model.js';

/**
 * SOS/Alert handler for emergency situations
 */
export default function sosHandler(io, socket, userNamespace, adminNamespace) {

    /**
     * EVENT: sos:trigger
     * Trigger an SOS alert - notifies group members, emergency contacts, and admins
     * 
     * Payload:
     * {
     *   latitude: number (required),
     *   longitude: number (required),
     *   message: string (optional)
     * }
     * 
     * Response Events:
     * - sos:confirmed (to sender) - contains alertId
     * - sos:alert (to group members) - SOS details
     * - sos:emergency (to admins) - SOS details with user info
     */
    socket.on('sos:trigger', async (data) => {
        try {
            // Support both { latitude, longitude } and { location: { latitude, longitude } }
            const latitude = data.latitude ?? data.location?.latitude;
            const longitude = data.longitude ?? data.location?.longitude;
            const message = data.message;

            if (latitude === undefined || longitude === undefined) {
                socket.emit('error', {
                    event: 'sos:trigger',
                    message: 'latitude and longitude are required'
                });
                return;
            }

            // Create alert in database
            const alert = await Alert.create({
                userID: socket.user._id,
                location: {
                    type: 'Point',
                    coordinates: [longitude, latitude]
                },
                alertType: 'sos',
                severity: 'critical',
                status: 'active',
                description: message || 'Emergency SOS triggered'
            });

            // Get user's full info
            const user = await User.findById(socket.user._id)
                .select('name email phoneNumber profilePicture emergencyContacts');

            // Prepare SOS data
            const sosData = {
                alertId: alert._id.toString(),
                user: {
                    id: socket.user.id,
                    name: user.name,
                    phone: user.phoneNumber,
                    email: user.email,
                    profilePicture: user.profilePicture
                },
                location: {
                    latitude,
                    longitude,
                    googleMapsUrl: `https://maps.google.com/?q=${latitude},${longitude}`
                },
                message: alert.description,
                timestamp: alert.createdAt,
                status: 'active'
            };

            // Notify all group members
            const groups = await Group.find({
                'members.userID': socket.user._id,
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
            if (user.emergencyContacts?.length > 0) {
                const contactPhones = user.emergencyContacts.map(c => c.phoneNumber);
                const contactUsers = await User.find({
                    phoneNumber: { $in: contactPhones }
                }).select('_id');

                contactUsers.forEach(contact => {
                    userNamespace.to(`user:${contact._id}`).emit('sos:emergency-contact', {
                        ...sosData,
                        message: `EMERGENCY: ${user.name} triggered an SOS!`
                    });
                });
            }

            // Notify ALL admins immediately
            adminNamespace.emit('sos:emergency', sosData);

            // Confirm to sender
            socket.emit('sos:confirmed', {
                alertId: alert._id.toString(),
                message: 'SOS sent successfully',
                timestamp: alert.createdAt
            });

            console.log(`SOS triggered by ${user.name} at ${latitude}, ${longitude}`);

        } catch (error) {
            console.error('SOS trigger error:', error);
            socket.emit('error', {
                event: 'sos:trigger',
                message: 'Failed to trigger SOS'
            });
        }
    });

    /**
     * EVENT: sos:cancel
     * Cancel an active SOS alert
     * 
     * Payload:
     * {
     *   alertId: string (required) - MongoDB ObjectId,
     *   reason: string (optional)
     * }
     * 
     * Response Events:
     * - sos:cancelled (to sender) - confirmation
     * - sos:resolved (to group members and admins)
     */
    socket.on('sos:cancel', async (data) => {
        try {
            const { alertId, reason } = data;

            if (!alertId || !mongoose.Types.ObjectId.isValid(alertId)) {
                socket.emit('error', {
                    event: 'sos:cancel',
                    message: 'Valid alertId is required'
                });
                return;
            }

            const alert = await Alert.findOne({
                _id: alertId,
                userID: socket.user._id,
                alertType: 'sos',
                status: 'active'
            });

            if (!alert) {
                socket.emit('error', {
                    event: 'sos:cancel',
                    message: 'Active SOS alert not found'
                });
                return;
            }

            // Update alert
            alert.status = 'cancelled';
            alert.resolutionNotes = reason || 'Cancelled by user';
            alert.resolvedAt = new Date();
            await alert.save();

            const resolveData = {
                alertId: alert._id.toString(),
                cancelledBy: {
                    id: socket.user.id,
                    name: socket.user.name
                },
                reason: alert.resolutionNotes,
                timestamp: alert.resolvedAt
            };

            // Notify groups
            const groups = await Group.find({
                'members.userID': socket.user._id,
                isActive: true
            }).select('_id');

            groups.forEach(group => {
                socket.to(`group:${group._id}`).emit('sos:resolved', resolveData);
            });

            // Notify admins
            adminNamespace.emit('sos:resolved', resolveData);

            // Confirm to sender
            socket.emit('sos:cancelled', {
                alertId: alert._id.toString(),
                message: 'SOS cancelled successfully'
            });

        } catch (error) {
            console.error('SOS cancel error:', error);
            socket.emit('error', {
                event: 'sos:cancel',
                message: 'Failed to cancel SOS'
            });
        }
    });

    /**
     * EVENT: alert:low-battery
     * Send low battery alert to group members and admins
     * 
     * Payload:
     * {
     *   latitude: number (optional),
     *   longitude: number (optional),
     *   battery: number (required) - must be <= 20
     * }
     */
    socket.on('alert:low-battery', async (data) => {
        try {
            const { latitude, longitude, battery } = data;

            if (battery === undefined || battery > 20) {
                return; // Ignore if battery not low
            }

            // Create alert in database
            const alert = await Alert.create({
                userID: socket.user._id,
                location: latitude && longitude ? {
                    type: 'Point',
                    coordinates: [longitude, latitude]
                } : undefined,
                alertType: 'low_battery',
                severity: battery <= 5 ? 'high' : 'medium',
                status: 'active',
                description: `Battery at ${battery}%`
            });

            const alertData = {
                alertId: alert._id.toString(),
                user: {
                    id: socket.user.id,
                    name: socket.user.name
                },
                battery,
                location: latitude && longitude ? { latitude, longitude } : null,
                timestamp: alert.createdAt
            };

            // Notify groups
            if (socket.joinedGroups) {
                socket.joinedGroups.forEach(groupId => {
                    socket.to(`group:${groupId}`).emit('alert:low-battery', alertData);
                });
            }

            // Notify admins
            adminNamespace.emit('alert:low-battery', alertData);

            console.log(`Low battery alert from ${socket.user.name}: ${battery}%`);

        } catch (error) {
            console.error('Low battery alert error:', error);
        }
    });
}
