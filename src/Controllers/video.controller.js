import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import Video from '../Models/video.model.js';
import Alert from '../Models/alert.model.js';
import { asyncHandler, BadRequestError, NotFoundError, ForbiddenError } from '../Middlewares/error.middleware.js';
import { 
    getVideoUrl, 
    getThumbnailUrl, 
    deleteVideoFile, 
    deleteThumbnailFile,
    VIDEOS_DIR,
    THUMBNAILS_DIR
} from '../Middlewares/upload.middleware.js';

/**
 * @desc    Upload a new video
 * @route   POST /api/videos
 * @access  Private
 */
export const uploadNewVideo = asyncHandler(async (req, res) => {
    if (!req.files || !req.files.video || req.files.video.length === 0) {
        throw new BadRequestError('Video file is required');
    }

    const videoFile = req.files.video[0];
    const thumbnailFile = req.files.thumbnail ? req.files.thumbnail[0] : null;
    const { duration, relatedAlertID } = req.body;

    // Validate relatedAlertID if provided
    if (relatedAlertID) {
        if (!mongoose.Types.ObjectId.isValid(relatedAlertID)) {
            throw new BadRequestError('Invalid alert ID');
        }
        const alert = await Alert.findById(relatedAlertID);
        if (!alert) {
            throw new NotFoundError('Related alert not found');
        }
        // Verify the alert belongs to the user
        if (alert.userID.toString() !== req.user._id.toString()) {
            throw new ForbiddenError('Alert does not belong to you');
        }
    }

    // Create video record
    const video = await Video.create({
        userID: req.user._id,
        videoURL: getVideoUrl(videoFile.filename),
        thumbnailURL: thumbnailFile ? getThumbnailUrl(thumbnailFile.filename) : null,
        fileSize: videoFile.size,
        duration: duration ? parseFloat(duration) : null,
        mimeType: videoFile.mimetype,
        relatedAlertID: relatedAlertID || null
    });

    res.status(201).json({
        success: true,
        message: 'Video uploaded successfully',
        data: video
    });
});

/**
 * @desc    Get all videos for authenticated user
 * @route   GET /api/videos
 * @access  Private
 */
export const getMyVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, sortBy = 'createdAt', order = 'desc' } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    const sortOrder = order === 'asc' ? 1 : -1;

    const [videos, total] = await Promise.all([
        Video.find({ userID: req.user._id })
            .sort({ [sortBy]: sortOrder })
            .skip(skip)
            .limit(limitNum)
            .populate('relatedAlertID', 'alertType severity status createdAt'),
        Video.countDocuments({ userID: req.user._id })
    ]);

    res.json({
        success: true,
        message: 'Videos retrieved successfully',
        data: {
            videos,
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(total / limitNum),
                totalItems: total,
                itemsPerPage: limitNum,
                hasNextPage: pageNum < Math.ceil(total / limitNum),
                hasPrevPage: pageNum > 1
            }
        }
    });
});

/**
 * @desc    Get video by ID
 * @route   GET /api/videos/:videoId
 * @access  Private
 */
export const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(videoId)) {
        throw new BadRequestError('Invalid video ID');
    }

    const video = await Video.findById(videoId)
        .populate('userID', 'name email profilePictureURL')
        .populate('relatedAlertID', 'alertType severity status location createdAt');

    if (!video) {
        throw new NotFoundError('Video not found');
    }

    // Check if user owns the video or is admin
    if (video.userID._id.toString() !== req.user._id.toString() && !req.user.isAdmin) {
        throw new ForbiddenError('You do not have permission to view this video');
    }

    res.json({
        success: true,
        message: 'Video retrieved successfully',
        data: video
    });
});

/**
 * @desc    Get videos by alert ID
 * @route   GET /api/videos/alert/:alertId
 * @access  Private
 */
export const getVideosByAlert = asyncHandler(async (req, res) => {
    const { alertId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(alertId)) {
        throw new BadRequestError('Invalid alert ID');
    }

    // Verify alert exists and belongs to user
    const alert = await Alert.findById(alertId);
    if (!alert) {
        throw new NotFoundError('Alert not found');
    }

    if (alert.userID.toString() !== req.user._id.toString() && !req.user.isAdmin) {
        throw new ForbiddenError('You do not have permission to view these videos');
    }

    const videos = await Video.find({ relatedAlertID: alertId })
        .sort({ createdAt: -1 })
        .populate('userID', 'name email');

    res.json({
        success: true,
        message: 'Videos for alert retrieved successfully',
        data: {
            alertId,
            count: videos.length,
            videos
        }
    });
});

/**
 * @desc    Update video details (thumbnail, duration, relatedAlertID)
 * @route   PATCH /api/videos/:videoId
 * @access  Private
 */
export const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { duration, relatedAlertID } = req.body;

    if (!mongoose.Types.ObjectId.isValid(videoId)) {
        throw new BadRequestError('Invalid video ID');
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new NotFoundError('Video not found');
    }

    // Check ownership
    if (video.userID.toString() !== req.user._id.toString()) {
        throw new ForbiddenError('You do not have permission to update this video');
    }

    const updateData = {};

    // Handle thumbnail upload if present
    if (req.file) {
        // Delete old thumbnail if exists
        if (video.thumbnailURL) {
            const oldFilename = path.basename(video.thumbnailURL);
            deleteThumbnailFile(oldFilename);
        }
        updateData.thumbnailURL = getThumbnailUrl(req.file.filename);
    }

    // Update duration if provided
    if (duration !== undefined) {
        updateData.duration = parseFloat(duration);
    }

    // Update relatedAlertID if provided
    if (relatedAlertID !== undefined) {
        if (relatedAlertID === null || relatedAlertID === '') {
            updateData.relatedAlertID = null;
        } else {
            if (!mongoose.Types.ObjectId.isValid(relatedAlertID)) {
                throw new BadRequestError('Invalid alert ID');
            }
            const alert = await Alert.findById(relatedAlertID);
            if (!alert) {
                throw new NotFoundError('Related alert not found');
            }
            if (alert.userID.toString() !== req.user._id.toString()) {
                throw new ForbiddenError('Alert does not belong to you');
            }
            updateData.relatedAlertID = relatedAlertID;
        }
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        { $set: updateData },
        { new: true, runValidators: true }
    ).populate('relatedAlertID', 'alertType severity status createdAt');

    res.json({
        success: true,
        message: 'Video updated successfully',
        data: updatedVideo
    });
});

/**
 * @desc    Delete video
 * @route   DELETE /api/videos/:videoId
 * @access  Private
 */
export const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(videoId)) {
        throw new BadRequestError('Invalid video ID');
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new NotFoundError('Video not found');
    }

    // Check ownership (or admin)
    if (video.userID.toString() !== req.user._id.toString() && !req.user.isAdmin) {
        throw new ForbiddenError('You do not have permission to delete this video');
    }

    // Delete physical files
    if (video.videoURL) {
        const videoFilename = path.basename(video.videoURL);
        deleteVideoFile(videoFilename);
    }
    if (video.thumbnailURL) {
        const thumbnailFilename = path.basename(video.thumbnailURL);
        deleteThumbnailFile(thumbnailFilename);
    }

    // Delete database record
    await Video.findByIdAndDelete(videoId);

    res.json({
        success: true,
        message: 'Video deleted successfully',
        data: { videoId }
    });
});

/**
 * @desc    Get video statistics for user
 * @route   GET /api/videos/stats
 * @access  Private
 */
export const getVideoStats = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const stats = await Video.aggregate([
        { $match: { userID: new mongoose.Types.ObjectId(userId) } },
        {
            $group: {
                _id: null,
                totalVideos: { $sum: 1 },
                totalSize: { $sum: '$fileSize' },
                totalDuration: { $sum: { $ifNull: ['$duration', 0] } },
                avgSize: { $avg: '$fileSize' },
                avgDuration: { $avg: { $ifNull: ['$duration', 0] } },
                videosWithAlerts: {
                    $sum: { $cond: [{ $ne: ['$relatedAlertID', null] }, 1, 0] }
                }
            }
        },
        {
            $project: {
                _id: 0,
                totalVideos: 1,
                totalSize: { $round: ['$totalSize', 0] },
                totalDuration: { $round: ['$totalDuration', 2] },
                avgSize: { $round: ['$avgSize', 0] },
                avgDuration: { $round: ['$avgDuration', 2] },
                videosWithAlerts: 1,
                totalSizeMB: { $round: [{ $divide: ['$totalSize', 1048576] }, 2] }
            }
        }
    ]);

    // Get videos by mime type
    const byMimeType = await Video.aggregate([
        { $match: { userID: new mongoose.Types.ObjectId(userId) } },
        {
            $group: {
                _id: '$mimeType',
                count: { $sum: 1 },
                totalSize: { $sum: '$fileSize' }
            }
        },
        {
            $project: {
                mimeType: '$_id',
                count: 1,
                totalSize: 1,
                totalSizeMB: { $round: [{ $divide: ['$totalSize', 1048576] }, 2] },
                _id: 0
            }
        }
    ]);

    res.json({
        success: true,
        message: 'Video statistics retrieved successfully',
        data: {
            summary: stats[0] || {
                totalVideos: 0,
                totalSize: 0,
                totalDuration: 0,
                avgSize: 0,
                avgDuration: 0,
                videosWithAlerts: 0,
                totalSizeMB: 0
            },
            byMimeType
        }
    });
});

/**
 * @desc    Stream video file
 * @route   GET /api/videos/:videoId/stream
 * @access  Private
 */
export const streamVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(videoId)) {
        throw new BadRequestError('Invalid video ID');
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new NotFoundError('Video not found');
    }

    // Check ownership
    if (video.userID.toString() !== req.user._id.toString() && !req.user.isAdmin) {
        throw new ForbiddenError('You do not have permission to stream this video');
    }

    const filename = path.basename(video.videoURL);
    const videoPath = path.join(VIDEOS_DIR, filename);

    if (!fs.existsSync(videoPath)) {
        throw new NotFoundError('Video file not found on server');
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        // Handle range requests for video streaming
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        const file = fs.createReadStream(videoPath, { start, end });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': video.mimeType || 'video/mp4'
        };

        res.writeHead(206, head);
        file.pipe(res);
    } else {
        // No range request, send entire file
        const head = {
            'Content-Length': fileSize,
            'Content-Type': video.mimeType || 'video/mp4'
        };

        res.writeHead(200, head);
        fs.createReadStream(videoPath).pipe(res);
    }
});

/**
 * @desc    Get all videos (Admin only)
 * @route   GET /api/videos/admin/all
 * @access  Private (Admin)
 */
export const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, userId, alertId, sortBy = 'createdAt', order = 'desc' } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    const sortOrder = order === 'asc' ? 1 : -1;

    // Build query
    const query = {};
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        query.userID = userId;
    }
    if (alertId && mongoose.Types.ObjectId.isValid(alertId)) {
        query.relatedAlertID = alertId;
    }

    const [videos, total] = await Promise.all([
        Video.find(query)
            .sort({ [sortBy]: sortOrder })
            .skip(skip)
            .limit(limitNum)
            .populate('userID', 'name email phoneNumber')
            .populate('relatedAlertID', 'alertType severity status createdAt'),
        Video.countDocuments(query)
    ]);

    res.json({
        success: true,
        message: 'All videos retrieved successfully',
        data: {
            videos,
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(total / limitNum),
                totalItems: total,
                itemsPerPage: limitNum,
                hasNextPage: pageNum < Math.ceil(total / limitNum),
                hasPrevPage: pageNum > 1
            }
        }
    });
});

/**
 * @desc    Bulk delete videos (Admin only)
 * @route   DELETE /api/videos/admin/bulk
 * @access  Private (Admin)
 */
export const bulkDeleteVideos = asyncHandler(async (req, res) => {
    const { videoIds } = req.body;

    if (!Array.isArray(videoIds) || videoIds.length === 0) {
        throw new BadRequestError('videoIds array is required');
    }

    // Validate all IDs
    const validIds = videoIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
        throw new BadRequestError('No valid video IDs provided');
    }

    // Get videos to delete files
    const videos = await Video.find({ _id: { $in: validIds } });

    // Delete physical files
    for (const video of videos) {
        if (video.videoURL) {
            const videoFilename = path.basename(video.videoURL);
            deleteVideoFile(videoFilename);
        }
        if (video.thumbnailURL) {
            const thumbnailFilename = path.basename(video.thumbnailURL);
            deleteThumbnailFile(thumbnailFilename);
        }
    }

    // Delete from database
    const result = await Video.deleteMany({ _id: { $in: validIds } });

    res.json({
        success: true,
        message: `${result.deletedCount} videos deleted successfully`,
        data: {
            requestedCount: videoIds.length,
            deletedCount: result.deletedCount
        }
    });
});
