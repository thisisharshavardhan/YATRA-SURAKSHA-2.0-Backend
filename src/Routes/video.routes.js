import { Router } from 'express';
import { authenticate, isAdmin } from '../Middlewares/auth.middleware.js';
import { uploadVideo, uploadThumbnail } from '../Middlewares/upload.middleware.js';
import {
    uploadNewVideo,
    getMyVideos,
    getVideoById,
    getVideosByAlert,
    updateVideo,
    deleteVideo,
    getVideoStats,
    streamVideo,
    getAllVideos,
    bulkDeleteVideos
} from '../Controllers/video.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Videos
 *   description: Video upload and management endpoints
 */

/**
 * @swagger
 * /api/videos:
 *   post:
 *     summary: Upload a new video
 *     description: Upload a video file with optional thumbnail. Videos are stored locally on the server.
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - video
 *             properties:
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: Video file (mp4, webm, quicktime, avi). Max 100MB.
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *                 description: Optional thumbnail image (jpeg, png, webp). Max 5MB.
 *               duration:
 *                 type: number
 *                 description: Video duration in seconds
 *                 example: 120.5
 *               relatedAlertID:
 *                 type: string
 *                 description: Optional ID of related alert
 *                 example: "60d5ec49f1b2c72b8c8e4321"
 *     responses:
 *       201:
 *         description: Video uploaded successfully
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
 *                   example: "Video uploaded successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Video'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/', uploadVideo, uploadNewVideo);

/**
 * @swagger
 * /api/videos:
 *   get:
 *     summary: Get all videos for authenticated user
 *     description: Retrieve paginated list of videos uploaded by the authenticated user.
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Number of videos per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, fileSize, duration]
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Videos retrieved successfully
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
 *                     videos:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Video'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 */
router.get('/', getMyVideos);

/**
 * @swagger
 * /api/videos/stats:
 *   get:
 *     summary: Get video statistics for user
 *     description: Get aggregate statistics about user's videos including total count, size, duration.
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
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
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalVideos:
 *                           type: integer
 *                           example: 15
 *                         totalSize:
 *                           type: integer
 *                           example: 157286400
 *                         totalSizeMB:
 *                           type: number
 *                           example: 150.0
 *                         totalDuration:
 *                           type: number
 *                           example: 1800.5
 *                         avgSize:
 *                           type: integer
 *                           example: 10485760
 *                         avgDuration:
 *                           type: number
 *                           example: 120.03
 *                         videosWithAlerts:
 *                           type: integer
 *                           example: 5
 *                     byMimeType:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           mimeType:
 *                             type: string
 *                             example: "video/mp4"
 *                           count:
 *                             type: integer
 *                           totalSize:
 *                             type: integer
 *                           totalSizeMB:
 *                             type: number
 */
router.get('/stats', getVideoStats);

/**
 * @swagger
 * /api/videos/alert/{alertId}:
 *   get:
 *     summary: Get videos by alert ID
 *     description: Retrieve all videos associated with a specific alert.
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     responses:
 *       200:
 *         description: Videos retrieved successfully
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
 *                     alertId:
 *                       type: string
 *                     count:
 *                       type: integer
 *                     videos:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Video'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/alert/:alertId', getVideosByAlert);

/**
 * @swagger
 * /api/videos/{videoId}:
 *   get:
 *     summary: Get video by ID
 *     description: Retrieve detailed information about a specific video.
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: string
 *         description: Video ID
 *     responses:
 *       200:
 *         description: Video retrieved successfully
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
 *                   $ref: '#/components/schemas/Video'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:videoId', getVideoById);

/**
 * @swagger
 * /api/videos/{videoId}/stream:
 *   get:
 *     summary: Stream video file
 *     description: Stream video with support for range requests (seeking). Returns video binary data.
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: string
 *         description: Video ID
 *       - in: header
 *         name: Range
 *         schema:
 *           type: string
 *         description: Byte range for partial content (e.g., "bytes=0-1000")
 *     responses:
 *       200:
 *         description: Video file (full content)
 *         content:
 *           video/mp4:
 *             schema:
 *               type: string
 *               format: binary
 *       206:
 *         description: Video file (partial content)
 *         headers:
 *           Content-Range:
 *             schema:
 *               type: string
 *             description: Byte range being returned
 *           Accept-Ranges:
 *             schema:
 *               type: string
 *             description: Indicates support for range requests
 *         content:
 *           video/mp4:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:videoId/stream', streamVideo);

/**
 * @swagger
 * /api/videos/{videoId}:
 *   patch:
 *     summary: Update video details
 *     description: Update video thumbnail, duration, or related alert. Can upload new thumbnail.
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: string
 *         description: Video ID
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *                 description: New thumbnail image
 *               duration:
 *                 type: number
 *                 description: Video duration in seconds
 *               relatedAlertID:
 *                 type: string
 *                 description: Related alert ID (use empty string to unlink)
 *     responses:
 *       200:
 *         description: Video updated successfully
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
 *                   $ref: '#/components/schemas/Video'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.patch('/:videoId', uploadThumbnail, updateVideo);

/**
 * @swagger
 * /api/videos/{videoId}:
 *   delete:
 *     summary: Delete video
 *     description: Delete a video and its associated files (video and thumbnail).
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: string
 *         description: Video ID
 *     responses:
 *       200:
 *         description: Video deleted successfully
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
 *                     videoId:
 *                       type: string
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete('/:videoId', deleteVideo);

// ==================== ADMIN ROUTES ====================

/**
 * @swagger
 * /api/videos/admin/all:
 *   get:
 *     summary: Get all videos (Admin only)
 *     description: Retrieve all videos across all users. Admin access required.
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *           maximum: 100
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: alertId
 *         schema:
 *           type: string
 *         description: Filter by alert ID
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, fileSize, duration]
 *           default: createdAt
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Videos retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/admin/all', getAllVideos);

/**
 * @swagger
 * /api/videos/admin/bulk:
 *   delete:
 *     summary: Bulk delete videos (Admin only)
 *     description: Delete multiple videos at once. Admin access required.
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - videoIds
 *             properties:
 *               videoIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of video IDs to delete
 *                 example: ["60d5ec49f1b2c72b8c8e4321", "60d5ec49f1b2c72b8c8e4322"]
 *     responses:
 *       200:
 *         description: Videos deleted successfully
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
 *                     requestedCount:
 *                       type: integer
 *                     deletedCount:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.delete('/admin/bulk', bulkDeleteVideos);

export default router;

/**
 * @swagger
 * components:
 *   schemas:
 *     Video:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Video ID
 *           example: "60d5ec49f1b2c72b8c8e4321"
 *         userID:
 *           type: string
 *           description: User who uploaded the video
 *         videoURL:
 *           type: string
 *           description: URL path to video file
 *           example: "/uploads/videos/user123_1706745600000.mp4"
 *         thumbnailURL:
 *           type: string
 *           nullable: true
 *           description: URL path to thumbnail image
 *           example: "/uploads/thumbnails/user123_1706745600000.jpg"
 *         fileSize:
 *           type: integer
 *           description: Video file size in bytes
 *           example: 10485760
 *         duration:
 *           type: number
 *           nullable: true
 *           description: Video duration in seconds
 *           example: 120.5
 *         mimeType:
 *           type: string
 *           enum: [video/mp4, video/webm, video/quicktime, video/x-msvideo]
 *           example: "video/mp4"
 *         relatedAlertID:
 *           type: string
 *           nullable: true
 *           description: Related alert ID
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */
