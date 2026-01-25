import mongoose from "mongoose";

const locationSchema = new mongoose.Schema({
    userID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    // GeoJSON format for efficient geospatial queries
    location: {
        type: {
            type: String,
            enum: ['Point'],
            required: true,
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true,
            validate: {
                validator: function(coords) {
                    return coords.length === 2 &&
                        coords[0] >= -180 && coords[0] <= 180 && // longitude
                        coords[1] >= -90 && coords[1] <= 90;     // latitude
                },
                message: 'Invalid coordinates: [longitude, latitude] required'
            }
        }
    },
    altitude: {
        type: Number,
        required: false
    },
    speed: {
        type: Number,
        required: false,
        min: 0
    },
    heading: {
        type: Number,
        required: false,
        min: 0,
        max: 360
    },
    accuracy: {
        type: Number,
        required: false,
        min: 0
    },
    batteryLevel: {
        type: Number,
        required: false,
        min: 0,
        max: 100
    },
    isCharging: {
        type: Boolean,
        required: false
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: false, // Using custom timestamp field
    collection: 'locations',
    toJSON: {
        transform: function(doc, ret) {
            ret.id = ret._id;
            delete ret._id;
            delete ret.__v;
            return ret;
        }
    }
});

// 2dsphere index for geospatial queries (find nearby, within radius, etc.)
locationSchema.index({ location: '2dsphere' });

// Compound index for user location history queries
locationSchema.index({ userID: 1, timestamp: -1 });

// TTL index: auto-delete location data older than 30 days (adjust as needed)
locationSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const Location = mongoose.model('Location', locationSchema);

export default Location;