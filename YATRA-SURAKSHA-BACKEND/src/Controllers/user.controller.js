import User from '../Models/user.model.js';
import { asyncHandler, BadRequestError, NotFoundError } from '../Middlewares/error.middleware.js';

/**
 * @desc    Get user profile
 * @route   GET /api/users/profile
 * @access  Private
 */
export const getProfile = asyncHandler(async (req, res) => {
    res.status(200).json({
        success: true,
        data: req.user
    });
});

/**
 * @desc    Update user profile
 * @route   PUT /api/users/profile
 * @access  Private
 */
export const updateProfile = asyncHandler(async (req, res) => {
    const allowedFields = [
        'name',
        'phoneNumber',
        'alternativePhoneNumber',
        'whatsappNumber',
        'dateOfBirth',
        'profilePicture',
        'nationality',
        'gender'
    ];

    // Filter only allowed fields
    const updates = {};
    allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
            updates[field] = req.body[field];
        }
    });

    if (Object.keys(updates).length === 0) {
        throw new BadRequestError('No valid fields to update');
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        updates,
        { new: true, runValidators: true }
    );

    res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: user
    });
});

/**
 * @desc    Update emergency contacts
 * @route   PUT /api/users/emergency-contacts
 * @access  Private
 */
export const updateEmergencyContacts = asyncHandler(async (req, res) => {
    const { emergencyContacts } = req.body;

    if (!Array.isArray(emergencyContacts)) {
        throw new BadRequestError('Emergency contacts must be an array');
    }

    // Validate each contact
    for (const contact of emergencyContacts) {
        if (!contact.name || !contact.relation || !contact.phoneNumber) {
            throw new BadRequestError('Each contact must have name, relation, and phoneNumber');
        }
    }

    // Limit to 5 emergency contacts
    if (emergencyContacts.length > 5) {
        throw new BadRequestError('Maximum 5 emergency contacts allowed');
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        { emergencyContacts },
        { new: true, runValidators: true }
    );

    res.status(200).json({
        success: true,
        message: 'Emergency contacts updated successfully',
        data: user.emergencyContacts
    });
});

/**
 * @desc    Update health information
 * @route   PUT /api/users/health-info
 * @access  Private
 */
export const updateHealthInfo = asyncHandler(async (req, res) => {
    const { bloodGroup, allergies, chronicDiseases, medications } = req.body;

    const healthInfo = {};
    
    if (bloodGroup !== undefined) healthInfo.bloodGroup = bloodGroup;
    if (allergies !== undefined) healthInfo.allergies = allergies;
    if (chronicDiseases !== undefined) healthInfo.chronicDiseases = chronicDiseases;
    if (medications !== undefined) healthInfo.medications = medications;

    const user = await User.findByIdAndUpdate(
        req.user._id,
        { healthInfo },
        { new: true, runValidators: true }
    );

    res.status(200).json({
        success: true,
        message: 'Health information updated successfully',
        data: user.healthInfo
    });
});

/**
 * @desc    Update user permissions
 * @route   PUT /api/users/permissions
 * @access  Private
 */
export const updatePermissions = asyncHandler(async (req, res) => {
    const { allowLocationAccess, allowNotificationAccess, allowSmsAccess } = req.body;

    const permissions = {};
    
    if (allowLocationAccess !== undefined) permissions.allowLocationAccess = allowLocationAccess;
    if (allowNotificationAccess !== undefined) permissions.allowNotificationAccess = allowNotificationAccess;
    if (allowSmsAccess !== undefined) permissions.allowSmsAccess = allowSmsAccess;

    const user = await User.findByIdAndUpdate(
        req.user._id,
        { permissions },
        { new: true, runValidators: true }
    );

    res.status(200).json({
        success: true,
        message: 'Permissions updated successfully',
        data: user.permissions
    });
});

/**
 * @desc    Get user by ID (for viewing other users in group)
 * @route   GET /api/users/:id
 * @access  Private
 */
export const getUserById = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id)
        .select('name email profilePicture isVerified');

    if (!user) {
        throw new NotFoundError('User not found');
    }

    res.status(200).json({
        success: true,
        data: user
    });
});

/**
 * @desc    Search users by email or phone (for adding to group/emergency contacts)
 * @route   GET /api/users/search?q=email@example.com
 * @access  Private
 */
export const searchUsers = asyncHandler(async (req, res) => {
    const { q } = req.query;

    if (!q || q.length < 3) {
        throw new BadRequestError('Search query must be at least 3 characters');
    }

    const users = await User.find({
        $or: [
            { email: { $regex: q, $options: 'i' } },
            { phoneNumber: { $regex: q, $options: 'i' } }
        ],
        _id: { $ne: req.user._id } // Exclude current user
    })
    .select('name email phoneNumber profilePicture')
    .limit(10);

    res.status(200).json({
        success: true,
        data: users
    });
});
