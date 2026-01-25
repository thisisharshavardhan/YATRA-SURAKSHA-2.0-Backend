import TripItinerary from '../Models/tripIterinery.model.js';
import { asyncHandler, BadRequestError, NotFoundError, ForbiddenError } from '../Middlewares/error.middleware.js';

/**
 * @desc    Create a new trip
 * @route   POST /api/trips
 * @access  Private
 */
export const createTrip = asyncHandler(async (req, res) => {
    const { tripName, startLocation, endLocation, startDate, endDate } = req.body;

    // Validate required fields
    if (!tripName || !startLocation || !endLocation || !startDate || !endDate) {
        throw new BadRequestError('tripName, startLocation, endLocation, startDate, and endDate are required');
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new BadRequestError('Invalid date format');
    }

    if (end < start) {
        throw new BadRequestError('End date must be after start date');
    }

    // Validate location format
    if (!startLocation.coordinates || startLocation.coordinates.length !== 2) {
        throw new BadRequestError('startLocation must have coordinates [longitude, latitude]');
    }

    if (!endLocation.coordinates || endLocation.coordinates.length !== 2) {
        throw new BadRequestError('endLocation must have coordinates [longitude, latitude]');
    }

    const trip = await TripItinerary.create({
        userID: req.user._id,
        tripName: tripName.trim(),
        startLocation: {
            type: 'Point',
            coordinates: startLocation.coordinates
        },
        endLocation: {
            type: 'Point',
            coordinates: endLocation.coordinates
        },
        startDate: start,
        endDate: end,
        status: 'planned'
    });

    res.status(201).json({
        success: true,
        message: 'Trip created successfully',
        data: trip
    });
});

/**
 * @desc    Get all my trips
 * @route   GET /api/trips
 * @access  Private
 */
export const getMyTrips = asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;

    const query = { userID: req.user._id };

    if (status) {
        query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [trips, total] = await Promise.all([
        TripItinerary.find(query)
            .sort({ startDate: -1 })
            .skip(skip)
            .limit(parseInt(limit)),
        TripItinerary.countDocuments(query)
    ]);

    res.status(200).json({
        success: true,
        data: trips,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    });
});

/**
 * @desc    Get trip by ID
 * @route   GET /api/trips/:id
 * @access  Private
 */
export const getTripById = asyncHandler(async (req, res) => {
    const trip = await TripItinerary.findById(req.params.id)
        .populate('userID', 'name email profilePicture');

    if (!trip) {
        throw new NotFoundError('Trip not found');
    }

    // Only owner can view their trip
    if (trip.userID._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        throw new ForbiddenError('You can only view your own trips');
    }

    res.status(200).json({
        success: true,
        data: trip
    });
});

/**
 * @desc    Update trip
 * @route   PUT /api/trips/:id
 * @access  Private
 */
export const updateTrip = asyncHandler(async (req, res) => {
    const { tripName, startLocation, endLocation, startDate, endDate } = req.body;

    const trip = await TripItinerary.findById(req.params.id);

    if (!trip) {
        throw new NotFoundError('Trip not found');
    }

    // Only owner can update
    if (trip.userID.toString() !== req.user._id.toString()) {
        throw new ForbiddenError('You can only update your own trips');
    }

    // Don't allow updating completed or cancelled trips
    if (trip.status === 'completed' || trip.status === 'cancelled') {
        throw new BadRequestError('Cannot update a completed or cancelled trip');
    }

    // Update fields
    if (tripName) trip.tripName = tripName.trim();
    
    if (startLocation?.coordinates) {
        trip.startLocation = {
            type: 'Point',
            coordinates: startLocation.coordinates
        };
    }
    
    if (endLocation?.coordinates) {
        trip.endLocation = {
            type: 'Point',
            coordinates: endLocation.coordinates
        };
    }
    
    if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
            throw new BadRequestError('Invalid start date format');
        }
        trip.startDate = start;
    }
    
    if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
            throw new BadRequestError('Invalid end date format');
        }
        trip.endDate = end;
    }

    // Validate date order
    if (trip.endDate < trip.startDate) {
        throw new BadRequestError('End date must be after start date');
    }

    await trip.save();

    res.status(200).json({
        success: true,
        message: 'Trip updated successfully',
        data: trip
    });
});

/**
 * @desc    Update trip status
 * @route   PUT /api/trips/:id/status
 * @access  Private
 */
export const updateTripStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;

    if (!status || !['planned', 'ongoing', 'completed', 'cancelled'].includes(status)) {
        throw new BadRequestError('Valid status required: planned, ongoing, completed, or cancelled');
    }

    const trip = await TripItinerary.findById(req.params.id);

    if (!trip) {
        throw new NotFoundError('Trip not found');
    }

    // Only owner can update status
    if (trip.userID.toString() !== req.user._id.toString()) {
        throw new ForbiddenError('You can only update your own trips');
    }

    // Validate status transitions
    const validTransitions = {
        planned: ['ongoing', 'cancelled'],
        ongoing: ['completed', 'cancelled'],
        completed: [],
        cancelled: []
    };

    if (!validTransitions[trip.status].includes(status)) {
        throw new BadRequestError(`Cannot change status from ${trip.status} to ${status}`);
    }

    trip.status = status;
    await trip.save();

    res.status(200).json({
        success: true,
        message: `Trip status updated to ${status}`,
        data: trip
    });
});

/**
 * @desc    Start a trip (change status to ongoing)
 * @route   POST /api/trips/:id/start
 * @access  Private
 */
export const startTrip = asyncHandler(async (req, res) => {
    const trip = await TripItinerary.findById(req.params.id);

    if (!trip) {
        throw new NotFoundError('Trip not found');
    }

    if (trip.userID.toString() !== req.user._id.toString()) {
        throw new ForbiddenError('You can only start your own trips');
    }

    if (trip.status !== 'planned') {
        throw new BadRequestError('Only planned trips can be started');
    }

    trip.status = 'ongoing';
    await trip.save();

    res.status(200).json({
        success: true,
        message: 'Trip started',
        data: trip
    });
});

/**
 * @desc    Complete a trip
 * @route   POST /api/trips/:id/complete
 * @access  Private
 */
export const completeTrip = asyncHandler(async (req, res) => {
    const trip = await TripItinerary.findById(req.params.id);

    if (!trip) {
        throw new NotFoundError('Trip not found');
    }

    if (trip.userID.toString() !== req.user._id.toString()) {
        throw new ForbiddenError('You can only complete your own trips');
    }

    if (trip.status !== 'ongoing') {
        throw new BadRequestError('Only ongoing trips can be completed');
    }

    trip.status = 'completed';
    await trip.save();

    res.status(200).json({
        success: true,
        message: 'Trip completed',
        data: trip
    });
});

/**
 * @desc    Cancel a trip
 * @route   POST /api/trips/:id/cancel
 * @access  Private
 */
export const cancelTrip = asyncHandler(async (req, res) => {
    const trip = await TripItinerary.findById(req.params.id);

    if (!trip) {
        throw new NotFoundError('Trip not found');
    }

    if (trip.userID.toString() !== req.user._id.toString()) {
        throw new ForbiddenError('You can only cancel your own trips');
    }

    if (trip.status === 'completed' || trip.status === 'cancelled') {
        throw new BadRequestError('Trip is already completed or cancelled');
    }

    trip.status = 'cancelled';
    await trip.save();

    res.status(200).json({
        success: true,
        message: 'Trip cancelled',
        data: trip
    });
});

/**
 * @desc    Delete a trip
 * @route   DELETE /api/trips/:id
 * @access  Private
 */
export const deleteTrip = asyncHandler(async (req, res) => {
    const trip = await TripItinerary.findById(req.params.id);

    if (!trip) {
        throw new NotFoundError('Trip not found');
    }

    if (trip.userID.toString() !== req.user._id.toString()) {
        throw new ForbiddenError('You can only delete your own trips');
    }

    // Only allow deleting planned or cancelled trips
    if (trip.status === 'ongoing') {
        throw new BadRequestError('Cannot delete an ongoing trip. Cancel it first.');
    }

    await TripItinerary.findByIdAndDelete(req.params.id);

    res.status(200).json({
        success: true,
        message: 'Trip deleted successfully'
    });
});

/**
 * @desc    Get upcoming trips
 * @route   GET /api/trips/upcoming
 * @access  Private
 */
export const getUpcomingTrips = asyncHandler(async (req, res) => {
    const now = new Date();

    const trips = await TripItinerary.find({
        userID: req.user._id,
        status: 'planned',
        startDate: { $gte: now }
    })
    .sort({ startDate: 1 })
    .limit(10);

    res.status(200).json({
        success: true,
        data: trips
    });
});

/**
 * @desc    Get active trip (currently ongoing)
 * @route   GET /api/trips/active
 * @access  Private
 */
export const getActiveTrip = asyncHandler(async (req, res) => {
    const trip = await TripItinerary.findOne({
        userID: req.user._id,
        status: 'ongoing'
    });

    res.status(200).json({
        success: true,
        data: trip
    });
});

/**
 * @desc    Get trip statistics
 * @route   GET /api/trips/stats
 * @access  Private
 */
export const getTripStats = asyncHandler(async (req, res) => {
    const stats = await TripItinerary.aggregate([
        {
            $match: { userID: req.user._id }
        },
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                planned: {
                    $sum: { $cond: [{ $eq: ['$status', 'planned'] }, 1, 0] }
                },
                ongoing: {
                    $sum: { $cond: [{ $eq: ['$status', 'ongoing'] }, 1, 0] }
                },
                completed: {
                    $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                },
                cancelled: {
                    $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
                }
            }
        }
    ]);

    res.status(200).json({
        success: true,
        data: stats[0] || {
            total: 0,
            planned: 0,
            ongoing: 0,
            completed: 0,
            cancelled: 0
        }
    });
});
