import mongoose from "mongoose";


const alertSchema = new mongoose.Schema({
    userID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            required: true,
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true
        }
    },
    status: {
        type: String,
        enum: ['active', 'resolved', 'cancelled'],
        default: 'active',
        index: true
    },
    alertType: {
        type: String,
        enum: ['sos', 'low_battery','enter_restricted_geofence','exit_safety_geofence'],
        required: true,
        index: true
    },
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        required: true,
        index: true
    },
    description: {
        type: String,
        required: false,
        default: 'SOS Alert Triggered by User',
        maxlength: 500
    },
    // Geofence reference (for geofence-related alerts)
    geofenceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Geofence',
        required: false
    },
    geofenceName: {
        type: String,
        required: false,
        maxlength: 200
    },
    // Resolution details
    resolvedAt: {
        type: Date
    },
    resolutionNotes: {
        type: String,
        maxlength: 500
    }
}, {
    timestamps: true,
    collection: 'alerts',
    toJSON: {
        transform: function(doc, ret) {
            ret.id = ret._id;
            delete ret._id;
            delete ret.__v;
            return ret;
        }
    }
});

// Geospatial index for location-based queries
alertSchema.index({ location: '2dsphere' });

// Compound indexes for common query patterns
alertSchema.index({ userID: 1, status: 1 });
alertSchema.index({ alertType: 1, severity: 1, status: 1 });
alertSchema.index({ createdAt: -1 });

const Alert = mongoose.model('Alert', alertSchema);

export default Alert;