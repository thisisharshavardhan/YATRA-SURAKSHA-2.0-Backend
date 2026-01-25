import SafetyScore from '../Models/safetyScore.model.js';
import { asyncHandler, BadRequestError, NotFoundError } from '../Middlewares/error.middleware.js';

/**
 * @desc    Create a new safety score entry
 * @route   POST /api/safety-scores
 * @access  Private (Admin)
 */
export const createSafetyScore = asyncHandler(async (req, res) => {
    const { name, location, population, populationDensity, crimeRate, safetyScore, safetyRank, riskLevel } = req.body;

    // Validate required fields
    if (!name || !location || safetyScore === undefined || !riskLevel) {
        throw new BadRequestError('name, location, safetyScore, and riskLevel are required');
    }

    // Validate location format
    if (!location.coordinates || location.coordinates.length !== 2) {
        throw new BadRequestError('Location must have coordinates [longitude, latitude]');
    }

    const entry = await SafetyScore.create({
        name: name.trim(),
        location: {
            type: 'Point',
            coordinates: location.coordinates
        },
        population,
        populationDensity,
        crimeRate,
        safetyScore,
        safetyRank,
        riskLevel
    });

    res.status(201).json({
        success: true,
        message: 'Safety score created successfully',
        data: entry
    });
});

/**
 * @desc    Get all safety scores
 * @route   GET /api/safety-scores
 * @access  Private
 */
export const getAllSafetyScores = asyncHandler(async (req, res) => {
    const { 
        riskLevel, 
        minScore, 
        maxScore, 
        search,
        sortBy = 'safetyScore',
        order = 'desc',
        page = 1, 
        limit = 50 
    } = req.query;

    const query = {};

    // Filter by risk level
    if (riskLevel) {
        query.riskLevel = riskLevel;
    }

    // Filter by score range
    if (minScore || maxScore) {
        query.safetyScore = {};
        if (minScore) query.safetyScore.$gte = parseFloat(minScore);
        if (maxScore) query.safetyScore.$lte = parseFloat(maxScore);
    }

    // Text search
    if (search) {
        query.$text = { $search: search };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = order === 'asc' ? 1 : -1;

    const [scores, total] = await Promise.all([
        SafetyScore.find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit)),
        SafetyScore.countDocuments(query)
    ]);

    res.status(200).json({
        success: true,
        data: scores,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    });
});

/**
 * @desc    Get safety score by ID
 * @route   GET /api/safety-scores/:id
 * @access  Private
 */
export const getSafetyScoreById = asyncHandler(async (req, res) => {
    const score = await SafetyScore.findById(req.params.id);

    if (!score) {
        throw new NotFoundError('Safety score not found');
    }

    res.status(200).json({
        success: true,
        data: score
    });
});

/**
 * @desc    Update safety score
 * @route   PUT /api/safety-scores/:id
 * @access  Private (Admin)
 */
export const updateSafetyScore = asyncHandler(async (req, res) => {
    const { name, location, population, populationDensity, crimeRate, safetyScore, safetyRank, riskLevel } = req.body;

    const score = await SafetyScore.findById(req.params.id);

    if (!score) {
        throw new NotFoundError('Safety score not found');
    }

    // Update fields
    if (name) score.name = name.trim();
    if (location?.coordinates) {
        score.location = {
            type: 'Point',
            coordinates: location.coordinates
        };
    }
    if (population !== undefined) score.population = population;
    if (populationDensity !== undefined) score.populationDensity = populationDensity;
    if (crimeRate !== undefined) score.crimeRate = crimeRate;
    if (safetyScore !== undefined) score.safetyScore = safetyScore;
    if (safetyRank !== undefined) score.safetyRank = safetyRank;
    if (riskLevel) score.riskLevel = riskLevel;
    
    score.lastUpdated = new Date();

    await score.save();

    res.status(200).json({
        success: true,
        message: 'Safety score updated successfully',
        data: score
    });
});

/**
 * @desc    Get safety score for a location (nearby)
 * @route   GET /api/safety-scores/nearby
 * @access  Private
 */
export const getNearbySafetyScore = asyncHandler(async (req, res) => {
    const { longitude, latitude, maxDistance = 50000 } = req.query;

    if (!longitude || !latitude) {
        throw new BadRequestError('Longitude and latitude are required');
    }

    const lng = parseFloat(longitude);
    const lat = parseFloat(latitude);

    if (isNaN(lng) || isNaN(lat)) {
        throw new BadRequestError('Invalid coordinates');
    }

    const scores = await SafetyScore.find({
        location: {
            $nearSphere: {
                $geometry: {
                    type: 'Point',
                    coordinates: [lng, lat]
                },
                $maxDistance: parseInt(maxDistance)
            }
        }
    }).limit(10);

    res.status(200).json({
        success: true,
        data: scores
    });
});
