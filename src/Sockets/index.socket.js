import { Server } from 'socket.io';
import { socketAuth, adminSocketAuth } from './utils/socketAuth.js';
import locationHandler from './handlers/location.handler.js';
import sosHandler from './handlers/sos.handler.js';
import adminHandler from './handlers/admin.handler.js';
import gptRealtimeHandler from './handlers/gptRealtime.handler.js';
import Group from '../Models/group.model.js';

// Store online users
const onlineUsers = new Map();
const adminSockets = new Set();

/**
 * Initialize Socket.IO server
 * @param {Server} httpServer - HTTP server instance
 * @returns {Server} Socket.IO server instance
 */
export function initializeSocket(httpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: process.env.CORS === '*' ? '*' : process.env.CORS?.split(','),
            credentials: true
        },
        pingTimeout: 60000,
        pingInterval: 25000
    });

    // User namespace - for mobile app users
    const userNamespace = io.of('/user');
    
    // Admin namespace - for admin dashboard
    const adminNamespace = io.of('/admin');

    // =====================
    // USER NAMESPACE
    // =====================
    userNamespace.use(socketAuth);

    userNamespace.on('connection', async (socket) => {
        const userId = socket.user._id.toString();
        
        // Track online user
        onlineUsers.set(userId, {
            socketId: socket.id,
            user: socket.user,
            connectedAt: new Date()
        });

        console.log(`User connected: ${socket.user.name} (${userId})`);

        // Auto-join user's groups
        await autoJoinGroups(socket);

        // Notify admins about new user
        adminNamespace.emit('user:online', {
            userId,
            name: socket.user.name,
            email: socket.user.email,
            connectedAt: new Date()
        });

        // Register handlers
        locationHandler(io, socket, userNamespace, adminNamespace, onlineUsers);
        sosHandler(io, socket, userNamespace, adminNamespace);
        gptRealtimeHandler(io, socket, userNamespace, adminNamespace);

        // Handle group refresh (call this after joining a group via REST API)
        socket.on('group:refresh', async () => {
            await autoJoinGroups(socket);
            socket.emit('group:refreshed', {
                success: true,
                groups: socket.joinedGroups,
                message: `Joined ${socket.joinedGroups.length} groups`
            });
        });

        // Send connection success
        socket.emit('connected', {
            userId,
            name: socket.user.name,
            message: 'Connected successfully'
        });

        // Handle disconnect
        socket.on('disconnect', (reason) => {
            onlineUsers.delete(userId);
            
            // Notify groups
            if (socket.joinedGroups) {
                socket.joinedGroups.forEach(groupId => {
                    socket.to(`group:${groupId}`).emit('member:offline', {
                        userId,
                        name: socket.user.name,
                        reason
                    });
                });
            }

            // Notify admins
            adminNamespace.emit('user:offline', {
                userId,
                name: socket.user.name,
                reason,
                disconnectedAt: new Date()
            });

            console.log(`User disconnected: ${socket.user.name} - ${reason}`);
        });
    });

    // =====================
    // ADMIN NAMESPACE
    // =====================
    adminNamespace.use(adminSocketAuth);

    adminNamespace.on('connection', (socket) => {
        console.log(`Admin connected: ${socket.user.name}`);
        adminSockets.add(socket.id);

        // Register admin handlers
        adminHandler(io, socket, userNamespace, onlineUsers);

        // Send current online users
        socket.emit('users:online', {
            count: onlineUsers.size,
            users: Array.from(onlineUsers.values()).map(u => ({
                userId: u.user._id.toString(),
                name: u.user.name,
                email: u.user.email,
                connectedAt: u.connectedAt
            }))
        });

        socket.on('disconnect', () => {
            adminSockets.delete(socket.id);
            console.log(`Admin disconnected: ${socket.user.name}`);
        });
    });

    // Attach helper methods
    io.getOnlineUsersCount = () => onlineUsers.size;
    io.getOnlineUsers = () => Array.from(onlineUsers.values());
    io.isUserOnline = (userId) => onlineUsers.has(userId);

    console.log('Socket.IO initialized');
    return io;
}

/**
 * Auto-join user to their group rooms
 */
async function autoJoinGroups(socket) {
    try {
        const groups = await Group.find({
            'members.userID': socket.user._id,
            isActive: true
        }).select('_id name');

        socket.joinedGroups = [];

        for (const group of groups) {
            socket.join(`group:${group._id}`);
            socket.joinedGroups.push(group._id.toString());

            // Notify group members
            socket.to(`group:${group._id}`).emit('member:online', {
                userId: socket.user._id.toString(),
                name: socket.user.name,
                groupId: group._id.toString(),
                groupName: group.name
            });
        }

        if (groups.length > 0) {
            console.log(`${socket.user.name} auto-joined ${groups.length} groups`);
        }
    } catch (error) {
        console.error('Auto-join groups error:', error);
    }
}

export default initializeSocket;
