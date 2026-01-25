import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import connectDB from './Dbs/index.db.js';
import { errorHandler, notFoundHandler } from './Middlewares/error.middleware.js';
import swaggerSpec from './Configs/swagger.config.js';

// Import routes
import authRoutes from './Routes/auth.routes.js';
import userRoutes from './Routes/user.routes.js';
import locationRoutes from './Routes/location.routes.js';
import alertRoutes from './Routes/alert.routes.js';
import groupRoutes from './Routes/group.routes.js';
import geofenceRoutes from './Routes/geofence.routes.js';
import tripRoutes from './Routes/trip.routes.js';
import safetyScoreRoutes from './Routes/safetyScore.routes.js';

// Initialize Firebase
import './Configs/firebase.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: process.env.CORS === '*' ? '*' : process.env.CORS?.split(','),
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files (for test-auth.html)
app.use(express.static(join(__dirname, '../public')));

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Yatra Suraksha API Docs'
}));

// Swagger JSON endpoint (for tools like Postman)
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
        docs: '/api-docs'
    });
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

// 404 handler (after all routes)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        console.log(`API Docs: http://localhost:${PORT}/api-docs`);
    });
}).catch((error) => {
    console.error('Failed to connect to the database:', error);
});