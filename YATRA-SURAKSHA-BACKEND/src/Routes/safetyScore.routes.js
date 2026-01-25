import { Router } from 'express';
import {
    createSafetyScore,
    getAllSafetyScores,
    getSafetyScoreById,
    updateSafetyScore,
    getNearbySafetyScore
} from '../Controllers/safetyScore.controller.js';
import { authenticate, isAdmin } from '../Middlewares/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/safety-scores:
 *   post:
 *     summary: Create a new safety score entry
 *     description: Add a new location with safety score data. Admin only.
 *     tags: [Safety Scores]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - location
 *               - safetyScore
 *               - riskLevel
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Mumbai, Maharashtra"
 *               location:
 *                 type: object
 *                 properties:
 *                   coordinates:
 *                     type: array
 *                     items:
 *                       type: number
 *                     example: [72.8777, 19.0760]
 *               population:
 *                 type: number
 *                 example: 12442373
 *               populationDensity:
 *                 type: number
 *                 example: 20680
 *               crimeRate:
 *                 type: number
 *                 example: 156.2
 *               safetyScore:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 example: 65
 *               safetyRank:
 *                 type: number
 *                 example: 15
 *               riskLevel:
 *                 type: string
 *                 enum: [Low Risk, Moderate Risk, Medium Risk, High Risk, Extreme Risk]
 *                 example: "Moderate Risk"
 *     responses:
 *       201:
 *         description: Safety score created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/SafetyScore'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 */
router.post('/', isAdmin, createSafetyScore);

/**
 * @swagger
 * /api/safety-scores:
 *   get:
 *     summary: Get all safety scores
 *     description: Get all safety score entries with filtering and pagination
 *     tags: [Safety Scores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: riskLevel
 *         schema:
 *           type: string
 *           enum: [Low Risk, Moderate Risk, Medium Risk, High Risk, Extreme Risk]
 *       - in: query
 *         name: minScore
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxScore
 *         schema:
 *           type: number
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: safetyScore
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: List of safety scores
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SafetyScore'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Unauthorized
 */
router.get('/', getAllSafetyScores);

/**
 * @swagger
 * /api/safety-scores/nearby:
 *   get:
 *     summary: Get nearby safety scores
 *     description: Find safety scores near a specific location
 *     tags: [Safety Scores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema:
 *           type: number
 *         example: 72.8777
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema:
 *           type: number
 *         example: 19.0760
 *       - in: query
 *         name: maxDistance
 *         schema:
 *           type: integer
 *           default: 50000
 *         description: Maximum distance in meters
 *     responses:
 *       200:
 *         description: Nearby safety scores
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SafetyScore'
 *       400:
 *         description: Missing coordinates
 *       401:
 *         description: Unauthorized
 */
router.get('/nearby', getNearbySafetyScore);

/**
 * @swagger
 * /api/safety-scores/{id}:
 *   get:
 *     summary: Get safety score by ID
 *     description: Get a specific safety score entry
 *     tags: [Safety Scores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Safety score details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/SafetyScore'
 *       404:
 *         description: Not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:id', getSafetyScoreById);

/**
 * @swagger
 * /api/safety-scores/{id}:
 *   put:
 *     summary: Update safety score
 *     description: Update a safety score entry. Admin only.
 *     tags: [Safety Scores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               location:
 *                 type: object
 *                 properties:
 *                   coordinates:
 *                     type: array
 *                     items:
 *                       type: number
 *               population:
 *                 type: number
 *               populationDensity:
 *                 type: number
 *               crimeRate:
 *                 type: number
 *               safetyScore:
 *                 type: number
 *               safetyRank:
 *                 type: number
 *               riskLevel:
 *                 type: string
 *                 enum: [Low Risk, Moderate Risk, Medium Risk, High Risk, Extreme Risk]
 *     responses:
 *       200:
 *         description: Safety score updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/SafetyScore'
 *       404:
 *         description: Not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 */
router.put('/:id', isAdmin, updateSafetyScore);

export default router;
