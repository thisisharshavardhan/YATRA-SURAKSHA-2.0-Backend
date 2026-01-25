import User from '../Models/user.model.js';
import admin from '../Configs/firebase.config.js';
import { asyncHandler, BadRequestError, ConflictError, NotFoundError } from '../Middlewares/error.middleware.js';

/**
 * @desc    Register/Login user with Firebase token
 * @route   POST /api/auth/login
 * @access  Public (requires Firebase token)
 */
export const loginOrRegister = asyncHandler(async (req, res) => {
    const { uid, email, name, picture, email_verified } = req.firebaseUser;

    // Check if user exists
    let user = await User.findOne({ firebaseUID: uid });
    let isNewUser = false;

    if (!user) {
        // Check if email already exists with different provider
        const existingEmailUser = await User.findOne({ email: email.toLowerCase() });
        
        if (existingEmailUser) {
            // Link Firebase to existing account
            existingEmailUser.firebaseUID = uid;
            if (!existingEmailUser.providers.includes('firebase')) {
                existingEmailUser.providers.push('firebase');
            }
            existingEmailUser.lastLogin = new Date();
            if (email_verified) {
                existingEmailUser.isVerified = true;
            }
            user = await existingEmailUser.save();
        } else {
            // Create new user
            user = await User.create({
                firebaseUID: uid,
                providers: ['firebase'],
                email: email.toLowerCase(),
                name: name || email.split('@')[0],
                profilePicture: picture || null,
                isVerified: email_verified || false,
                lastLogin: new Date()
            });
            isNewUser = true;
        }
    } else {
        // Update last login
        user.lastLogin = new Date();
        if (email_verified && !user.isVerified) {
            user.isVerified = true;
        }
        await user.save();
    }

    res.status(isNewUser ? 201 : 200).json({
        success: true,
        message: isNewUser ? 'User registered successfully' : 'Login successful',
        data: {
            user,
            isNewUser
        }
    });
});

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = asyncHandler(async (req, res) => {
    res.status(200).json({
        success: true,
        data: req.user
    });
});

/**
 * @desc    Check if user exists (for client-side flow)
 * @route   GET /api/auth/check
 * @access  Public (requires Firebase token)
 */
export const checkUser = asyncHandler(async (req, res) => {
    const { uid } = req.firebaseUser;
    
    const user = await User.findOne({ firebaseUID: uid });

    res.status(200).json({
        success: true,
        data: {
            exists: !!user,
            user: user || null
        }
    });
});

/**
 * @desc    Logout user (optional - mainly for tracking)
 * @route   POST /api/auth/logout
 * @access  Private
 */
export const logout = asyncHandler(async (req, res) => {
    // Update last activity if needed
    // Firebase handles token invalidation on client side

    res.status(200).json({
        success: true,
        message: 'Logout successful'
    });
});

/**
 * @desc    Delete user account
 * @route   DELETE /api/auth/account
 * @access  Private
 */
export const deleteAccount = asyncHandler(async (req, res) => {
    const user = req.user;

    // Delete from MongoDB
    await User.findByIdAndDelete(user._id);

    // Optionally delete from Firebase
    try {
        await admin.auth().deleteUser(req.firebaseUser.uid);
    } catch (error) {
        console.error('Failed to delete Firebase user:', error.message);
        // Continue even if Firebase deletion fails
    }

    res.status(200).json({
        success: true,
        message: 'Account deleted successfully'
    });
});
