import Geofence from '../Models/geofence.model.js';
import { asyncHandler, BadRequestError, NotFoundError, ForbiddenError } from '../Middlewares/error.middleware.js';

/**
 * @desc    Create a new geofence (Admin only)
 * @route   POST /api/geofences
 * @access  Private (Admin)
 */
export const createGeofence = asyncHandler(async (req, res) => {
    const { name, description, location, radius, fenceType } = req.body;

    // Validate required fields
    if (!name || !location || !radius || !fenceType) {
        throw new BadRequestError('Name, location, radius, and fenceType are required');
    }

    // Validate location format
    if (!location.coordinates || location.coordinates.length !== 2) {
        throw new BadRequestError('Location must have coordinates [longitude, latitude]');
    }

    const geofence = await Geofence.create({
        name: name.trim(),
        description: description?.trim(),
        location: {
            type: 'Point',
            coordinates: location.coordinates
        },
        radius,
        fenceType
    });

    res.status(201).json({
        success: true,
        message: 'Geofence created successfully',
        data: geofence
    });
});

/**
 * @desc    Get all geofences
 * @route   GET /api/geofences
 * @access  Private
 */
export const getAllGeofences = asyncHandler(async (req, res) => {
    const { fenceType, isActive, page = 1, limit = 50 } = req.query;

    const query = {};

    if (fenceType) {
        query.fenceType = fenceType;
    }

    if (isActive !== undefined) {
        query.isActive = isActive === 'true';
    } else {
        query.isActive = true; // Default to active geofences
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [geofences, total] = await Promise.all([
        Geofence.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit)),
        Geofence.countDocuments(query)
    ]);

    res.status(200).json({
        success: true,
        data: geofences,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    });
});

/**
 * @desc    Get geofence by ID
 * @route   GET /api/geofences/:id
 * @access  Private
 */
export const getGeofenceById = asyncHandler(async (req, res) => {
    const geofence = await Geofence.findById(req.params.id);

    if (!geofence) {
        throw new NotFoundError('Geofence not found');
    }

    res.status(200).json({
        success: true,
        data: geofence
    });
});

/**
 * @desc    Update geofence (Admin only)
 * @route   PUT /api/geofences/:id
 * @access  Private (Admin)
 */
export const updateGeofence = asyncHandler(async (req, res) => {
    const { name, description, location, radius, fenceType, isActive } = req.body;

    const geofence = await Geofence.findById(req.params.id);

    if (!geofence) {
        throw new NotFoundError('Geofence not found');
    }

    // Update fields
    if (name) geofence.name = name.trim();
    if (description !== undefined) geofence.description = description?.trim() || '';
    if (location?.coordinates) {
        geofence.location = {
            type: 'Point',
            coordinates: location.coordinates
        };
    }
    if (radius) geofence.radius = radius;
    if (fenceType) geofence.fenceType = fenceType;
    if (isActive !== undefined) geofence.isActive = isActive;

    await geofence.save();

    res.status(200).json({
        success: true,
        message: 'Geofence updated successfully',
        data: geofence
    });
});

/**
 * @desc    Delete geofence (Admin only)
 * @route   DELETE /api/geofences/:id
 * @access  Private (Admin)
 */
export const deleteGeofence = asyncHandler(async (req, res) => {
    const geofence = await Geofence.findById(req.params.id);

    if (!geofence) {
        throw new NotFoundError('Geofence not found');
    }

    // Soft delete
    geofence.isActive = false;
    await geofence.save();

    res.status(200).json({
        success: true,
        message: 'Geofence deleted successfully'
    });
});

/**
 * @desc    Get nearby geofences
 * @route   GET /api/geofences/nearby
 * @access  Private
 */
export const getNearbyGeofences = asyncHandler(async (req, res) => {
    const { longitude, latitude, maxDistance = 10000, fenceType } = req.query;

    if (!longitude || !latitude) {
        throw new BadRequestError('Longitude and latitude are required');
    }

    const lng = parseFloat(longitude);
    const lat = parseFloat(latitude);

    if (isNaN(lng) || isNaN(lat)) {
        throw new BadRequestError('Invalid coordinates');
    }

    const query = {
        location: {
            $nearSphere: {
                $geometry: {
                    type: 'Point',
                    coordinates: [lng, lat]
                },
                $maxDistance: parseInt(maxDistance)
            }
        },
        isActive: true
    };

    if (fenceType) {
        query.fenceType = fenceType;
    }

    const geofences = await Geofence.find(query).limit(50);

    res.status(200).json({
        success: true,
        data: geofences
    });
});

/**
 * @desc    Check if a point is inside any geofence
 * @route   POST /api/geofences/check
 * @access  Private
 */
export const checkGeofence = asyncHandler(async (req, res) => {
    const { longitude, latitude } = req.body;

    if (longitude === undefined || latitude === undefined) {
        throw new BadRequestError('Longitude and latitude are required');
    }

    const lng = parseFloat(longitude);
    const lat = parseFloat(latitude);

    if (isNaN(lng) || isNaN(lat)) {
        throw new BadRequestError('Invalid coordinates');
    }

    // Find all active geofences
    const geofences = await Geofence.find({ isActive: true });

    // Check which geofences contain this point
    const insideGeofences = geofences.filter(geofence => {
        const [geoLng, geoLat] = geofence.location.coordinates;
        
        // Calculate distance using Haversine formula
        const R = 6371000; // Earth's radius in meters
        const dLat = (lat - geoLat) * Math.PI / 180;
        const dLng = (lng - geoLng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(geoLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        return distance <= geofence.radius;
    });

    // Categorize by fence type
    const safetyZones = insideGeofences.filter(g => g.fenceType === 'safety');
    const restrictedZones = insideGeofences.filter(g => g.fenceType === 'restricted');

    res.status(200).json({
        success: true,
        data: {
            isInsideSafetyZone: safetyZones.length > 0,
            isInsideRestrictedZone: restrictedZones.length > 0,
            safetyZones: safetyZones.map(g => ({
                id: g.id,
                name: g.name,
                description: g.description
            })),
            restrictedZones: restrictedZones.map(g => ({
                id: g.id,
                name: g.name,
                description: g.description
            }))
        }
    });
});

/**
 * @desc    Get geofence statistics (Admin only)
 * @route   GET /api/geofences/stats
 * @access  Private (Admin)
 */
export const getGeofenceStats = asyncHandler(async (req, res) => {
    const stats = await Geofence.aggregate([
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                active: {
                    $sum: { $cond: ['$isActive', 1, 0] }
                },
                inactive: {
                    $sum: { $cond: ['$isActive', 0, 1] }
                },
                safetyZones: {
                    $sum: { $cond: [{ $eq: ['$fenceType', 'safety'] }, 1, 0] }
                },
                restrictedZones: {
                    $sum: { $cond: [{ $eq: ['$fenceType', 'restricted'] }, 1, 0] }
                }
            }
        }
    ]);

    res.status(200).json({
        success: true,
        data: stats[0] || {
            total: 0,
            active: 0,
            inactive: 0,
            safetyZones: 0,
            restrictedZones: 0
        }
    });
});
