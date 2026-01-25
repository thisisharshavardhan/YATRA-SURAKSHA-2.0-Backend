import { Router } from 'express';
import {
    createTrip,
    getMyTrips,
    getTripById,
    updateTrip,
    updateTripStatus,
    startTrip,
    completeTrip,
    cancelTrip,
    deleteTrip,
    getUpcomingTrips,
    getActiveTrip,
    getTripStats
} from '../Controllers/trip.controller.js';
import { authenticate } from '../Middlewares/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/trips:
 *   post:
 *     summary: Create a new trip
 *     description: Create a new trip itinerary
 *     tags: [Trips]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tripName
 *               - startLocation
 *               - endLocation
 *               - startDate
 *               - endDate
 *             properties:
 *               tripName:
 *                 type: string
 *                 description: Name of the trip
 *                 example: "Goa Beach Vacation"
 *               startLocation:
 *                 type: object
 *                 properties:
 *                   coordinates:
 *                     type: array
 *                     items:
 *                       type: number
 *                     example: [72.8777, 19.0896]
 *                     description: "[longitude, latitude]"
 *               endLocation:
 *                 type: object
 *                 properties:
 *                   coordinates:
 *                     type: array
 *                     items:
 *                       type: number
 *                     example: [73.8278, 15.4909]
 *                     description: "[longitude, latitude]"
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-02-01T10:00:00Z"
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-02-07T18:00:00Z"
 *     responses:
 *       201:
 *         description: Trip created successfully
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
 *                   $ref: '#/components/schemas/Trip'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post('/', createTrip);

/**
 * @swagger
 * /api/trips:
 *   get:
 *     summary: Get my trips
 *     description: Get all trips for the authenticated user
 *     tags: [Trips]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [planned, ongoing, completed, cancelled]
 *         description: Filter by trip status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of trips
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
 *                     $ref: '#/components/schemas/Trip'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Unauthorized
 */
router.get('/', getMyTrips);

/**
 * @swagger
 * /api/trips/upcoming:
 *   get:
 *     summary: Get upcoming trips
 *     description: Get planned trips with start date in the future
 *     tags: [Trips]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Upcoming trips
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
 *                     $ref: '#/components/schemas/Trip'
 *       401:
 *         description: Unauthorized
 */
router.get('/upcoming', getUpcomingTrips);

/**
 * @swagger
 * /api/trips/active:
 *   get:
 *     summary: Get active trip
 *     description: Get the currently ongoing trip (if any)
 *     tags: [Trips]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active trip or null
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/Trip'
 *                     - type: 'null'
 *       401:
 *         description: Unauthorized
 */
router.get('/active', getActiveTrip);

/**
 * @swagger
 * /api/trips/stats:
 *   get:
 *     summary: Get trip statistics
 *     description: Get aggregated statistics about user's trips
 *     tags: [Trips]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trip statistics
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
 *                     planned:
 *                       type: integer
 *                     ongoing:
 *                       type: integer
 *                     completed:
 *                       type: integer
 *                     cancelled:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 */
router.get('/stats', getTripStats);

/**
 * @swagger
 * /api/trips/{id}:
 *   get:
 *     summary: Get trip by ID
 *     description: Get a specific trip by its ID
 *     tags: [Trips]
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
 *         description: Trip details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Trip'
 *       404:
 *         description: Trip not found
 *       403:
 *         description: Not authorized to view this trip
 *       401:
 *         description: Unauthorized
 */
router.get('/:id', getTripById);

/**
 * @swagger
 * /api/trips/{id}:
 *   put:
 *     summary: Update trip
 *     description: Update trip details (not for completed or cancelled trips)
 *     tags: [Trips]
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
 *               tripName:
 *                 type: string
 *               startLocation:
 *                 type: object
 *                 properties:
 *                   coordinates:
 *                     type: array
 *                     items:
 *                       type: number
 *               endLocation:
 *                 type: object
 *                 properties:
 *                   coordinates:
 *                     type: array
 *                     items:
 *                       type: number
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Trip updated
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
 *                   $ref: '#/components/schemas/Trip'
 *       400:
 *         description: Cannot update completed or cancelled trips
 *       404:
 *         description: Trip not found
 *       403:
 *         description: Not authorized
 *       401:
 *         description: Unauthorized
 */
router.put('/:id', updateTrip);

/**
 * @swagger
 * /api/trips/{id}:
 *   delete:
 *     summary: Delete trip
 *     description: Delete a planned or cancelled trip (cannot delete ongoing trips)
 *     tags: [Trips]
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
 *         description: Trip deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Cannot delete ongoing trip
 *       404:
 *         description: Trip not found
 *       403:
 *         description: Not authorized
 *       401:
 *         description: Unauthorized
 */
router.delete('/:id', deleteTrip);

/**
 * @swagger
 * /api/trips/{id}/status:
 *   put:
 *     summary: Update trip status
 *     description: Update the status of a trip (with validation of allowed transitions)
 *     tags: [Trips]
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
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [planned, ongoing, completed, cancelled]
 *     responses:
 *       200:
 *         description: Status updated
 *       400:
 *         description: Invalid status transition
 *       404:
 *         description: Trip not found
 *       401:
 *         description: Unauthorized
 */
router.put('/:id/status', updateTripStatus);

/**
 * @swagger
 * /api/trips/{id}/start:
 *   post:
 *     summary: Start a trip
 *     description: Change trip status from planned to ongoing
 *     tags: [Trips]
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
 *         description: Trip started
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
 *                   $ref: '#/components/schemas/Trip'
 *       400:
 *         description: Only planned trips can be started
 *       404:
 *         description: Trip not found
 *       401:
 *         description: Unauthorized
 */
router.post('/:id/start', startTrip);

/**
 * @swagger
 * /api/trips/{id}/complete:
 *   post:
 *     summary: Complete a trip
 *     description: Change trip status from ongoing to completed
 *     tags: [Trips]
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
 *         description: Trip completed
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
 *                   $ref: '#/components/schemas/Trip'
 *       400:
 *         description: Only ongoing trips can be completed
 *       404:
 *         description: Trip not found
 *       401:
 *         description: Unauthorized
 */
router.post('/:id/complete', completeTrip);

/**
 * @swagger
 * /api/trips/{id}/cancel:
 *   post:
 *     summary: Cancel a trip
 *     description: Cancel a planned or ongoing trip
 *     tags: [Trips]
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
 *         description: Trip cancelled
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
 *                   $ref: '#/components/schemas/Trip'
 *       400:
 *         description: Trip already completed or cancelled
 *       404:
 *         description: Trip not found
 *       401:
 *         description: Unauthorized
 */
router.post('/:id/cancel', cancelTrip);

export default router;
