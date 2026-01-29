import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import swaggerUi from 'swagger-ui-express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import connectDB from './Dbs/index.db.js';
import { errorHandler, notFoundHandler } from './Middlewares/error.middleware.js';
import swaggerSpec from './Configs/swagger.config.js';
import { initializeSocket } from './Sockets/index.socket.js';

// Import routes
import authRoutes from './Routes/auth.routes.js';
import userRoutes from './Routes/user.routes.js';
import locationRoutes from './Routes/location.routes.js';
import alertRoutes from './Routes/alert.routes.js';
import groupRoutes from './Routes/group.routes.js';
import geofenceRoutes from './Routes/geofence.routes.js';
import tripRoutes from './Routes/trip.routes.js';
import safetyScoreRoutes from './Routes/safetyScore.routes.js';
import voiceAssistantRoutes from './Routes/voiceAssistant.routes.js';

// Initialize Firebase
import './Configs/firebase.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

let io = null;

// Middleware
app.use(cors({
    origin: process.env.CORS === '*' ? '*' : process.env.CORS?.split(','),
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(join(__dirname, '../public')));

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Yatra Suraksha API Docs'
}));

// Swagger JSON endpoint
app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});

// Health check
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Yatra Suraksha Backend is running!',
        timestamp: new Date().toISOString(),
        endpoints: {
            restApi: '/api-docs',
            socketDocs: '/socket-docs',
            voiceAssistant: '/voice-assistant',
            userSocket: 'ws://localhost:' + PORT + '/user',
            adminSocket: 'ws://localhost:' + PORT + '/admin'
        },
        stats: {
            onlineUsers: io?.getOnlineUsersCount?.() || 0
        }
    });
});

// Socket.IO Documentation
app.get('/socket-docs', (req, res) => {
    res.sendFile(join(__dirname, '../public/socket-docs.html'));
});

// Voice Assistant Demo Page
app.get('/voice-assistant', (req, res) => {
    res.sendFile(join(__dirname, '../public/voice-assistant.html'));
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/geofences', geofenceRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/safety-scores', safetyScoreRoutes);
app.use('/api/voice-assistant', voiceAssistantRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

connectDB().then(() => {
    io = initializeSocket(server);
    app.set('io', io);

    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`REST API Docs: http://localhost:${PORT}/api-docs`);
        console.log(`Socket.IO Docs: http://localhost:${PORT}/socket-docs`);
        console.log(`Voice Assistant: http://localhost:${PORT}/voice-assistant`);
        console.log(`User Socket: ws://localhost:${PORT}/user`);
        console.log(`Admin Socket: ws://localhost:${PORT}/admin`);
    });
}).catch((error) => {
    console.error('Database connection failed:', error);
});