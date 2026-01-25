import Location from '../Models/location.model.js';
import User from '../Models/user.model.js';
import { asyncHandler, BadRequestError, NotFoundError } from '../Middlewares/error.middleware.js';

/**
 * @desc    Update current location (single point)
 * @route   POST /api/locations
 * @access  Private
 */
export const updateLocation = asyncHandler(async (req, res) => {
    const {
        longitude,
        latitude,
        altitude,
        speed,
        heading,
        accuracy,
        batteryLevel,
        isCharging
    } = req.body;

    // Validate required fields
    if (longitude === undefined || latitude === undefined) {
        throw new BadRequestError('Longitude and latitude are required');
    }

    // Validate coordinate ranges
    if (longitude < -180 || longitude > 180) {
        throw new BadRequestError('Longitude must be between -180 and 180');
    }
    if (latitude < -90 || latitude > 90) {
        throw new BadRequestError('Latitude must be between -90 and 90');
    }

    const location = await Location.create({
        userID: req.user._id,
        location: {
            type: 'Point',
            coordinates: [longitude, latitude]
        },
        altitude,
        speed,
        heading,
        accuracy,
        batteryLevel,
        isCharging,
        timestamp: new Date()
    });

    res.status(201).json({
        success: true,
        message: 'Location updated successfully',
        data: location
    });
});

/**
 * @desc    Batch update locations (for offline sync)
 * @route   POST /api/locations/batch
 * @access  Private
 */
export const batchUpdateLocations = asyncHandler(async (req, res) => {
    const { locations } = req.body;

    if (!Array.isArray(locations) || locations.length === 0) {
        throw new BadRequestError('Locations array is required');
    }

    if (locations.length > 100) {
        throw new BadRequestError('Maximum 100 locations per batch');
    }

    // Validate and format locations
    const formattedLocations = locations.map((loc, index) => {
        if (loc.longitude === undefined || loc.latitude === undefined) {
            throw new BadRequestError(`Location at index ${index} missing longitude or latitude`);
        }

        return {
            userID: req.user._id,
            location: {
                type: 'Point',
                coordinates: [loc.longitude, loc.latitude]
            },
            altitude: loc.altitude,
            speed: loc.speed,
            heading: loc.heading,
            accuracy: loc.accuracy,
            batteryLevel: loc.batteryLevel,
            isCharging: loc.isCharging,
            timestamp: loc.timestamp ? new Date(loc.timestamp) : new Date()
        };
    });

    const result = await Location.insertMany(formattedLocations, { ordered: false });

    res.status(201).json({
        success: true,
        message: `${result.length} locations saved successfully`,
        data: {
            count: result.length
        }
    });
});

/**
 * @desc    Get current user's latest location
 * @route   GET /api/locations/me
 * @access  Private
 */
export const getMyLocation = asyncHandler(async (req, res) => {
    const location = await Location.findOne({ userID: req.user._id })
        .sort({ timestamp: -1 });

    if (!location) {
        throw new NotFoundError('No location data found');
    }

    res.status(200).json({
        success: true,
        data: location
    });
});

/**
 * @desc    Get current user's location history
 * @route   GET /api/locations/history
 * @access  Private
 */
export const getMyLocationHistory = asyncHandler(async (req, res) => {
    const {
        startDate,
        endDate,
        limit = 100,
        page = 1
    } = req.query;

    const query = { userID: req.user._id };

    // Date range filter
    if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [locations, total] = await Promise.all([
        Location.find(query)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(parseInt(limit)),
        Location.countDocuments(query)
    ]);

    res.status(200).json({
        success: true,
        data: locations,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    });
});

/**
 * @desc    Get another user's latest location (for group members/emergency contacts)
 * @route   GET /api/locations/user/:userId
 * @access  Private (requires permission check)
 */
export const getUserLocation = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    // Check if the target user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
        throw new NotFoundError('User not found');
    }

    // TODO: Add permission check - verify current user has access to this user's location
    // This could be checked via:
    // 1. Same group membership
    // 2. Emergency contact relationship
    // 3. Explicit location sharing permission

    // Check if target user allows location sharing
    if (!targetUser.permissions?.allowLocationAccess) {
        throw new BadRequestError('User has disabled location sharing');
    }

    const location = await Location.findOne({ userID: userId })
        .sort({ timestamp: -1 });

    if (!location) {
        throw new NotFoundError('No location data found for this user');
    }

    res.status(200).json({
        success: true,
        data: {
            user: {
                id: targetUser._id,
                name: targetUser.name,
                profilePicture: targetUser.profilePicture
            },
            location
        }
    });
});

/**
 * @desc    Get locations of multiple users (for group tracking)
 * @route   POST /api/locations/users
 * @access  Private
 */
export const getMultipleUsersLocations = asyncHandler(async (req, res) => {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
        throw new BadRequestError('userIds array is required');
    }

    if (userIds.length > 50) {
        throw new BadRequestError('Maximum 50 users per request');
    }

    // Get latest location for each user using aggregation
    const locations = await Location.aggregate([
        {
            $match: {
                userID: { $in: userIds.map(id => new mongoose.Types.ObjectId(id)) }
            }
        },
        {
            $sort: { timestamp: -1 }
        },
        {
            $group: {
                _id: '$userID',
                location: { $first: '$location' },
                altitude: { $first: '$altitude' },
                speed: { $first: '$speed' },
                heading: { $first: '$heading' },
                accuracy: { $first: '$accuracy' },
                batteryLevel: { $first: '$batteryLevel' },
                isCharging: { $first: '$isCharging' },
                timestamp: { $first: '$timestamp' }
            }
        }
    ]);

    // Get user info for each location
    const userIdsWithLocation = locations.map(loc => loc._id);
    const users = await User.find({ _id: { $in: userIdsWithLocation } })
        .select('name profilePicture');

    const userMap = users.reduce((acc, user) => {
        acc[user._id.toString()] = user;
        return acc;
    }, {});

    const result = locations.map(loc => ({
        user: userMap[loc._id.toString()] || { id: loc._id },
        location: loc.location,
        altitude: loc.altitude,
        speed: loc.speed,
        heading: loc.heading,
        accuracy: loc.accuracy,
        batteryLevel: loc.batteryLevel,
        isCharging: loc.isCharging,
        timestamp: loc.timestamp
    }));

    res.status(200).json({
        success: true,
        data: result
    });
});

/**
 * @desc    Find users near a location
 * @route   GET /api/locations/nearby
 * @access  Private
 */
export const findNearbyUsers = asyncHandler(async (req, res) => {
    const {
        longitude,
        latitude,
        radius = 5000, // Default 5km in meters
        limit = 20
    } = req.query;

    if (!longitude || !latitude) {
        throw new BadRequestError('Longitude and latitude are required');
    }

    const lng = parseFloat(longitude);
    const lat = parseFloat(latitude);
    const maxDistance = parseInt(radius);

    // Find latest location per user within radius
    const nearbyLocations = await Location.aggregate([
        {
            $geoNear: {
                near: {
                    type: 'Point',
                    coordinates: [lng, lat]
                },
                distanceField: 'distance',
                maxDistance: maxDistance,
                spherical: true
            }
        },
        {
            $sort: { timestamp: -1 }
        },
        {
            $group: {
                _id: '$userID',
                location: { $first: '$location' },
                distance: { $first: '$distance' },
                timestamp: { $first: '$timestamp' },
                batteryLevel: { $first: '$batteryLevel' }
            }
        },
        {
            $match: {
                _id: { $ne: req.user._id } // Exclude current user
            }
        },
        {
            $sort: { distance: 1 }
        },
        {
            $limit: parseInt(limit)
        }
    ]);

    // Get user info
    const userIds = nearbyLocations.map(loc => loc._id);
    const users = await User.find({ 
        _id: { $in: userIds },
        'permissions.allowLocationAccess': true // Only users who allow location sharing
    }).select('name profilePicture');

    const userMap = users.reduce((acc, user) => {
        acc[user._id.toString()] = user;
        return acc;
    }, {});

    const result = nearbyLocations
        .filter(loc => userMap[loc._id.toString()]) // Only include users who allow sharing
        .map(loc => ({
            user: userMap[loc._id.toString()],
            location: loc.location,
            distance: Math.round(loc.distance), // Distance in meters
            timestamp: loc.timestamp,
            batteryLevel: loc.batteryLevel
        }));

    res.status(200).json({
        success: true,
        data: result
    });
});

/**
 * @desc    Delete location history (for privacy)
 * @route   DELETE /api/locations/history
 * @access  Private
 */
export const deleteLocationHistory = asyncHandler(async (req, res) => {
    const { before } = req.query;

    const query = { userID: req.user._id };

    if (before) {
        query.timestamp = { $lt: new Date(before) };
    }

    const result = await Location.deleteMany(query);

    res.status(200).json({
        success: true,
        message: `${result.deletedCount} location records deleted`,
        data: {
            deletedCount: result.deletedCount
        }
    });
});

// Import mongoose for ObjectId in aggregation
import mongoose from 'mongoose';
