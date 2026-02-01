import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import Location from '../../Models/location.model.js';
import User from '../../Models/user.model.js';
import Alert from '../../Models/alert.model.js';
import Group from '../../Models/group.model.js';
import Video from '../../Models/video.model.js';

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

            // Broadcast to ALL admins (including sender) that alert is resolved
            io.of('/admin').emit('alert:resolved', {
                alertId: alert._id.toString(),
                alert: alert,
                resolvedBy: socket.user.name,
                resolvedAt: alert.resolvedAt,
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

    // ==================== VIDEO EVENTS ====================

    /**
     * EVENT: admin:get-all-videos
     * Get all videos in the system with optional filters
     * 
     * Payload:
     * {
     *   page: number (optional, default 1),
     *   limit: number (optional, default 20, max 100),
     *   userId: string (optional) - filter by user,
     *   alertId: string (optional) - filter by alert,
     *   sortBy: string (optional) - 'createdAt', 'fileSize', 'duration',
     *   order: string (optional) - 'asc' or 'desc'
     * }
     * 
     * Response Event: admin:all-videos
     */
    socket.on('admin:get-all-videos', async (data = {}) => {
        try {
            const {
                page = 1,
                limit = 20,
                userId,
                alertId,
                sortBy = 'createdAt',
                order = 'desc'
            } = data;

            const query = {};
            
            if (userId && mongoose.Types.ObjectId.isValid(userId)) {
                query.userID = userId;
            }
            if (alertId && mongoose.Types.ObjectId.isValid(alertId)) {
                query.relatedAlertID = alertId;
            }

            const skip = (parseInt(page) - 1) * parseInt(limit);
            const sortOrder = order === 'asc' ? 1 : -1;
            const sortField = ['createdAt', 'fileSize', 'duration'].includes(sortBy) ? sortBy : 'createdAt';

            const [videos, total] = await Promise.all([
                Video.find(query)
                    .populate('userID', 'name email profilePicture phoneNumber')
                    .populate('relatedAlertID', 'alertType severity status')
                    .sort({ [sortField]: sortOrder })
                    .skip(skip)
                    .limit(Math.min(parseInt(limit), 100))
                    .lean(),
                Video.countDocuments(query)
            ]);

            const formattedVideos = videos.map(video => ({
                id: video._id.toString(),
                videoURL: video.videoURL,
                thumbnailURL: video.thumbnailURL,
                fileSize: video.fileSize,
                fileSizeMB: video.fileSize ? (video.fileSize / (1024 * 1024)).toFixed(2) : null,
                duration: video.duration,
                mimeType: video.mimeType,
                user: video.userID ? {
                    id: video.userID._id.toString(),
                    name: video.userID.name,
                    email: video.userID.email,
                    profilePicture: video.userID.profilePicture
                } : null,
                relatedAlert: video.relatedAlertID ? {
                    id: video.relatedAlertID._id.toString(),
                    type: video.relatedAlertID.alertType,
                    severity: video.relatedAlertID.severity,
                    status: video.relatedAlertID.status
                } : null,
                createdAt: video.createdAt,
                updatedAt: video.updatedAt
            }));

            socket.emit('admin:all-videos', {
                videos: formattedVideos,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            });

        } catch (error) {
            console.error('Admin get all videos error:', error);
            socket.emit('error', {
                event: 'admin:get-all-videos',
                message: 'Failed to get videos'
            });
        }
    });

    /**
     * EVENT: admin:get-video
     * Get a specific video by ID
     * 
     * Payload:
     * {
     *   videoId: string (required)
     * }
     * 
     * Response Event: admin:video-details
     */
    socket.on('admin:get-video', async (data) => {
        try {
            const { videoId } = data;

            if (!videoId || !mongoose.Types.ObjectId.isValid(videoId)) {
                socket.emit('error', {
                    event: 'admin:get-video',
                    message: 'Valid videoId is required'
                });
                return;
            }

            const video = await Video.findById(videoId)
                .populate('userID', 'name email profilePicture phoneNumber')
                .populate('relatedAlertID', 'alertType severity status description createdAt')
                .lean();

            if (!video) {
                socket.emit('error', {
                    event: 'admin:get-video',
                    message: 'Video not found'
                });
                return;
            }

            socket.emit('admin:video-details', {
                id: video._id.toString(),
                videoURL: video.videoURL,
                thumbnailURL: video.thumbnailURL,
                fileSize: video.fileSize,
                fileSizeMB: video.fileSize ? (video.fileSize / (1024 * 1024)).toFixed(2) : null,
                duration: video.duration,
                mimeType: video.mimeType,
                user: video.userID ? {
                    id: video.userID._id.toString(),
                    name: video.userID.name,
                    email: video.userID.email,
                    phone: video.userID.phoneNumber,
                    profilePicture: video.userID.profilePicture
                } : null,
                relatedAlert: video.relatedAlertID ? {
                    id: video.relatedAlertID._id.toString(),
                    type: video.relatedAlertID.alertType,
                    severity: video.relatedAlertID.severity,
                    status: video.relatedAlertID.status,
                    description: video.relatedAlertID.description,
                    createdAt: video.relatedAlertID.createdAt
                } : null,
                createdAt: video.createdAt,
                updatedAt: video.updatedAt
            });

        } catch (error) {
            console.error('Admin get video error:', error);
            socket.emit('error', {
                event: 'admin:get-video',
                message: 'Failed to get video'
            });
        }
    });

    /**
     * EVENT: admin:get-videos-by-user
     * Get all videos for a specific user
     * 
     * Payload:
     * {
     *   userId: string (required),
     *   page: number (optional),
     *   limit: number (optional)
     * }
     * 
     * Response Event: admin:user-videos
     */
    socket.on('admin:get-videos-by-user', async (data) => {
        try {
            const { userId, page = 1, limit = 20 } = data;

            if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
                socket.emit('error', {
                    event: 'admin:get-videos-by-user',
                    message: 'Valid userId is required'
                });
                return;
            }

            const user = await User.findById(userId).select('name email profilePicture');
            
            if (!user) {
                socket.emit('error', {
                    event: 'admin:get-videos-by-user',
                    message: 'User not found'
                });
                return;
            }

            const skip = (parseInt(page) - 1) * parseInt(limit);

            const [videos, total] = await Promise.all([
                Video.find({ userID: userId })
                    .populate('relatedAlertID', 'alertType severity status')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(parseInt(limit))
                    .lean(),
                Video.countDocuments({ userID: userId })
            ]);

            socket.emit('admin:user-videos', {
                user: {
                    id: userId,
                    name: user.name,
                    email: user.email,
                    profilePicture: user.profilePicture
                },
                videos: videos.map(v => ({
                    id: v._id.toString(),
                    videoURL: v.videoURL,
                    thumbnailURL: v.thumbnailURL,
                    fileSize: v.fileSize,
                    duration: v.duration,
                    mimeType: v.mimeType,
                    relatedAlert: v.relatedAlertID ? {
                        id: v.relatedAlertID._id.toString(),
                        type: v.relatedAlertID.alertType,
                        severity: v.relatedAlertID.severity
                    } : null,
                    createdAt: v.createdAt
                })),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            });

        } catch (error) {
            console.error('Admin get videos by user error:', error);
            socket.emit('error', {
                event: 'admin:get-videos-by-user',
                message: 'Failed to get user videos'
            });
        }
    });

    /**
     * EVENT: admin:get-videos-by-alert
     * Get all videos associated with an alert
     * 
     * Payload:
     * {
     *   alertId: string (required)
     * }
     * 
     * Response Event: admin:alert-videos
     */
    socket.on('admin:get-videos-by-alert', async (data) => {
        try {
            const { alertId } = data;

            if (!alertId || !mongoose.Types.ObjectId.isValid(alertId)) {
                socket.emit('error', {
                    event: 'admin:get-videos-by-alert',
                    message: 'Valid alertId is required'
                });
                return;
            }

            const alert = await Alert.findById(alertId)
                .populate('userID', 'name email')
                .lean();

            const videos = await Video.find({ relatedAlertID: alertId })
                .sort({ createdAt: -1 })
                .lean();

            socket.emit('admin:alert-videos', {
                alert: alert ? {
                    id: alert._id.toString(),
                    type: alert.alertType,
                    severity: alert.severity,
                    status: alert.status,
                    user: alert.userID ? {
                        id: alert.userID._id.toString(),
                        name: alert.userID.name
                    } : null,
                    createdAt: alert.createdAt
                } : null,
                videos: videos.map(v => ({
                    id: v._id.toString(),
                    videoURL: v.videoURL,
                    thumbnailURL: v.thumbnailURL,
                    fileSize: v.fileSize,
                    duration: v.duration,
                    mimeType: v.mimeType,
                    createdAt: v.createdAt
                })),
                count: videos.length
            });

        } catch (error) {
            console.error('Admin get videos by alert error:', error);
            socket.emit('error', {
                event: 'admin:get-videos-by-alert',
                message: 'Failed to get alert videos'
            });
        }
    });

    /**
     * EVENT: admin:get-video-stats
     * Get video statistics across the system
     * 
     * Payload: {} (empty)
     * 
     * Response Event: admin:video-stats
     */
    socket.on('admin:get-video-stats', async () => {
        try {
            const stats = await Video.aggregate([
                {
                    $group: {
                        _id: null,
                        totalVideos: { $sum: 1 },
                        totalSize: { $sum: '$fileSize' },
                        totalDuration: { $sum: '$duration' },
                        avgSize: { $avg: '$fileSize' },
                        avgDuration: { $avg: '$duration' },
                        videosWithAlerts: {
                            $sum: { $cond: [{ $ne: ['$relatedAlertID', null] }, 1, 0] }
                        }
                    }
                }
            ]);

            const byMimeType = await Video.aggregate([
                {
                    $group: {
                        _id: '$mimeType',
                        count: { $sum: 1 },
                        totalSize: { $sum: '$fileSize' }
                    }
                },
                {
                    $project: {
                        mimeType: '$_id',
                        count: 1,
                        totalSize: 1,
                        totalSizeMB: { $divide: ['$totalSize', 1048576] }
                    }
                }
            ]);

            const byUser = await Video.aggregate([
                {
                    $group: {
                        _id: '$userID',
                        count: { $sum: 1 },
                        totalSize: { $sum: '$fileSize' }
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
                        count: 1,
                        totalSize: 1,
                        totalSizeMB: { $divide: ['$totalSize', 1048576] }
                    }
                },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]);

            const summary = stats[0] || {
                totalVideos: 0,
                totalSize: 0,
                totalDuration: 0,
                avgSize: 0,
                avgDuration: 0,
                videosWithAlerts: 0
            };

            socket.emit('admin:video-stats', {
                summary: {
                    ...summary,
                    totalSizeMB: (summary.totalSize / (1024 * 1024)).toFixed(2),
                    totalSizeGB: (summary.totalSize / (1024 * 1024 * 1024)).toFixed(2),
                    avgSizeMB: summary.avgSize ? (summary.avgSize / (1024 * 1024)).toFixed(2) : 0
                },
                byMimeType,
                topUsersByVideos: byUser
            });

        } catch (error) {
            console.error('Admin get video stats error:', error);
            socket.emit('error', {
                event: 'admin:get-video-stats',
                message: 'Failed to get video statistics'
            });
        }
    });

    /**
     * EVENT: admin:delete-video
     * Delete a video (file and database record)
     * 
     * Payload:
     * {
     *   videoId: string (required)
     * }
     * 
     * Response Event: admin:video-deleted
     */
    socket.on('admin:delete-video', async (data) => {
        try {
            const { videoId } = data;

            if (!videoId || !mongoose.Types.ObjectId.isValid(videoId)) {
                socket.emit('error', {
                    event: 'admin:delete-video',
                    message: 'Valid videoId is required'
                });
                return;
            }

            const video = await Video.findById(videoId);

            if (!video) {
                socket.emit('error', {
                    event: 'admin:delete-video',
                    message: 'Video not found'
                });
                return;
            }

            // Delete files from filesystem
            const deleteFile = (filePath) => {
                if (filePath) {
                    const fullPath = path.join(process.cwd(), filePath.startsWith('/') ? filePath.slice(1) : filePath);
                    if (fs.existsSync(fullPath)) {
                        fs.unlinkSync(fullPath);
                    }
                }
            };

            deleteFile(video.videoURL);
            deleteFile(video.thumbnailURL);

            // Delete from database
            await Video.findByIdAndDelete(videoId);

            // Broadcast to all admins
            io.of('/admin').emit('admin:video-deleted', {
                videoId,
                deletedBy: socket.user?.name || 'Admin'
            });

        } catch (error) {
            console.error('Admin delete video error:', error);
            socket.emit('error', {
                event: 'admin:delete-video',
                message: 'Failed to delete video'
            });
        }
    });

    /**
     * EVENT: admin:bulk-delete-videos
     * Delete multiple videos at once
     * 
     * Payload:
     * {
     *   videoIds: string[] (required)
     * }
     * 
     * Response Event: admin:videos-bulk-deleted
     */
    socket.on('admin:bulk-delete-videos', async (data) => {
        try {
            const { videoIds } = data;

            if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
                socket.emit('error', {
                    event: 'admin:bulk-delete-videos',
                    message: 'videoIds array is required'
                });
                return;
            }

            const validIds = videoIds.filter(id => mongoose.Types.ObjectId.isValid(id));
            const videos = await Video.find({ _id: { $in: validIds } });

            let deletedCount = 0;
            const errors = [];

            for (const video of videos) {
                try {
                    // Delete files
                    const deleteFile = (filePath) => {
                        if (filePath) {
                            const fullPath = path.join(process.cwd(), filePath.startsWith('/') ? filePath.slice(1) : filePath);
                            if (fs.existsSync(fullPath)) {
                                fs.unlinkSync(fullPath);
                            }
                        }
                    };

                    deleteFile(video.videoURL);
                    deleteFile(video.thumbnailURL);

                    await Video.findByIdAndDelete(video._id);
                    deletedCount++;
                } catch (err) {
                    errors.push({ videoId: video._id.toString(), error: err.message });
                }
            }

            // Broadcast to all admins
            io.of('/admin').emit('admin:videos-bulk-deleted', {
                requestedCount: videoIds.length,
                deletedCount,
                errors: errors.length > 0 ? errors : undefined,
                deletedBy: socket.user?.name || 'Admin'
            });

        } catch (error) {
            console.error('Admin bulk delete videos error:', error);
            socket.emit('error', {
                event: 'admin:bulk-delete-videos',
                message: 'Failed to delete videos'
            });
        }
    });

    /**
     * EVENT: admin:cleanup-orphaned-videos
     * Find and delete video records where the actual file doesn't exist
     * 
     * Payload: 
     * {
     *   dryRun: boolean (optional, default true) - if true, only reports orphans without deleting
     * }
     * 
     * Response Event: admin:orphaned-videos-cleaned
     */
    socket.on('admin:cleanup-orphaned-videos', async (data = {}) => {
        try {
            const { dryRun = true } = data;
            
            const allVideos = await Video.find({}).lean();
            const orphanedVideos = [];
            
            for (const video of allVideos) {
                let fileExists = false;
                
                if (video.videoURL) {
                    const videoPath = path.join(process.cwd(), video.videoURL.startsWith('/') ? video.videoURL.slice(1) : video.videoURL);
                    fileExists = fs.existsSync(videoPath);
                }
                
                if (!fileExists) {
                    orphanedVideos.push({
                        id: video._id.toString(),
                        videoURL: video.videoURL,
                        userID: video.userID?.toString(),
                        createdAt: video.createdAt
                    });
                }
            }
            
            let deletedCount = 0;
            
            if (!dryRun && orphanedVideos.length > 0) {
                // Actually delete orphaned records
                const orphanedIds = orphanedVideos.map(v => v.id);
                const result = await Video.deleteMany({ _id: { $in: orphanedIds } });
                deletedCount = result.deletedCount;
            }
            
            socket.emit('admin:orphaned-videos-cleaned', {
                dryRun,
                totalVideos: allVideos.length,
                orphanedCount: orphanedVideos.length,
                deletedCount,
                orphanedVideos: orphanedVideos.slice(0, 50), // Limit response size
                message: dryRun 
                    ? `Found ${orphanedVideos.length} orphaned video records. Set dryRun: false to delete them.`
                    : `Deleted ${deletedCount} orphaned video records.`
            });

        } catch (error) {
            console.error('Admin cleanup orphaned videos error:', error);
            socket.emit('error', {
                event: 'admin:cleanup-orphaned-videos',
                message: 'Failed to cleanup orphaned videos'
            });
        }
    });
}
