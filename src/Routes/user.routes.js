import { Router } from 'express';
import { authenticate } from '../Middlewares/auth.middleware.js';
import {
    getProfile,
    updateProfile,
    updateEmergencyContacts,
    updateHealthInfo,
    updatePermissions,
    getUserById,
    searchUsers
} from '../Controllers/user.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get current user profile
 *     description: Returns the full profile of the authenticated user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/profile', getProfile);

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update user profile
 *     description: Updates the authenticated user's profile information
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 example: John Doe
 *               phoneNumber:
 *                 type: string
 *                 example: "+919876543210"
 *               alternativePhoneNumber:
 *                 type: string
 *                 example: "+919876543211"
 *               whatsappNumber:
 *                 type: string
 *                 example: "+919876543210"
 *               profilePicture:
 *                 type: string
 *                 format: uri
 *                 example: "https://example.com/photo.jpg"
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 example: "1995-06-15"
 *               gender:
 *                 type: string
 *                 enum: [male, female, other]
 *               nationality:
 *                 type: string
 *                 example: Indian
 *     responses:
 *       200:
 *         description: Profile updated successfully
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
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put('/profile', updateProfile);

/**
 * @swagger
 * /api/users/emergency-contacts:
 *   put:
 *     summary: Update emergency contacts
 *     description: Updates the user's emergency contacts list (max 5 contacts)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - emergencyContacts
 *             properties:
 *               emergencyContacts:
 *                 type: array
 *                 maxItems: 5
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                     - relation
 *                     - phoneNumber
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: Jane Doe
 *                     relation:
 *                       type: string
 *                       example: Spouse
 *                     phoneNumber:
 *                       type: string
 *                       example: "+919876543211"
 *     responses:
 *       200:
 *         description: Emergency contacts updated
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
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/EmergencyContact'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put('/emergency-contacts', updateEmergencyContacts);

/**
 * @swagger
 * /api/users/health-info:
 *   put:
 *     summary: Update health information
 *     description: Updates the user's health and medical information
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bloodGroup:
 *                 type: string
 *                 example: O+
 *               allergies:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Peanuts", "Dust"]
 *               chronicDiseases:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Diabetes", "Hypertension"]
 *               medications:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Metformin"]
 *     responses:
 *       200:
 *         description: Health info updated
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
 *                   $ref: '#/components/schemas/HealthInfo'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put('/health-info', updateHealthInfo);

/**
 * @swagger
 * /api/users/permissions:
 *   put:
 *     summary: Update user permissions
 *     description: Updates app permissions for location, notifications, and SMS access
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               allowLocationAccess:
 *                 type: boolean
 *                 default: true
 *               allowNotificationAccess:
 *                 type: boolean
 *                 default: true
 *               allowSmsAccess:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Permissions updated
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
 *                   $ref: '#/components/schemas/Permissions'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put('/permissions', updatePermissions);

/**
 * @swagger
 * /api/users/search:
 *   get:
 *     summary: Search users
 *     description: Search for users by email or phone number (min 3 characters)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *           minLength: 3
 *         required: true
 *         description: Search query (email or phone, min 3 characters)
 *     responses:
 *       200:
 *         description: Search results (max 10 users)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   maxItems: 10
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                       phoneNumber:
 *                         type: string
 *                       profilePicture:
 *                         type: string
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/search', searchUsers);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     description: Retrieves a user's public profile by their ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User MongoDB ID
 *     responses:
 *       200:
 *         description: User public profile
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
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     profilePicture:
 *                       type: string
 *                     isVerified:
 *                       type: boolean
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/:id', getUserById);

export default router;
