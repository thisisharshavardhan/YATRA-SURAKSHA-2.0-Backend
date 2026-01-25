import admin from 'firebase-admin';
import User from '../../Models/user.model.js';

/**
 * Socket authentication middleware for regular users
 */
export async function socketAuth(socket, next) {
    try {
        const token = socket.handshake.auth?.token;

        if (!token) {
            return next(new Error('Authentication token required'));
        }

        // Verify Firebase token
        const decodedToken = await admin.auth().verifyIdToken(token);

        // Find user in database
        const user = await User.findOne({ firebaseUID: decodedToken.uid });

        if (!user) {
            return next(new Error('User not found. Please register first.'));
        }

        // Attach user to socket
        socket.user = {
            _id: user._id,
            id: user._id.toString(),
            firebaseUID: decodedToken.uid,
            name: user.name,
            email: user.email,
            role: user.role,
            profilePicture: user.profilePicture
        };

        next();
    } catch (error) {
        console.error('Socket auth error:', error.message);
        
        if (error.code === 'auth/id-token-expired') {
            return next(new Error('Token expired. Please login again.'));
        }
        
        next(new Error('Authentication failed'));
    }
}

/**
 * Socket authentication middleware for admin users
 */
export async function adminSocketAuth(socket, next) {
    try {
        const token = socket.handshake.auth?.token;

        if (!token) {
            return next(new Error('Authentication token required'));
        }

        // Verify Firebase token
        const decodedToken = await admin.auth().verifyIdToken(token);

        // Find user in database
        const user = await User.findOne({ firebaseUID: decodedToken.uid });

        if (!user) {
            return next(new Error('User not found'));
        }

        // Check if user is admin
        if (user.role !== 'admin') {
            return next(new Error('Admin access required'));
        }

        socket.user = {
            _id: user._id,
            id: user._id.toString(),
            firebaseUID: decodedToken.uid,
            name: user.name,
            email: user.email,
            role: user.role
        };

        next();
    } catch (error) {
        console.error('Admin socket auth error:', error.message);
        next(new Error('Admin authentication failed'));
    }
}

export default { socketAuth, adminSocketAuth };
