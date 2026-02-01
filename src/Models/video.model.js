import mongoose from "mongoose";

const videoSchema = new mongoose.Schema({
    userID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    videoURL: {
        type: String,
        required: true,
        trim: true
    },
    thumbnailURL: {
        type: String,
        required: false,
        trim: true
    },
    fileSize: {
        type: Number,
        required: false,
        min: 0
    },
    duration: {
        type: Number,
        required: false,
        min: 0
    },
    mimeType: {
        type: String,
        required: false,
        enum: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
    },
    relatedAlertID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Alert',
        required: false
    },
}, {
    timestamps: true,
    collection: 'videos',
    toJSON: {
        transform: function(doc, ret) {
            ret.id = ret._id;
            delete ret._id;
            delete ret.__v;
            return ret;
        }
    }
});

// Compound index for user videos sorted by date
videoSchema.index({ userID: 1, createdAt: -1 });

// Index for finding videos by alert
videoSchema.index({ relatedAlertID: 1 }, { sparse: true });

const Video = mongoose.model('Video', videoSchema);

export default Video;