import { Router } from 'express';
import { authenticate } from '../Middlewares/auth.middleware.js';
import {
    updateLocation,
    batchUpdateLocations,
    getMyLocation,
    getMyLocationHistory,
    getUserLocation,
    getMultipleUsersLocations,
    findNearbyUsers,
    deleteLocationHistory
} from '../Controllers/location.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/locations:
 *   post:
 *     summary: Update current location
 *     description: Save current GPS location for the authenticated user
 *     tags: [Locations]
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
 *                 minimum: -180
 *                 maximum: 180
 *                 example: 77.5946
 *               latitude:
 *                 type: number
 *                 minimum: -90
 *                 maximum: 90
 *                 example: 12.9716
 *               altitude:
 *                 type: number
 *                 description: Altitude in meters
 *                 example: 920
 *               speed:
 *                 type: number
 *                 minimum: 0
 *                 description: Speed in m/s
 *                 example: 5.5
 *               heading:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 360
 *                 description: Direction in degrees (0-360)
 *                 example: 45
 *               accuracy:
 *                 type: number
 *                 minimum: 0
 *                 description: GPS accuracy in meters
 *                 example: 10
 *               batteryLevel:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 description: Device battery percentage
 *                 example: 85
 *               isCharging:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       201:
 *         description: Location saved successfully
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
 *                   $ref: '#/components/schemas/Location'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/', updateLocation);

/**
 * @swagger
 * /api/locations/batch:
 *   post:
 *     summary: Batch update locations
 *     description: Upload multiple location points at once (useful for offline sync)
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - locations
 *             properties:
 *               locations:
 *                 type: array
 *                 maxItems: 100
 *                 items:
 *                   type: object
 *                   required:
 *                     - longitude
 *                     - latitude
 *                   properties:
 *                     longitude:
 *                       type: number
 *                     latitude:
 *                       type: number
 *                     altitude:
 *                       type: number
 *                     speed:
 *                       type: number
 *                     heading:
 *                       type: number
 *                     accuracy:
 *                       type: number
 *                     batteryLevel:
 *                       type: number
 *                     isCharging:
 *                       type: boolean
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *     responses:
 *       201:
 *         description: Locations saved successfully
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
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/batch', batchUpdateLocations);

/**
 * @swagger
 * /api/locations/me:
 *   get:
 *     summary: Get my latest location
 *     description: Get the most recent location of the authenticated user
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Latest location
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Location'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/me', getMyLocation);

/**
 * @swagger
 * /api/locations/history:
 *   get:
 *     summary: Get my location history
 *     description: Get location history for the authenticated user with pagination
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for history range
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for history range
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *           maximum: 500
 *         description: Number of records per page
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *     responses:
 *       200:
 *         description: Location history with pagination
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
 *                     $ref: '#/components/schemas/Location'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/history', getMyLocationHistory);

/**
 * @swagger
 * /api/locations/history:
 *   delete:
 *     summary: Delete location history
 *     description: Delete user's location history for privacy
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: before
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Delete records before this date. If omitted, deletes all history.
 *     responses:
 *       200:
 *         description: History deleted
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
 *                   type: object
 *                   properties:
 *                     deletedCount:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.delete('/history', deleteLocationHistory);

/**
 * @swagger
 * /api/locations/nearby:
 *   get:
 *     summary: Find nearby users ( NOT TESTED DONT USE THIS )
 *     description: Find users within a certain radius of a location
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema:
 *           type: number
 *         description: Center longitude
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema:
 *           type: number
 *         description: Center latitude
 *       - in: query
 *         name: radius
 *         schema:
 *           type: integer
 *           default: 5000
 *         description: Search radius in meters (default 5km)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 50
 *         description: Maximum number of users to return
 *     responses:
 *       200:
 *         description: List of nearby users
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
 *                     type: object
 *                     properties:
 *                       user:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           profilePicture:
 *                             type: string
 *                       location:
 *                         $ref: '#/components/schemas/GeoPoint'
 *                       distance:
 *                         type: integer
 *                         description: Distance in meters
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/nearby', findNearbyUsers);

/**
 * @swagger
 * /api/locations/users:
 *   post:
 *     summary: Get multiple users' locations
 *     description: Get latest locations for a list of users (for group tracking)
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userIds
 *             properties:
 *               userIds:
 *                 type: array
 *                 maxItems: 50
 *                 items:
 *                   type: string
 *                 example: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"]
 *     responses:
 *       200:
 *         description: Users' locations
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
 *                     type: object
 *                     properties:
 *                       user:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           profilePicture:
 *                             type: string
 *                       location:
 *                         $ref: '#/components/schemas/GeoPoint'
 *                       batteryLevel:
 *                         type: number
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/users', getMultipleUsersLocations);

/**
 * @swagger
 * /api/locations/user/{userId}:
 *   get:
 *     summary: Get a user's location
 *     description: Get another user's latest location (requires permission)
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Target user's ID
 *     responses:
 *       200:
 *         description: User's latest location
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
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         profilePicture:
 *                           type: string
 *                     location:
 *                       $ref: '#/components/schemas/Location'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/user/:userId', getUserLocation);

export default router;
