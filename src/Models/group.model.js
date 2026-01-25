import mongoose from "mongoose";
import crypto from "crypto";

const groupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
        index: true
    },
    groupPictureURL: {
        type: String,
        required: false
    },
    description: {
        type: String,
        required: false,
        trim: true,
        maxlength: 500
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    members: {
        type: [{
            userID: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
            role: { type: String, enum: ['admin', 'member'], default: 'member' },
            joinedAt: { type: Date, default: Date.now }
        }],
        default: []
    },
    joinCode: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        minlength: 6,
        maxlength: 8
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    }
}, {
    timestamps: true,
    collection: 'groups',
    toJSON: {
        virtuals: true,
        transform: function(doc, ret) {
            ret.id = ret._id;
            delete ret._id;
            delete ret.__v;
            return ret;
        }
    }
});

// Index for finding groups by member
groupSchema.index({ 'members.userID': 1 });

// Compound index for active groups by creator
groupSchema.index({ createdBy: 1, isActive: 1 });

// Virtual for member count
groupSchema.virtual('memberCount').get(function() {
    return this.members.length;
});

// Static method to generate unique join code
groupSchema.statics.generateJoinCode = async function() {
    let code;
    let exists = true;
    while (exists) {
        code = crypto.randomBytes(3).toString('hex').toUpperCase();
        exists = await this.findOne({ joinCode: code });
    }
    return code;
};

// Pre-save hook to add creator as admin
groupSchema.pre('save', function() {
    if (this.isNew && this.createdBy) {
        const creatorExists = this.members.some(
            m => m.userID.toString() === this.createdBy.toString()
        );
        if (!creatorExists) {
            this.members.push({
                userID: this.createdBy,
                role: 'admin'
            });
        }
    }
});

const Group = mongoose.model('Group', groupSchema);

export default Group;