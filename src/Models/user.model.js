import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    providers: {
        type: [String],
        required: true,
        enum: ['firebase', 'clerk']
    },
    firebaseUID: {
        type: String,
        required: function() {
            return this.providers.includes('firebase');
        },
        unique: true,
        sparse: true,
        trim: true
    },
    clerkID: {
        type: String,
        required: function() {
            return this.providers.includes('clerk');
        },
        unique: true,
        sparse: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    phoneNumber: {
        type: String,
        required: false
    },
    alternativePhoneNumber: {
        type: String,
        required: false
    },
    whatsappNumber: {
        type: String,
        required: false
    },
    emergencyContacts: {
        type: [{
            name: { type: String, required: true },
            relation: { type: String, required: true },
            phoneNumber: { type: String, required: true }
        }],
        required: false
    },
    healthInfo: {
        type: {
            bloodGroup: { type: String, required: false },
            allergies: { type: [String], required: false },
            chronicDiseases: { type: [String], required: false },
            medications: { type: [String], required: false }
        },
        required: false
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    dateOfBirth: {
        type: Date,
        required: false
    },
    profilePicture: {
        type: String,
        required: false
    },
    nationality: {
        type: String,
        required: false
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    gender: {
        type: String,
        enum: ['male', 'female', 'other'],
        required: false
    },
    permissions: {
        type: {
            allowLocationAccess: { type: Boolean, default: true },
            allowNotificationAccess: { type: Boolean, default: true },
            allowSmsAccess: { type: Boolean, default: false }
        }
    }
}, { 
    timestamps: true,
    collection: 'users',
    toJSON: {
        virtuals: true,
        transform: function(doc, ret) {
            ret.id = ret._id;
            delete ret._id;
            delete ret.__v;
            return ret;
        }
    },
    toObject: { virtuals: true }
});

// Only add indexes for fields not already marked unique (unique creates index)
userSchema.index({ phoneNumber: 1 }, { sparse: true });
userSchema.index({ role: 1 });
userSchema.index({ isVerified: 1 });
userSchema.index({ createdAt: -1 });

export default mongoose.model('User', userSchema);