import { Router } from 'express';
import {
    createGeofence,
    getAllGeofences,
    getGeofenceById,
    updateGeofence,
    deleteGeofence,
    getNearbyGeofences,
    checkGeofence,
    getGeofenceStats
} from '../Controllers/geofence.controller.js';
import { authenticate, isAdmin } from '../Middlewares/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/geofences:
 *   post:
 *     summary: Create a new geofence
 *     description: Create a new geofence zone (safety or restricted). Admin only.
 *     tags: [Geofences]
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
 *               - radius
 *               - fenceType
 *             properties:
 *               name:
 *                 type: string
 *                 description: Geofence name
 *                 example: "Mumbai Airport Safety Zone"
 *               description:
 *                 type: string
 *                 description: Geofence description
 *                 example: "Safe zone around Mumbai International Airport"
 *               location:
 *                 type: object
 *                 properties:
 *                   coordinates:
 *                     type: array
 *                     items:
 *                       type: number
 *                     example: [72.8777, 19.0896]
 *                     description: "[longitude, latitude]"
 *               radius:
 *                 type: number
 *                 description: Radius in meters
 *                 example: 5000
 *               fenceType:
 *                 type: string
 *                 enum: [safety, restricted]
 *                 example: "safety"
 *     responses:
 *       201:
 *         description: Geofence created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Geofence'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 */
router.post('/', isAdmin, createGeofence);

/**
 * @swagger
 * /api/geofences:
 *   get:
 *     summary: Get all geofences
 *     description: Get all geofences with optional filtering
 *     tags: [Geofences]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fenceType
 *         schema:
 *           type: string
 *           enum: [safety, restricted]
 *         description: Filter by fence type
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
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
 *         description: List of geofences
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
 *                     $ref: '#/components/schemas/Geofence'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Unauthorized
 */
router.get('/', getAllGeofences);

/**
 * @swagger
 * /api/geofences/nearby:
 *   get:
 *     summary: Get nearby geofences
 *     description: Find geofences near a specific location
 *     tags: [Geofences]
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
 *         example: 19.0896
 *       - in: query
 *         name: maxDistance
 *         schema:
 *           type: integer
 *           default: 10000
 *         description: Maximum distance in meters
 *       - in: query
 *         name: fenceType
 *         schema:
 *           type: string
 *           enum: [safety, restricted]
 *     responses:
 *       200:
 *         description: Nearby geofences
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
 *                     $ref: '#/components/schemas/Geofence'
 *       400:
 *         description: Missing coordinates
 *       401:
 *         description: Unauthorized
 */
router.get('/nearby', getNearbyGeofences);

/**
 * @swagger
 * /api/geofences/check:
 *   post:
 *     summary: Check if point is inside geofences
 *     description: Check if a given point is inside any safety or restricted geofences
 *     tags: [Geofences]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - longitude
 *               - latitude
 *             properties:
 *               longitude:
 *                 type: number
 *                 example: 72.8777
 *               latitude:
 *                 type: number
 *                 example: 19.0896
 *     responses:
 *       200:
 *         description: Geofence check result
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
 *                     isInsideSafetyZone:
 *                       type: boolean
 *                     isInsideRestrictedZone:
 *                       type: boolean
 *                     safetyZones:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           description:
 *                             type: string
 *                     restrictedZones:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           description:
 *                             type: string
 *       400:
 *         description: Missing coordinates
 *       401:
 *         description: Unauthorized
 */
router.post('/check', checkGeofence);

/**
 * @swagger
 * /api/geofences/stats:
 *   get:
 *     summary: Get geofence statistics
 *     description: Get aggregated statistics about geofences. Admin only.
 *     tags: [Geofences]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Geofence statistics
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
 *                     total:
 *                       type: integer
 *                     active:
 *                       type: integer
 *                     inactive:
 *                       type: integer
 *                     safetyZones:
 *                       type: integer
 *                     restrictedZones:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 */
router.get('/stats', isAdmin, getGeofenceStats);

/**
 * @swagger
 * /api/geofences/{id}:
 *   get:
 *     summary: Get geofence by ID
 *     description: Get a specific geofence by its ID
 *     tags: [Geofences]
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
 *         description: Geofence details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Geofence'
 *       404:
 *         description: Geofence not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:id', getGeofenceById);

/**
 * @swagger
 * /api/geofences/{id}:
 *   put:
 *     summary: Update geofence
 *     description: Update a geofence. Admin only.
 *     tags: [Geofences]
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
 *               description:
 *                 type: string
 *               location:
 *                 type: object
 *                 properties:
 *                   coordinates:
 *                     type: array
 *                     items:
 *                       type: number
 *               radius:
 *                 type: number
 *               fenceType:
 *                 type: string
 *                 enum: [safety, restricted]
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Geofence updated
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
 *                   $ref: '#/components/schemas/Geofence'
 *       404:
 *         description: Geofence not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 */
router.put('/:id', isAdmin, updateGeofence);

/**
 * @swagger
 * /api/geofences/{id}:
 *   delete:
 *     summary: Delete geofence
 *     description: Soft delete a geofence (sets isActive to false). Admin only.
 *     tags: [Geofences]
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
 *         description: Geofence deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Geofence not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 */
router.delete('/:id', isAdmin, deleteGeofence);

export default router;
