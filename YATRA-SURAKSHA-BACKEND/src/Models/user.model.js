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
        sparse: true
    },
    clerkID: {
        type: String,
        required: function() {
            return this.providers.includes('clerk');
        },
        unique: true,
        sparse: true
    },
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phoneNumber: {
        type: String,
        required: false
    },
    alteratePhoneNumber: {
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
    }
}, { timestamps: true });

userSchema.index({ firebaseUID: 1 });
userSchema.index({ clerkID: 1 });
userSchema.index({ email: 1 });
userSchema.index({ phoneNumber: 1 });
userSchema.index({ role: 1 });

export default mongoose.model('User', userSchema);