import { Router } from 'express';
import { authenticate, isAdmin } from '../Middlewares/auth.middleware.js';
import {
    triggerSOS,
    triggerLowBatteryAlert,
    triggerGeofenceAlert,
    getMyAlerts,
    getAlertById,
    resolveAlert,
    getNearbyAlerts,
    getContactsAlerts,
    getAlertStats,
    getAllAlerts
} from '../Controllers/alert.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/alerts/sos:
 *   post:
 *     summary: Trigger SOS alert
 *     description: Trigger an emergency SOS alert with current location. This is the primary panic button functionality.
 *     tags: [Alerts]
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
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Need immediate help!"
 *     responses:
 *       201:
 *         description: SOS alert triggered
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
 *                     alert:
 *                       $ref: '#/components/schemas/Alert'
 *                     user:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                         phoneNumber:
 *                           type: string
 *                     emergencyContacts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/EmergencyContact'
 *                     notificationSent:
 *                       type: boolean
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/sos', triggerSOS);

/**
 * @swagger
 * /api/alerts/low-battery:
 *   post:
 *     summary: Trigger low battery alert
 *     description: |
 *       Trigger an alert when device battery is critically low.
 *       Severity is automatically determined based on battery level:
 *       - ≤5% = critical
 *       - ≤10% = high
 *       - ≤15% = medium
 *       - >15% = low
 *     tags: [Alerts]
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
 *               - batteryLevel
 *             properties:
 *               longitude:
 *                 type: number
 *                 example: 77.5946
 *               latitude:
 *                 type: number
 *                 example: 12.9716
 *               batteryLevel:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 example: 5
 *                 description: Current battery percentage
 *     responses:
 *       201:
 *         description: Low battery alert triggered
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
 *                   $ref: '#/components/schemas/Alert'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/low-battery', triggerLowBatteryAlert);

/**
 * @swagger
 * /api/alerts/geofence:
 *   post:
 *     summary: Trigger geofence alert
 *     description: |
 *       Trigger an alert when user enters a restricted zone or exits a safety zone.
 *       
 *       **Alert Types:**
 *       - `enter_restricted_geofence` - User entered a restricted/dangerous area
 *       - `exit_safety_geofence` - User left a designated safe zone
 *     tags: [Alerts]
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
 *               - alertType
 *             properties:
 *               longitude:
 *                 type: number
 *                 example: 77.5946
 *               latitude:
 *                 type: number
 *                 example: 12.9716
 *               alertType:
 *                 type: string
 *                 enum: [enter_restricted_geofence, exit_safety_geofence]
 *                 description: |
 *                   * `enter_restricted_geofence` - Entered restricted area
 *                   * `exit_safety_geofence` - Left safe zone
 *                 example: enter_restricted_geofence
 *               geofenceId:
 *                 type: string
 *                 description: ID of the geofence that was crossed
 *                 example: "507f1f77bcf86cd799439011"
 *               geofenceName:
 *                 type: string
 *                 description: Name of the geofence for display
 *                 example: "Dangerous Area - River Bank"
 *     responses:
 *       201:
 *         description: Geofence alert triggered
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
 *                     alert:
 *                       $ref: '#/components/schemas/Alert'
 *                     geofenceId:
 *                       type: string
 *                     geofenceName:
 *                       type: string
 *                     user:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                         phoneNumber:
 *                           type: string
 *                     emergencyContacts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/EmergencyContact'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/geofence', triggerGeofenceAlert);

/**
 * @swagger
 * /api/alerts/me:
 *   get:
 *     summary: Get my alerts
 *     description: Get all alerts for the authenticated user with pagination
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, resolved, cancelled]
 *         description: Filter by status
 *       - in: query
 *         name: alertType
 *         schema:
 *           type: string
 *           enum: [sos, low_battery, enter_restricted_geofence, exit_safety_geofence]
 *         description: Filter by alert type
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: List of alerts
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
 *                     $ref: '#/components/schemas/Alert'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/me', getMyAlerts);

/**
 * @swagger
 * /api/alerts/stats:
 *   get:
 *     summary: Get my alert statistics
 *     description: Get aggregated statistics of alerts for the current user
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Alert statistics
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
 *                     resolved:
 *                       type: integer
 *                     cancelled:
 *                       type: integer
 *                     sosCount:
 *                       type: integer
 *                     lowBatteryCount:
 *                       type: integer
 *                     geofenceCount:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/stats', getAlertStats);

/**
 * @swagger
 * /api/alerts/nearby:
 *   get:
 *     summary: Get nearby active alerts ( NOT TESTED DONT USE THIS WILL FIX IT IN THE FUTURE )
 *     description: Find active alerts within a radius of a location
 *     tags: [Alerts]
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
 *           default: 10000
 *         description: Search radius in meters (default 10km)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of nearby alerts
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
 *                     allOf:
 *                       - $ref: '#/components/schemas/Alert'
 *                       - type: object
 *                         properties:
 *                           distance:
 *                             type: number
 *                             description: Distance in meters
 *                           user:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                               profilePicture:
 *                                 type: string
 *                               phoneNumber:
 *                                 type: string
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/nearby', getNearbyAlerts);

/**
 * @swagger
 * /api/alerts/contacts:
 *   get:
 *     summary: Get alerts from my contacts
 *     description: Get alerts from users who have listed me as emergency contact or are in my groups
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, resolved, cancelled]
 *           default: active
 *     responses:
 *       200:
 *         description: List of contact alerts
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
 *                     $ref: '#/components/schemas/Alert'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/contacts', getContactsAlerts);

/**
 * @swagger
 * /api/alerts/admin/all:
 *   get:
 *     summary: Get all alerts (Admin)
 *     description: Admin endpoint to view all alerts in the system
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, resolved, cancelled]
 *       - in: query
 *         name: alertType
 *         schema:
 *           type: string
 *           enum: [sos, low_battery, enter_restricted_geofence, exit_safety_geofence]
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: All alerts with pagination
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin access required
 */
router.get('/admin/all', isAdmin, getAllAlerts);

/**
 * @swagger
 * /api/alerts/{id}:
 *   get:
 *     summary: Get alert by ID
 *     description: Get detailed information about a specific alert
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     responses:
 *       200:
 *         description: Alert details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Alert'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Not authorized to view this alert
 */
router.get('/:id', getAlertById);

/**
 * @swagger
 * /api/alerts/{id}/resolve:
 *   put:
 *     summary: Resolve or cancel alert
 *     description: Mark an active alert as resolved or cancelled
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
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
 *                 enum: [resolved, cancelled]
 *                 example: resolved
 *               resolutionNotes:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Help arrived, situation resolved."
 *     responses:
 *       200:
 *         description: Alert resolved
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
 *                   $ref: '#/components/schemas/Alert'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Not authorized to resolve this alert
 */
router.put('/:id/resolve', resolveAlert);

export default router;
