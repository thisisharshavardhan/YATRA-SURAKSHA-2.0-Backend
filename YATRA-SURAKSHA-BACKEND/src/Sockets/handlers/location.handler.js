import mongoose from 'mongoose';
import Location from '../../Models/location.model.js';
import Group from '../../Models/group.model.js';

/**
 * Location handler for real-time location sharing
 */
export default function locationHandler(io, socket, userNamespace, adminNamespace, onlineUsers) {
    
    /**
     * EVENT: location:update
     * Update user's location - broadcasts to group members and admins
     * 
     * Payload:
     * {
     *   latitude: number (required),
     *   longitude: number (required),
     *   altitude: number (optional),
     *   speed: number (optional),
     *   accuracy: number (optional),
     *   heading: number (optional),
     *   battery: number (optional)
     * }
     * 
     * Response Events:
     * - location:updated (to sender) - confirmation
     * - location:broadcast (to group members) - location data
     * - user:location (to admins) - location data with user info
     */
    socket.on('location:update', async (data) => {
        try {
            const { latitude, longitude, altitude, speed, accuracy, heading, battery } = data;

            // Validate required fields
            if (latitude === undefined || longitude === undefined) {
                socket.emit('error', { 
                    event: 'location:update',
                    message: 'latitude and longitude are required' 
                });
                return;
            }

            // Save to database
            const location = await Location.create({
                userID: socket.user._id,
                location: {
                    type: 'Point',
                    coordinates: [longitude, latitude]
                },
                altitude,
                speed,
                accuracy,
                heading,
                batteryLevel: battery,
                source: 'app'
            });

            // Prepare broadcast data
            const locationData = {
                userId: socket.user.id,
                name: socket.user.name,
                profilePicture: socket.user.profilePicture,
                latitude,
                longitude,
                altitude,
                speed,
                accuracy,
                heading,
                battery,
                timestamp: location.timestamp
            };

            // Broadcast to all user's groups
            if (socket.joinedGroups) {
                socket.joinedGroups.forEach(groupId => {
                    socket.to(`group:${groupId}`).emit('location:broadcast', {
                        ...locationData,
                        groupId
                    });
                });
            }

            // Send to all admins
            adminNamespace.emit('user:location', locationData);

            // Confirm to sender
            socket.emit('location:updated', {
                success: true,
                timestamp: location.timestamp
            });

        } catch (error) {
            console.error('Location update error:', error);
            socket.emit('error', { 
                event: 'location:update',
                message: 'Failed to update location' 
            });
        }
    });

    /**
     * EVENT: location:get-group
     * Get all group members' last known locations
     * 
     * Payload:
     * {
     *   groupId: string (required) - MongoDB ObjectId
     * }
     * 
     * Response Event: location:group-members
     */
    socket.on('location:get-group', async (data) => {
        try {
            const { groupId } = data;

            if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
                socket.emit('error', { 
                    event: 'location:get-group',
                    message: 'Valid groupId is required' 
                });
                return;
            }

            // Verify user is member of group
            const group = await Group.findOne({
                _id: groupId,
                'members.userID': socket.user._id,
                isActive: true
            }).populate('members.userID', 'name email profilePicture');

            if (!group) {
                socket.emit('error', { 
                    event: 'location:get-group',
                    message: 'Group not found or access denied' 
                });
                return;
            }

            // Get last location for each member
            const memberLocations = await Promise.all(
                group.members.map(async (member) => {
                    if (!member.userID) return null;

                    const lastLocation = await Location.findOne({
                        userID: member.userID._id
                    }).sort({ timestamp: -1 });

                    const isOnline = onlineUsers.has(member.userID._id.toString());

                    return {
                        userId: member.userID._id.toString(),
                        name: member.userID.name,
                        email: member.userID.email,
                        profilePicture: member.userID.profilePicture,
                        role: member.role,
                        isOnline,
                        location: lastLocation ? {
                            latitude: lastLocation.location.coordinates[1],
                            longitude: lastLocation.location.coordinates[0],
                            speed: lastLocation.speed,
                            battery: lastLocation.batteryLevel,
                            timestamp: lastLocation.timestamp
                        } : null
                    };
                })
            );

            socket.emit('location:group-members', {
                groupId,
                groupName: group.name,
                members: memberLocations.filter(m => m !== null)
            });

        } catch (error) {
            console.error('Get group locations error:', error);
            socket.emit('error', { 
                event: 'location:get-group',
                message: 'Failed to get group locations' 
            });
        }
    });

    /**
     * EVENT: location:stop
     * Notify group members that user stopped sharing location
     * 
     * Payload: {} (empty)
     * 
     * Response Event: location:stopped (to group members)
     */
    socket.on('location:stop', async () => {
        try {
            if (socket.joinedGroups) {
                socket.joinedGroups.forEach(groupId => {
                    socket.to(`group:${groupId}`).emit('location:stopped', {
                        userId: socket.user.id,
                        name: socket.user.name,
                        timestamp: new Date()
                    });
                });
            }

            // Notify admins
            adminNamespace.emit('user:location-stopped', {
                userId: socket.user.id,
                name: socket.user.name,
                timestamp: new Date()
            });

            socket.emit('location:stop-confirmed', { success: true });

        } catch (error) {
            console.error('Location stop error:', error);
        }
    });
}
