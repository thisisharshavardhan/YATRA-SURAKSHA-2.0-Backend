import mongoose from 'mongoose';
import Location from '../../Models/location.model.js';
import User from '../../Models/user.model.js';
import Alert from '../../Models/alert.model.js';
import Group from '../../Models/group.model.js';

/**
 * Admin handler for dashboard real-time monitoring
 */
export default function adminHandler(io, socket, userNamespace, onlineUsers) {

    /**
     * EVENT: admin:get-all-locations
     * Get last known location of ALL users in the system
     * 
     * Payload: {} (empty)
     * 
     * Response Event: admin:all-locations
     */
    socket.on('admin:get-all-locations', async () => {
        try {
            // Get latest location for each user using aggregation
            const locations = await Location.aggregate([
                { $sort: { timestamp: -1 } },
                {
                    $group: {
                        _id: '$userID',
                        location: { $first: '$location' },
                        timestamp: { $first: '$timestamp' },
                        batteryLevel: { $first: '$batteryLevel' },
                        speed: { $first: '$speed' },
                        accuracy: { $first: '$accuracy' }
                    }
                },
                {
                    $lookup: {
                        from: 'users',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                { $unwind: '$user' },
                {
                    $project: {
                        userId: '$_id',
                        name: '$user.name',
                        email: '$user.email',
                        profilePicture: '$user.profilePicture',
                        phoneNumber: '$user.phoneNumber',
                        latitude: { $arrayElemAt: ['$location.coordinates', 1] },
                        longitude: { $arrayElemAt: ['$location.coordinates', 0] },
                        battery: '$batteryLevel',
                        speed: 1,
                        accuracy: 1,
                        timestamp: 1
                    }
                }
            ]);

            // Add online status
            const locationsWithStatus = locations.map(loc => ({
                ...loc,
                isOnline: onlineUsers.has(loc.userId.toString())
            }));

            socket.emit('admin:all-locations', {
                count: locationsWithStatus.length,
                users: locationsWithStatus
            });

        } catch (error) {
            console.error('Admin get all locations error:', error);
            socket.emit('error', {
                event: 'admin:get-all-locations',
                message: 'Failed to get all locations'
            });
        }
    });

    /**
     * EVENT: admin:get-user-location
     * Get specific user's location history
     * 
     * Payload:
     * {
     *   userId: string (required),
     *   limit: number (optional, default 50)
     * }
     * 
     * Response Event: admin:user-location-history
     */
    socket.on('admin:get-user-location', async (data) => {
        try {
            const { userId, limit = 50 } = data;

            if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
                socket.emit('error', {
                    event: 'admin:get-user-location',
                    message: 'Valid userId is required'
                });
                return;
            }

            const user = await User.findById(userId).select('name email profilePicture');
            
            if (!user) {
                socket.emit('error', {
                    event: 'admin:get-user-location',
                    message: 'User not found'
                });
                return;
            }

            const locations = await Location.find({ userID: userId })
                .sort({ timestamp: -1 })
                .limit(limit)
                .lean();

            const formattedLocations = locations.map(loc => ({
                latitude: loc.location.coordinates[1],
                longitude: loc.location.coordinates[0],
                battery: loc.batteryLevel,
                speed: loc.speed,
                timestamp: loc.timestamp
            }));

            socket.emit('admin:user-location-history', {
                user: {
                    id: userId,
                    name: user.name,
                    email: user.email,
                    profilePicture: user.profilePicture,
                    isOnline: onlineUsers.has(userId)
                },
                locations: formattedLocations
            });

        } catch (error) {
            console.error('Admin get user location error:', error);
            socket.emit('error', {
                event: 'admin:get-user-location',
                message: 'Failed to get user location'
            });
        }
    });

    /**
     * EVENT: admin:get-active-alerts
     * Get all active alerts in the system
     * 
     * Payload: {} (empty)
     * 
     * Response Event: admin:active-alerts
     */
    socket.on('admin:get-active-alerts', async () => {
        try {
            const alerts = await Alert.find({ status: 'active' })
                .populate('userID', 'name email phoneNumber profilePicture')
                .sort({ createdAt: -1 })
                .lean();

            const formattedAlerts = alerts.map(alert => ({
                alertId: alert._id.toString(),
                type: alert.alertType,
                severity: alert.severity,
                user: alert.userID ? {
                    id: alert.userID._id.toString(),
                    name: alert.userID.name,
                    email: alert.userID.email,
                    phone: alert.userID.phoneNumber
                } : null,
                location: alert.location ? {
                    latitude: alert.location.coordinates[1],
                    longitude: alert.location.coordinates[0]
                } : null,
                message: alert.description,
                createdAt: alert.createdAt
            }));

            socket.emit('admin:active-alerts', {
                count: formattedAlerts.length,
                alerts: formattedAlerts
            });

        } catch (error) {
            console.error('Admin get active alerts error:', error);
            socket.emit('error', {
                event: 'admin:get-active-alerts',
                message: 'Failed to get active alerts'
            });
        }
    });

    /**
     * EVENT: admin:resolve-alert
     * Resolve an alert as admin
     * 
     * Payload:
     * {
     *   alertId: string (required),
     *   notes: string (optional)
     * }
     * 
     * Response Event: admin:alert-resolved
     */
    socket.on('admin:resolve-alert', async (data) => {
        try {
            const { alertId, notes } = data;

            if (!alertId || !mongoose.Types.ObjectId.isValid(alertId)) {
                socket.emit('error', {
                    event: 'admin:resolve-alert',
                    message: 'Valid alertId is required'
                });
                return;
            }

            const alert = await Alert.findById(alertId);

            if (!alert) {
                socket.emit('error', {
                    event: 'admin:resolve-alert',
                    message: 'Alert not found'
                });
                return;
            }

            alert.status = 'resolved';
            alert.resolutionNotes = notes || `Resolved by admin: ${socket.user.name}`;
            alert.resolvedAt = new Date();
            await alert.save();

            // Notify the user whose alert was resolved
            userNamespace.to(`user:${alert.userID}`).emit('alert:resolved-by-admin', {
                alertId: alert._id.toString(),
                resolvedBy: socket.user.name,
                notes: alert.resolutionNotes
            });

            socket.emit('admin:alert-resolved', {
                alertId: alert._id.toString(),
                message: 'Alert resolved successfully'
            });

        } catch (error) {
            console.error('Admin resolve alert error:', error);
            socket.emit('error', {
                event: 'admin:resolve-alert',
                message: 'Failed to resolve alert'
            });
        }
    });

    /**
     * EVENT: admin:get-groups
     * Get all groups with member counts
     * 
     * Payload: {} (empty)
     * 
     * Response Event: admin:groups
     */
    socket.on('admin:get-groups', async () => {
        try {
            const groups = await Group.find({ isActive: true })
                .populate('createdBy', 'name email')
                .select('name description joinCode members createdAt')
                .lean();

            const formattedGroups = groups.map(group => ({
                id: group._id.toString(),
                name: group.name,
                description: group.description,
                joinCode: group.joinCode,
                memberCount: group.members?.length || 0,
                createdBy: group.createdBy ? {
                    id: group.createdBy._id.toString(),
                    name: group.createdBy.name
                } : null,
                createdAt: group.createdAt
            }));

            socket.emit('admin:groups', {
                count: formattedGroups.length,
                groups: formattedGroups
            });

        } catch (error) {
            console.error('Admin get groups error:', error);
            socket.emit('error', {
                event: 'admin:get-groups',
                message: 'Failed to get groups'
            });
        }
    });

    /**
     * EVENT: admin:get-group-locations
     * Get all members' locations for a specific group
     * 
     * Payload:
     * {
     *   groupId: string (required)
     * }
     * 
     * Response Event: admin:group-locations
     */
    socket.on('admin:get-group-locations', async (data) => {
        try {
            const { groupId } = data;

            if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
                socket.emit('error', {
                    event: 'admin:get-group-locations',
                    message: 'Valid groupId is required'
                });
                return;
            }

            const group = await Group.findById(groupId)
                .populate('members.userID', 'name email profilePicture phoneNumber')
                .lean();

            if (!group) {
                socket.emit('error', {
                    event: 'admin:get-group-locations',
                    message: 'Group not found'
                });
                return;
            }

            // Get locations for all members
            const memberLocations = await Promise.all(
                group.members.map(async (member) => {
                    if (!member.userID) return null;

                    const lastLocation = await Location.findOne({
                        userID: member.userID._id
                    }).sort({ timestamp: -1 });

                    return {
                        userId: member.userID._id.toString(),
                        name: member.userID.name,
                        email: member.userID.email,
                        phone: member.userID.phoneNumber,
                        role: member.role,
                        isOnline: onlineUsers.has(member.userID._id.toString()),
                        location: lastLocation ? {
                            latitude: lastLocation.location.coordinates[1],
                            longitude: lastLocation.location.coordinates[0],
                            battery: lastLocation.batteryLevel,
                            speed: lastLocation.speed,
                            timestamp: lastLocation.timestamp
                        } : null
                    };
                })
            );

            socket.emit('admin:group-locations', {
                group: {
                    id: group._id.toString(),
                    name: group.name
                },
                members: memberLocations.filter(m => m !== null)
            });

        } catch (error) {
            console.error('Admin get group locations error:', error);
            socket.emit('error', {
                event: 'admin:get-group-locations',
                message: 'Failed to get group locations'
            });
        }
    });

    /**
     * EVENT: admin:subscribe-user
     * Subscribe to a specific user's location updates
     * 
     * Payload:
     * {
     *   userId: string (required)
     * }
     */
    socket.on('admin:subscribe-user', (data) => {
        const { userId } = data;
        
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            socket.join(`track:${userId}`);
            socket.emit('admin:subscribed', { userId });
        }
    });

    /**
     * EVENT: admin:unsubscribe-user
     * Unsubscribe from a specific user's location updates
     * 
     * Payload:
     * {
     *   userId: string (required)
     * }
     */
    socket.on('admin:unsubscribe-user', (data) => {
        const { userId } = data;
        
        if (userId) {
            socket.leave(`track:${userId}`);
            socket.emit('admin:unsubscribed', { userId });
        }
    });
}
