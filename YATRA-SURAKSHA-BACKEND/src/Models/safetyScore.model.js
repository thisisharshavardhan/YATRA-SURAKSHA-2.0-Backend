import mongoose from 'mongoose';

const safetyScoreSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
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
            required: true,
            validate: {
                validator: function(coords) {
                    return coords.length === 2 &&
                        coords[0] >= -180 && coords[0] <= 180 &&
                        coords[1] >= -90 && coords[1] <= 90;
                },
                message: 'Invalid coordinates'
            }
        }
    },
    population: {
        type: Number,
        default: 0,
        min: 0
    },
    populationDensity: {
        type: Number,
        default: 0,
        min: 0
    },
    crimeRate: {
        type: Number,
        default: 0,
        min: 0
    },
    safetyScore: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    safetyRank: {
        type: Number,
        min: 1
    },
    riskLevel: {
        type: String,
        enum: ['Low Risk', 'Moderate Risk', 'Medium Risk', 'High Risk', 'Extreme Risk'],
        required: true
    },
    // Data freshness
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    collection: 'safety_scores',
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
safetyScoreSchema.index({ location: '2dsphere' });

// Text index for name search
safetyScoreSchema.index({ name: 'text' });

// Compound indexes for common queries
safetyScoreSchema.index({ safetyScore: -1 }); // Sort by score
safetyScoreSchema.index({ riskLevel: 1, safetyScore: -1 });
safetyScoreSchema.index({ safetyRank: 1 });

const SafetyScore = mongoose.model('SafetyScore', safetyScoreSchema);

export default SafetyScore;
