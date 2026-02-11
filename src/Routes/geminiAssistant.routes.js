import { Router } from 'express';
import { authenticate } from '../Middlewares/auth.middleware.js';
import {
    getAssistantContext,
    getLocationSafetyInfo,
    chatWithAssistant,
    getSessionStatus,
    getEmergencyInfo,
    getTravelTips
} from '../Controllers/geminiAssistant.controller.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Gemini Voice Assistant
 *   description: Gemini 2.5 Flash AI-powered voice assistant with real-time context
 */

/**
 * @swagger
 * /api/gemini-assistant/context:
 *   get:
 *     summary: Get Gemini AI assistant context for current user
 *     description: Returns user information, location, safety data, trips, and alerts for AI context
 *     tags: [Gemini Voice Assistant]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Context data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                     location:
 *                       type: object
 *                     safetyInfo:
 *                       type: object
 *                     activeTrips:
 *                       type: array
 *                     recentAlerts:
 *                       type: array
 *       401:
 *         description: Unauthorized
 */
router.get('/context', authenticate, getAssistantContext);

/**
 * @swagger
 * /api/gemini-assistant/safety-info:
 *   get:
 *     summary: Get safety information for a specific location
 *     description: Returns safety score, risk level, and crime data for given coordinates
 *     tags: [Gemini Voice Assistant]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema:
 *           type: number
 *         description: Longitude coordinate
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema:
 *           type: number
 *         description: Latitude coordinate
 *     responses:
 *       200:
 *         description: Safety information retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     safetyScore:
 *                       type: number
 *                     riskLevel:
 *                       type: string
 *                     crimeRate:
 *                       type: number
 *       400:
 *         description: Invalid coordinates
 *       401:
 *         description: Unauthorized
 */
router.get('/safety-info', authenticate, getLocationSafetyInfo);

/**
 * @swagger
 * /api/gemini-assistant/chat:
 *   post:
 *     summary: Send text message to Gemini AI assistant
 *     description: Get context for chat. Use WebSocket for real-time voice interaction.
 *     tags: [Gemini Voice Assistant]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: User's message
 *               longitude:
 *                 type: number
 *                 description: Optional current longitude
 *               latitude:
 *                 type: number
 *                 description: Optional current latitude
 *     responses:
 *       200:
 *         description: Chat context returned
 *       400:
 *         description: Message required
 *       401:
 *         description: Unauthorized
 */
router.post('/chat', authenticate, chatWithAssistant);

/**
 * @swagger
 * /api/gemini-assistant/session:
 *   get:
 *     summary: Get current Gemini voice session status
 *     description: Check if user has an active Gemini-realtime session
 *     tags: [Gemini Voice Assistant]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Session status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     hasActiveSession:
 *                       type: boolean
 *                     sessionInfo:
 *                       type: object
 *       401:
 *         description: Unauthorized
 */
router.get('/session', authenticate, getSessionStatus);

/**
 * @swagger
 * /api/gemini-assistant/emergency-info:
 *   get:
 *     summary: Get emergency information based on location
 *     description: Returns emergency numbers, user's emergency contacts, and safety tips
 *     tags: [Gemini Voice Assistant]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: longitude
 *         schema:
 *           type: number
 *         description: Optional longitude (uses last known location if not provided)
 *       - in: query
 *         name: latitude
 *         schema:
 *           type: number
 *         description: Optional latitude (uses last known location if not provided)
 *     responses:
 *       200:
 *         description: Emergency information retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     emergencyNumbers:
 *                       type: object
 *                     userEmergencyContacts:
 *                       type: array
 *                     healthInfo:
 *                       type: object
 *                     tips:
 *                       type: array
 *       401:
 *         description: Unauthorized
 */
router.get('/emergency-info', authenticate, getEmergencyInfo);

/**
 * @swagger
 * /api/gemini-assistant/travel-tips:
 *   get:
 *     summary: Get travel tips for current location
 *     description: Returns contextual travel safety tips based on location risk level
 *     tags: [Gemini Voice Assistant]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: longitude
 *         schema:
 *           type: number
 *         description: Optional longitude
 *       - in: query
 *         name: latitude
 *         schema:
 *           type: number
 *         description: Optional latitude
 *     responses:
 *       200:
 *         description: Travel tips retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     location:
 *                       type: object
 *                     areaInfo:
 *                       type: object
 *                     tips:
 *                       type: array
 *       401:
 *         description: Unauthorized
 */
router.get('/travel-tips', authenticate, getTravelTips);

export default router;
