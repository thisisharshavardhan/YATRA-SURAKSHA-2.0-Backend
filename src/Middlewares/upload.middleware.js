import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { BadRequestError } from './error.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads');
const videosDir = path.join(uploadsDir, 'videos');
const thumbnailsDir = path.join(uploadsDir, 'thumbnails');

[uploadsDir, videosDir, thumbnailsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Allowed video MIME types
const ALLOWED_VIDEO_TYPES = [
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo'
];

// Allowed image MIME types for thumbnails
const ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp'
];

// Video storage configuration
const videoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'video') {
            cb(null, videosDir);
        } else if (file.fieldname === 'thumbnail') {
            cb(null, thumbnailsDir);
        } else {
            cb(new Error('Invalid field name'), null);
        }
    },
    filename: (req, file, cb) => {
        const userId = req.user?._id || 'unknown';
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        const filename = `${userId}_${timestamp}${ext}`;
        cb(null, filename);
    }
});

// File filter for videos
const videoFileFilter = (req, file, cb) => {
    if (file.fieldname === 'video') {
        if (ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new BadRequestError(`Invalid video type. Allowed types: ${ALLOWED_VIDEO_TYPES.join(', ')}`), false);
        }
    } else if (file.fieldname === 'thumbnail') {
        if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new BadRequestError(`Invalid thumbnail type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`), false);
        }
    } else {
        cb(new BadRequestError('Invalid field name'), false);
    }
};

// Video upload middleware - handles both video and optional thumbnail
export const uploadVideo = multer({
    storage: videoStorage,
    fileFilter: videoFileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB max for videos
        files: 2 // Max 2 files (video + thumbnail)
    }
}).fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
]);

// Single video upload (without thumbnail)
export const uploadSingleVideo = multer({
    storage: videoStorage,
    fileFilter: videoFileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB max
    }
}).single('video');

// Thumbnail only upload
export const uploadThumbnail = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, thumbnailsDir),
        filename: (req, file, cb) => {
            const userId = req.user?._id || 'unknown';
            const timestamp = Date.now();
            const ext = path.extname(file.originalname);
            cb(null, `${userId}_${timestamp}${ext}`);
        }
    }),
    fileFilter: (req, file, cb) => {
        if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new BadRequestError(`Invalid image type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max for thumbnails
    }
}).single('thumbnail');

// Helper to get file URL from filename
export const getVideoUrl = (filename) => {
    if (!filename) return null;
    return `/uploads/videos/${filename}`;
};

export const getThumbnailUrl = (filename) => {
    if (!filename) return null;
    return `/uploads/thumbnails/${filename}`;
};

// Helper to delete video files
export const deleteVideoFile = (filename) => {
    if (!filename) return;
    const filePath = path.join(videosDir, filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
};

export const deleteThumbnailFile = (filename) => {
    if (!filename) return;
    const filePath = path.join(thumbnailsDir, filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
};

// Export directories for reference
export const UPLOADS_DIR = uploadsDir;
export const VIDEOS_DIR = videosDir;
export const THUMBNAILS_DIR = thumbnailsDir;
