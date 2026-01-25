import mongoose from 'mongoose';
import Group from '../Models/group.model.js';
import User from '../Models/user.model.js';
import Location from '../Models/location.model.js';
import { asyncHandler, BadRequestError, NotFoundError, ForbiddenError } from '../Middlewares/error.middleware.js';

/**
 * @desc    Create a new group
 * @route   POST /api/groups
 * @access  Private
 */
export const createGroup = asyncHandler(async (req, res) => {
    const { name, description, groupPictureURL } = req.body;

    if (!name || name.trim().length === 0) {
        throw new BadRequestError('Group name is required');
    }

    // Generate unique join code
    const joinCode = await Group.generateJoinCode();

    const group = await Group.create({
        name: name.trim(),
        description: description?.trim(),
        groupPictureURL,
        createdBy: req.user._id,
        joinCode
    });

    // Populate creator info
    await group.populate('members.userID', 'name email profilePicture');

    res.status(201).json({
        success: true,
        message: 'Group created successfully',
        data: group
    });
});

/**
 * @desc    Get my groups (groups I'm a member of)
 * @route   GET /api/groups
 * @access  Private
 */
export const getMyGroups = asyncHandler(async (req, res) => {
    const groups = await Group.find({
        'members.userID': req.user._id,
        isActive: true
    })
    .populate('members.userID', 'name email profilePicture')
    .populate('createdBy', 'name email profilePicture')
    .sort({ updatedAt: -1 });

    res.status(200).json({
        success: true,
        data: groups
    });
});

/**
 * @desc    Get group by ID
 * @route   GET /api/groups/:id
 * @access  Private (members only)
 */
export const getGroupById = asyncHandler(async (req, res) => {
    const group = await Group.findById(req.params.id)
        .populate('members.userID', 'name email profilePicture phoneNumber')
        .populate('createdBy', 'name email profilePicture');

    if (!group) {
        throw new NotFoundError('Group not found');
    }

    // Check if user is a member
    const isMember = group.members.some(
        m => m.userID._id.toString() === req.user._id.toString()
    );

    if (!isMember) {
        throw new ForbiddenError('You are not a member of this group');
    }

    res.status(200).json({
        success: true,
        data: group
    });
});

/**
 * @desc    Update group details
 * @route   PUT /api/groups/:id
 * @access  Private (admin only)
 */
export const updateGroup = asyncHandler(async (req, res) => {
    const { name, description, groupPictureURL } = req.body;

    const group = await Group.findById(req.params.id);

    if (!group) {
        throw new NotFoundError('Group not found');
    }

    // Check if user is admin of the group
    const member = group.members.find(
        m => m.userID.toString() === req.user._id.toString()
    );

    if (!member || member.role !== 'admin') {
        throw new ForbiddenError('Only group admins can update group details');
    }

    // Update fields
    if (name) group.name = name.trim();
    if (description !== undefined) group.description = description?.trim() || '';
    if (groupPictureURL !== undefined) group.groupPictureURL = groupPictureURL;

    await group.save();
    await group.populate('members.userID', 'name email profilePicture');

    res.status(200).json({
        success: true,
        message: 'Group updated successfully',
        data: group
    });
});

/**
 * @desc    Join group using join code
 * @route   POST /api/groups/join
 * @access  Private
 */
export const joinGroup = asyncHandler(async (req, res) => {
    const { joinCode } = req.body;

    if (!joinCode) {
        throw new BadRequestError('Join code is required');
    }

    const group = await Group.findOne({ 
        joinCode: joinCode.toUpperCase(),
        isActive: true 
    });

    if (!group) {
        throw new NotFoundError('Invalid join code or group not found');
    }

    // Check if already a member
    const isMember = group.members.some(
        m => m.userID.toString() === req.user._id.toString()
    );

    if (isMember) {
        throw new BadRequestError('You are already a member of this group');
    }

    // Add user as member
    group.members.push({
        userID: req.user._id,
        role: 'member'
    });

    await group.save();
    await group.populate('members.userID', 'name email profilePicture');

    res.status(200).json({
        success: true,
        message: 'Successfully joined the group',
        data: group
    });
});

/**
 * @desc    Leave group
 * @route   POST /api/groups/:id/leave
 * @access  Private
 */
export const leaveGroup = asyncHandler(async (req, res) => {
    const group = await Group.findById(req.params.id);

    if (!group) {
        throw new NotFoundError('Group not found');
    }

    const memberIndex = group.members.findIndex(
        m => m.userID.toString() === req.user._id.toString()
    );

    if (memberIndex === -1) {
        throw new BadRequestError('You are not a member of this group');
    }

    const member = group.members[memberIndex];

    // If leaving member is the only admin, check if there are other members
    if (member.role === 'admin') {
        const adminCount = group.members.filter(m => m.role === 'admin').length;
        
        if (adminCount === 1 && group.members.length > 1) {
            throw new BadRequestError('Please promote another member to admin before leaving');
        }
        
        // If last member, deactivate the group
        if (group.members.length === 1) {
            group.isActive = false;
        }
    }

    // Remove member
    group.members.splice(memberIndex, 1);
    await group.save();

    res.status(200).json({
        success: true,
        message: 'Successfully left the group'
    });
});

/**
 * @desc    Remove member from group
 * @route   DELETE /api/groups/:id/members/:userId
 * @access  Private (admin only)
 */
export const removeMember = asyncHandler(async (req, res) => {
    const { id, userId } = req.params;

    const group = await Group.findById(id);

    if (!group) {
        throw new NotFoundError('Group not found');
    }

    // Check if requester is admin
    const requester = group.members.find(
        m => m.userID.toString() === req.user._id.toString()
    );

    if (!requester || requester.role !== 'admin') {
        throw new ForbiddenError('Only group admins can remove members');
    }

    // Can't remove yourself using this endpoint
    if (userId === req.user._id.toString()) {
        throw new BadRequestError('Use the leave endpoint to leave the group');
    }

    const memberIndex = group.members.findIndex(
        m => m.userID.toString() === userId
    );

    if (memberIndex === -1) {
        throw new NotFoundError('Member not found in this group');
    }

    // Remove member
    group.members.splice(memberIndex, 1);
    await group.save();
    await group.populate('members.userID', 'name email profilePicture');

    res.status(200).json({
        success: true,
        message: 'Member removed successfully',
        data: group
    });
});

/**
 * @desc    Update member role (promote/demote)
 * @route   PUT /api/groups/:id/members/:userId/role
 * @access  Private (admin only)
 */
export const updateMemberRole = asyncHandler(async (req, res) => {
    const { id, userId } = req.params;
    const { role } = req.body;

    if (!role || !['admin', 'member'].includes(role)) {
        throw new BadRequestError('Role must be "admin" or "member"');
    }

    const group = await Group.findById(id);

    if (!group) {
        throw new NotFoundError('Group not found');
    }

    // Check if requester is admin
    const requester = group.members.find(
        m => m.userID.toString() === req.user._id.toString()
    );

    if (!requester || requester.role !== 'admin') {
        throw new ForbiddenError('Only group admins can change member roles');
    }

    // Find target member
    const targetMember = group.members.find(
        m => m.userID.toString() === userId
    );

    if (!targetMember) {
        throw new NotFoundError('Member not found in this group');
    }

    // Prevent demoting self if only admin
    if (userId === req.user._id.toString() && role === 'member') {
        const adminCount = group.members.filter(m => m.role === 'admin').length;
        if (adminCount === 1) {
            throw new BadRequestError('Cannot demote yourself. Promote another admin first.');
        }
    }

    targetMember.role = role;
    await group.save();
    await group.populate('members.userID', 'name email profilePicture');

    res.status(200).json({
        success: true,
        message: `Member role updated to ${role}`,
        data: group
    });
});

/**
 * @desc    Regenerate join code
 * @route   POST /api/groups/:id/regenerate-code
 * @access  Private (admin only)
 */
export const regenerateJoinCode = asyncHandler(async (req, res) => {
    const group = await Group.findById(req.params.id);

    if (!group) {
        throw new NotFoundError('Group not found');
    }

    // Check if user is admin
    const member = group.members.find(
        m => m.userID.toString() === req.user._id.toString()
    );

    if (!member || member.role !== 'admin') {
        throw new ForbiddenError('Only group admins can regenerate join code');
    }

    group.joinCode = await Group.generateJoinCode();
    await group.save();

    res.status(200).json({
        success: true,
        message: 'Join code regenerated',
        data: {
            joinCode: group.joinCode
        }
    });
});

/**
 * @desc    Get group members' locations
 * @route   GET /api/groups/:id/locations
 * @access  Private (members only)
 */
export const getGroupMembersLocations = asyncHandler(async (req, res) => {
    const group = await Group.findById(req.params.id);

    if (!group) {
        throw new NotFoundError('Group not found');
    }

    // Check if user is a member
    const isMember = group.members.some(
        m => m.userID.toString() === req.user._id.toString()
    );

    if (!isMember) {
        throw new ForbiddenError('You are not a member of this group');
    }

    // Get all member IDs
    const memberIds = group.members.map(m => m.userID);

    // Get latest location for each member
    const locations = await Location.aggregate([
        {
            $match: {
                userID: { $in: memberIds }
            }
        },
        {
            $sort: { timestamp: -1 }
        },
        {
            $group: {
                _id: '$userID',
                location: { $first: '$location' },
                timestamp: { $first: '$timestamp' },
                batteryLevel: { $first: '$batteryLevel' },
                speed: { $first: '$speed' }
            }
        }
    ]);

    // Get user info
    const users = await User.find({ _id: { $in: memberIds } })
        .select('name profilePicture permissions');

    const userMap = users.reduce((acc, user) => {
        acc[user._id.toString()] = user;
        return acc;
    }, {});

    // Combine data, respecting location sharing permissions
    const result = locations
        .filter(loc => {
            const user = userMap[loc._id.toString()];
            return user?.permissions?.allowLocationAccess !== false;
        })
        .map(loc => ({
            user: {
                id: loc._id,
                name: userMap[loc._id.toString()]?.name,
                profilePicture: userMap[loc._id.toString()]?.profilePicture
            },
            location: loc.location,
            timestamp: loc.timestamp,
            batteryLevel: loc.batteryLevel,
            speed: loc.speed
        }));

    res.status(200).json({
        success: true,
        data: result
    });
});

/**
 * @desc    Delete group
 * @route   DELETE /api/groups/:id
 * @access  Private (creator only)
 */
export const deleteGroup = asyncHandler(async (req, res) => {
    const group = await Group.findById(req.params.id);

    if (!group) {
        throw new NotFoundError('Group not found');
    }

    // Only creator can delete
    if (group.createdBy.toString() !== req.user._id.toString()) {
        throw new ForbiddenError('Only the group creator can delete the group');
    }

    // Soft delete - just deactivate
    group.isActive = false;
    await group.save();

    res.status(200).json({
        success: true,
        message: 'Group deleted successfully'
    });
});
