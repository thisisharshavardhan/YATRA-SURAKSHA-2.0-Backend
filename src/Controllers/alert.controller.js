import mongoose from 'mongoose';
import Alert from '../Models/alert.model.js';
import User from '../Models/user.model.js';
import Location from '../Models/location.model.js';
import { asyncHandler, BadRequestError, NotFoundError, ForbiddenError } from '../Middlewares/error.middleware.js';

/**
 * @desc    Trigger SOS alert
 * @route   POST /api/alerts/sos
 * @access  Private
 */
export const triggerSOS = asyncHandler(async (req, res) => {
    const { longitude, latitude, description } = req.body;

    // Validate coordinates
    if (longitude === undefined || latitude === undefined) {
        throw new BadRequestError('Longitude and latitude are required');
    }

    // Create SOS alert
    const alert = await Alert.create({
        userID: req.user._id,
        location: {
            type: 'Point',
            coordinates: [longitude, latitude]
        },
        alertType: 'sos',
        severity: 'critical',
        status: 'active',
        description: description || 'SOS Alert Triggered by User'
    });

    // Also save location
    await Location.create({
        userID: req.user._id,
        location: {
            type: 'Point',
            coordinates: [longitude, latitude]
        },
        timestamp: new Date()
    });

    // Get user's emergency contacts for notification
    const user = await User.findById(req.user._id).select('name emergencyContacts phoneNumber profilePicture');

    // Emit to admin dashboard via WebSocket (sos:emergency event for frontend)
    const io = req.app.get('io');
    if (io) {
        io.emitToAdmins('sos:emergency', {
            alertId: alert._id,
            alert: alert,
            userId: req.user._id,
            user: {
                _id: req.user._id,
                name: user.name,
                phoneNumber: user.phoneNumber,
                profilePicture: user.profilePicture
            },
            location: {
                latitude,
                longitude
            },
            severity: 'critical',
            status: 'active',
            alertType: 'sos',
            description: alert.description,
            timestamp: alert.createdAt,
            createdAt: alert.createdAt,
            source: 'rest_api'
        });
    }

    // TODO: Send notifications to emergency contacts
    // This could be via SMS, Push Notification, or Email
    // For now, we'll return the contacts that would be notified

    res.status(201).json({
        success: true,
        message: 'SOS alert triggered successfully',
        data: {
            alert,
            user: {
                name: user.name,
                phoneNumber: user.phoneNumber
            },
            emergencyContacts: user.emergencyContacts || [],
            notificationSent: false // Will be true when notification service is implemented
        }
    });
});

/**
 * @desc    Trigger low battery alert
 * @route   POST /api/alerts/low-battery
 * @access  Private
 */
export const triggerLowBatteryAlert = asyncHandler(async (req, res) => {
    const { longitude, latitude, batteryLevel } = req.body;

    // Validate coordinates
    if (longitude === undefined || latitude === undefined) {
        throw new BadRequestError('Longitude and latitude are required');
    }

    if (batteryLevel === undefined) {
        throw new BadRequestError('Battery level is required');
    }

    // Determine severity based on battery level
    let severity = 'low';
    if (batteryLevel <= 5) {
        severity = 'critical';
    } else if (batteryLevel <= 10) {
        severity = 'high';
    } else if (batteryLevel <= 15) {
        severity = 'medium';
    }

    const alert = await Alert.create({
        userID: req.user._id,
        location: {
            type: 'Point',
            coordinates: [longitude, latitude]
        },
        alertType: 'low_battery',
        severity,
        status: 'active',
        description: `Battery critically low at ${batteryLevel}%`
    });

    // Save location as well
    await Location.create({
        userID: req.user._id,
        location: {
            type: 'Point',
            coordinates: [longitude, latitude]
        },
        batteryLevel,
        timestamp: new Date()
    });

    // Emit to admin dashboard via WebSocket (alert:low-battery event for frontend)
    const io = req.app.get('io');
    if (io) {
        io.emitToAdmins('alert:low-battery', {
            alertId: alert._id,
            alert: alert,
            userId: req.user._id,
            user: {
                _id: req.user._id,
                name: req.user.name
            },
            alertType: 'low_battery',
            location: { latitude, longitude },
            severity,
            status: 'active',
            batteryLevel,
            description: alert.description,
            timestamp: alert.createdAt,
            createdAt: alert.createdAt,
            source: 'rest_api'
        });
    }

    res.status(201).json({
        success: true,
        message: 'Low battery alert triggered',
        data: alert
    });
});

/**
 * @desc    Trigger geofence alert (enter restricted or exit safety zone)
 * @route   POST /api/alerts/geofence
 * @access  Private
 */
export const triggerGeofenceAlert = asyncHandler(async (req, res) => {
    const { longitude, latitude, geofenceId, geofenceName, alertType } = req.body;

    // Validate coordinates
    if (longitude === undefined || latitude === undefined) {
        throw new BadRequestError('Longitude and latitude are required');
    }

    // Validate alert type
    const validTypes = ['enter_restricted_geofence', 'exit_safety_geofence'];
    if (!alertType || !validTypes.includes(alertType)) {
        throw new BadRequestError('alertType must be "enter_restricted_geofence" or "exit_safety_geofence"');
    }

    const description = alertType === 'enter_restricted_geofence'
        ? `Entered restricted area${geofenceName ? `: ${geofenceName}` : ''}`
        : `Left safety zone${geofenceName ? `: ${geofenceName}` : ''}`;

    const alertData = {
        userID: req.user._id,
        location: {
            type: 'Point',
            coordinates: [longitude, latitude]
        },
        alertType,
        severity: 'high',
        status: 'active',
        description
    };

    // Add geofence reference if provided
    if (geofenceId) alertData.geofenceId = geofenceId;
    if (geofenceName) alertData.geofenceName = geofenceName;

    const alert = await Alert.create(alertData);

    // Save location as well
    await Location.create({
        userID: req.user._id,
        location: {
            type: 'Point',
            coordinates: [longitude, latitude]
        },
        timestamp: new Date()
    });

    // Get user's emergency contacts for notification
    const user = await User.findById(req.user._id).select('name emergencyContacts phoneNumber profilePicture');

    // Emit to admin dashboard via WebSocket (alert:geofence event for frontend)
    const io = req.app.get('io');
    if (io) {
        io.emitToAdmins('alert:geofence', {
            alertId: alert._id,
            alert: alert,
            userId: req.user._id,
            user: {
                _id: req.user._id,
                name: user.name,
                phoneNumber: user.phoneNumber,
                profilePicture: user.profilePicture
            },
            alertType,
            location: { latitude, longitude },
            severity: 'high',
            status: 'active',
            geofenceId,
            geofenceName,
            description: alert.description,
            timestamp: alert.createdAt,
            createdAt: alert.createdAt,
            source: 'rest_api'
        });
    }

    res.status(201).json({
        success: true,
        message: `Geofence alert triggered: ${alertType}`,
        data: {
            alert,
            geofenceId,
            geofenceName,
            user: {
                name: user.name,
                phoneNumber: user.phoneNumber
            },
            emergencyContacts: user.emergencyContacts || []
        }
    });
});

/**
 * @desc    Get my active alerts
 * @route   GET /api/alerts/me
 * @access  Private
 */
export const getMyAlerts = asyncHandler(async (req, res) => {
    const { status, alertType, limit = 20, page = 1 } = req.query;

    const query = { userID: req.user._id };

    if (status) query.status = status;
    if (alertType) query.alertType = alertType;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [alerts, total] = await Promise.all([
        Alert.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit)),
        Alert.countDocuments(query)
    ]);

    res.status(200).json({
        success: true,
        data: alerts,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    });
});

/**
 * @desc    Get alert by ID
 * @route   GET /api/alerts/:id
 * @access  Private
 */
export const getAlertById = asyncHandler(async (req, res) => {
    const alert = await Alert.findById(req.params.id)
        .populate('userID', 'name email phoneNumber profilePicture');

    if (!alert) {
        throw new NotFoundError('Alert not found');
    }

    // Only allow owner or admin to view
    if (alert.userID._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        throw new ForbiddenError('Not authorized to view this alert');
    }

    res.status(200).json({
        success: true,
        data: alert
    });
});

/**
 * @desc    Resolve/Cancel my alert
 * @route   PUT /api/alerts/:id/resolve
 * @access  Private
 */
export const resolveAlert = asyncHandler(async (req, res) => {
    const { status, resolutionNotes } = req.body;

    if (!status || !['resolved', 'cancelled'].includes(status)) {
        throw new BadRequestError('Status must be "resolved" or "cancelled"');
    }

    const alert = await Alert.findById(req.params.id);

    if (!alert) {
        throw new NotFoundError('Alert not found');
    }

    // Only owner can resolve their own alert
    if (alert.userID.toString() !== req.user._id.toString()) {
        throw new ForbiddenError('Not authorized to resolve this alert');
    }

    if (alert.status !== 'active') {
        throw new BadRequestError('Alert is already resolved or cancelled');
    }

    alert.status = status;
    alert.resolvedAt = new Date();
    alert.resolutionNotes = resolutionNotes || '';

    await alert.save();

    res.status(200).json({
        success: true,
        message: `Alert ${status} successfully`,
        data: alert
    });
});

/**
 * @desc    Get active alerts near a location (for responders/group members)
 * @route   GET /api/alerts/nearby
 * @access  Private
 */
export const getNearbyAlerts = asyncHandler(async (req, res) => {
    const {
        longitude,
        latitude,
        radius = 10000, // Default 10km
        limit = 20
    } = req.query;

    if (!longitude || !latitude) {
        throw new BadRequestError('Longitude and latitude are required');
    }

    const alerts = await Alert.aggregate([
        {
            $geoNear: {
                near: {
                    type: 'Point',
                    coordinates: [parseFloat(longitude), parseFloat(latitude)]
                },
                distanceField: 'distance',
                maxDistance: parseInt(radius),
                query: { status: 'active' },
                spherical: true
            }
        },
        {
            $sort: { severity: -1, distance: 1 } // Critical first, then by distance
        },
        {
            $limit: parseInt(limit)
        },
        {
            $lookup: {
                from: 'users',
                localField: 'userID',
                foreignField: '_id',
                as: 'user',
                pipeline: [
                    { $project: { name: 1, profilePicture: 1, phoneNumber: 1 } }
                ]
            }
        },
        {
            $unwind: '$user'
        }
    ]);

    res.status(200).json({
        success: true,
        data: alerts
    });
});

/**
 * @desc    Get alerts for users I'm connected to (emergency contact / group member)
 * @route   GET /api/alerts/contacts
 * @access  Private
 */
export const getContactsAlerts = asyncHandler(async (req, res) => {
    const { status = 'active' } = req.query;

    // TODO: Implement proper relationship check
    // For now, this is a placeholder that would need:
    // 1. Check which users have listed current user as emergency contact
    // 2. Check group memberships
    
    // Placeholder: Return empty for now until relationships are implemented
    res.status(200).json({
        success: true,
        data: [],
        message: 'Contact relationship check not yet implemented'
    });
});

/**
 * @desc    Get alert statistics for current user
 * @route   GET /api/alerts/stats
 * @access  Private
 */
export const getAlertStats = asyncHandler(async (req, res) => {
    const stats = await Alert.aggregate([
        {
            $match: { userID: req.user._id }
        },
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                active: {
                    $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                },
                resolved: {
                    $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
                },
                cancelled: {
                    $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
                },
                sosCount: {
                    $sum: { $cond: [{ $eq: ['$alertType', 'sos'] }, 1, 0] }
                },
                lowBatteryCount: {
                    $sum: { $cond: [{ $eq: ['$alertType', 'low_battery'] }, 1, 0] }
                },
                geofenceCount: {
                    $sum: {
                        $cond: [
                            { $in: ['$alertType', ['enter_restricted_geofence', 'exit_safety_geofence']] },
                            1,
                            0
                        ]
                    }
                }
            }
        }
    ]);

    res.status(200).json({
        success: true,
        data: stats[0] || {
            total: 0,
            active: 0,
            resolved: 0,
            cancelled: 0,
            sosCount: 0,
            lowBatteryCount: 0,
            geofenceCount: 0
        }
    });
});

/**
 * @desc    Admin: Get all alerts
 * @route   GET /api/alerts/admin/all
 * @access  Private (Admin only)
 */
export const getAllAlerts = asyncHandler(async (req, res) => {
    const {
        status,
        alertType,
        severity,
        startDate,
        endDate,
        limit = 50,
        page = 1
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (alertType) query.alertType = alertType;
    if (severity) query.severity = severity;

    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [alerts, total] = await Promise.all([
        Alert.find(query)
            .populate('userID', 'name email phoneNumber profilePicture')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit)),
        Alert.countDocuments(query)
    ]);

    res.status(200).json({
        success: true,
        data: alerts,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    });
});
