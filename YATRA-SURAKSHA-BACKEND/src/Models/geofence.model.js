import mongoose from "mongoose";

const geofenceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    description: {
        type: String,
        required: false,
        trim: true,
        maxlength: 500
    },
    
    location: {
        type: {
            type: String,
            enum: ['Point'],
            required: true,
            default: 'Point'
        },
        coordinates: {
            type: [Number], 
            required: true,
            validate: {
                validator: function(coords) {
                    return coords.length === 2 &&
                        coords[0] >= -180 && coords[0] <= 180 &&
                        coords[1] >= -90 && coords[1] <= 90;
                },
                message: 'Invalid coordinates: [longitude, latitude] required'
            }
        }
    },
    radius: {
        type: Number,
        required: true,
        min: 1,
        max: 100000 // Max 100km
    },

    fenceType: {
        type: String,
        required: true,
        enum: ['safety', 'restricted',],
        index: true
    },
   
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
}, {
    timestamps: true,
    collection: 'geofences',
    toJSON: {
        transform: function(doc, ret) {
            ret.id = ret._id;
            delete ret._id;
            delete ret.__v;
            return ret;
        }
    }
});


geofenceSchema.index({ location: '2dsphere' });

// Compound indexes for fetching geofences
geofenceSchema.index({ isActive: 1, fenceType: 1 });
geofenceSchema.index({ fenceType: 1, isActive: 1 });

const Geofence = mongoose.model('Geofence', geofenceSchema);

export default Geofence;