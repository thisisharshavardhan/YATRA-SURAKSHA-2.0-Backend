import { Router } from 'express';
import {
    createGroup,
    getMyGroups,
    getGroupById,
    updateGroup,
    joinGroup,
    leaveGroup,
    removeMember,
    updateMemberRole,
    regenerateJoinCode,
    getGroupMembersLocations,
    deleteGroup
} from '../Controllers/group.controller.js';
import { authenticate } from '../Middlewares/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/groups:
 *   post:
 *     summary: Create a new group
 *     description: Create a new group. The creator automatically becomes an admin member.
 *     tags: [Groups]
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
 *             properties:
 *               name:
 *                 type: string
 *                 description: Group name
 *                 example: "Family Trip to Goa"
 *               description:
 *                 type: string
 *                 description: Group description
 *                 example: "Our family vacation group"
 *               groupPictureURL:
 *                 type: string
 *                 description: URL to group picture
 *                 example: "https://example.com/group-pic.jpg"
 *     responses:
 *       201:
 *         description: Group created successfully
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
 *                   example: "Group created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Group'
 *       400:
 *         description: Bad request - missing group name
 *       401:
 *         description: Unauthorized
 */
router.post('/', createGroup);

/**
 * @swagger
 * /api/groups:
 *   get:
 *     summary: Get my groups
 *     description: Get all groups the current user is a member of
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of groups
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Group'
 *       401:
 *         description: Unauthorized
 */
router.get('/', getMyGroups);

/**
 * @swagger
 * /api/groups/join:
 *   post:
 *     summary: Join a group using join code
 *     description: Join a group by providing its unique join code
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - joinCode
 *             properties:
 *               joinCode:
 *                 type: string
 *                 description: Unique join code for the group
 *                 example: "ABC123"
 *     responses:
 *       200:
 *         description: Successfully joined the group
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
 *                   example: "Successfully joined the group"
 *                 data:
 *                   $ref: '#/components/schemas/Group'
 *       400:
 *         description: Already a member or missing join code
 *       404:
 *         description: Invalid join code
 *       401:
 *         description: Unauthorized
 */
router.post('/join', joinGroup);

/**
 * @swagger
 * /api/groups/{id}:
 *   get:
 *     summary: Get group by ID
 *     description: Get detailed information about a specific group. Only members can view.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Group ID
 *     responses:
 *       200:
 *         description: Group details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Group'
 *       403:
 *         description: Not a member of this group
 *       404:
 *         description: Group not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:id', getGroupById);

/**
 * @swagger
 * /api/groups/{id}:
 *   put:
 *     summary: Update group details
 *     description: Update group name, description, or picture. Only admins can update.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Group ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Group name
 *                 example: "Updated Group Name"
 *               description:
 *                 type: string
 *                 description: Group description
 *                 example: "Updated description"
 *               groupPictureURL:
 *                 type: string
 *                 description: URL to group picture
 *                 example: "https://example.com/new-pic.jpg"
 *     responses:
 *       200:
 *         description: Group updated successfully
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
 *                   example: "Group updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Group'
 *       403:
 *         description: Only group admins can update
 *       404:
 *         description: Group not found
 *       401:
 *         description: Unauthorized
 */
router.put('/:id', updateGroup);

/**
 * @swagger
 * /api/groups/{id}:
 *   delete:
 *     summary: Delete group
 *     description: Soft delete a group. Only the creator can delete.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Group ID
 *     responses:
 *       200:
 *         description: Group deleted successfully
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
 *                   example: "Group deleted successfully"
 *       403:
 *         description: Only the creator can delete
 *       404:
 *         description: Group not found
 *       401:
 *         description: Unauthorized
 */
router.delete('/:id', deleteGroup);

/**
 * @swagger
 * /api/groups/{id}/leave:
 *   post:
 *     summary: Leave group
 *     description: Leave a group you are a member of. If you are the only admin, promote another member first.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Group ID
 *     responses:
 *       200:
 *         description: Successfully left the group
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
 *                   example: "Successfully left the group"
 *       400:
 *         description: Not a member or need to promote admin first
 *       404:
 *         description: Group not found
 *       401:
 *         description: Unauthorized
 */
router.post('/:id/leave', leaveGroup);

/**
 * @swagger
 * /api/groups/{id}/regenerate-code:
 *   post:
 *     summary: Regenerate join code
 *     description: Generate a new join code for the group. Only admins can regenerate.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Group ID
 *     responses:
 *       200:
 *         description: Join code regenerated
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
 *                   example: "Join code regenerated"
 *                 data:
 *                   type: object
 *                   properties:
 *                     joinCode:
 *                       type: string
 *                       example: "XYZ789"
 *       403:
 *         description: Only admins can regenerate
 *       404:
 *         description: Group not found
 *       401:
 *         description: Unauthorized
 */
router.post('/:id/regenerate-code', regenerateJoinCode);

/**
 * @swagger
 * /api/groups/{id}/locations:
 *   get:
 *     summary: Get group members' locations
 *     description: Get the latest location of all group members who have allowed location access
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Group ID
 *     responses:
 *       200:
 *         description: Members' locations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
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
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       batteryLevel:
 *                         type: number
 *                       speed:
 *                         type: number
 *       403:
 *         description: Not a member of this group
 *       404:
 *         description: Group not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:id/locations', getGroupMembersLocations);

/**
 * @swagger
 * /api/groups/{id}/members/{userId}:
 *   delete:
 *     summary: Remove member from group
 *     description: Remove a member from the group. Only admins can remove members.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Group ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to remove
 *     responses:
 *       200:
 *         description: Member removed successfully
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
 *                   example: "Member removed successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Group'
 *       400:
 *         description: Cannot remove yourself using this endpoint
 *       403:
 *         description: Only admins can remove members
 *       404:
 *         description: Group or member not found
 *       401:
 *         description: Unauthorized
 */
router.delete('/:id/members/:userId', removeMember);

/**
 * @swagger
 * /api/groups/{id}/members/{userId}/role:
 *   put:
 *     summary: Update member role
 *     description: Promote or demote a member. Only admins can change roles.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Group ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [admin, member]
 *                 description: New role for the member
 *                 example: "admin"
 *     responses:
 *       200:
 *         description: Role updated successfully
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
 *                   example: "Member role updated to admin"
 *                 data:
 *                   $ref: '#/components/schemas/Group'
 *       400:
 *         description: Invalid role or cannot demote only admin
 *       403:
 *         description: Only admins can change roles
 *       404:
 *         description: Group or member not found
 *       401:
 *         description: Unauthorized
 */
router.put('/:id/members/:userId/role', updateMemberRole);

export default router;
