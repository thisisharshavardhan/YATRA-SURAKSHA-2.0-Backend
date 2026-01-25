import admin from '../Configs/firebase.config.js';
import User from '../Models/user.model.js';

/**
 * Verify Firebase token only (no database lookup)
 */
export const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Authorization token required'
            });
        }

        const token = authHeader.split(' ')[1];

        // Verify Firebase token
        const decodedToken = await admin.auth().verifyIdToken(token);

        // Attach decoded token to request
        req.firebaseUser = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            emailVerified: decodedToken.email_verified,
            name: decodedToken.name,
            picture: decodedToken.picture
        };

        next();
    } catch (error) {
        console.error('Token verification error:', error.code);

        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({
                success: false,
                message: 'Token expired, please login again'
            });
        }

        if (error.code === 'auth/argument-error') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token format'
            });
        }

        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
};

/**
 * Verify token and fetch user from database
 */
export const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Authorization token required'
            });
        }

        const token = authHeader.split(' ')[1];

        // Verify Firebase token
        const decodedToken = await admin.auth().verifyIdToken(token);

        // Fetch user from database
        const user = await User.findOne({ firebaseUID: decodedToken.uid });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found. Please register first.'
            });
        }

        // Attach user to request
        req.user = user;
        req.firebaseUser = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            emailVerified: decodedToken.email_verified
        };

        next();
    } catch (error) {
        console.error('Authentication error:', error.code || error.message);

        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({
                success: false,
                message: 'Token expired, please login again'
            });
        }

        return res.status(401).json({
            success: false,
            message: 'Authentication failed'
        });
    }
};

/**
 * Check if user is admin
 */
export const isAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }

    next();
};

/**
 * Optional authentication - doesn't fail if no token
 */
export const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.split(' ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token);
        const user = await User.findOne({ firebaseUID: decodedToken.uid });

        if (user) {
            req.user = user;
            req.firebaseUser = {
                uid: decodedToken.uid,
                email: decodedToken.email
            };
        }

        next();
    } catch (error) {
        // Ignore errors, continue without user
        next();
    }
};

/**
 * Check if user account is verified
 */
export const checkVerified = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    if (!req.user.isVerified) {
        return res.status(403).json({
            success: false,
            message: 'Please verify your account first'
        });
    }

    next();
};
