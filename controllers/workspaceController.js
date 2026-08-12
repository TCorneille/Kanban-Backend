const slugify = require('slugify');
const Workspace = require('../models/workspaceModel');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Board = require('../models/boardModel');
const Task = require('../models/taskModel');

// ==========================================
// ACCESS CONTROL MIDDLEWARES
// ==========================================

// Middleware: Restrict access to members or owners of the workspace
exports.restrictToWorkspaceMembers = catchAsync(async (req, res, next) => {
  const workspaceId = req.params.workspaceId;
  const userId = (req.user._id || req.user.id).toString();

  const workspace = await Workspace.findById(workspaceId);

  if (!workspace) {
    return next(new AppError('No workspace found with that ID', 404));
  }

  // Check if user is the owner
  const isOwner = workspace.owner.toString() === userId;

  // Check if user is in members array
  const isMember = workspace.members.some((member) => {
    const memberId = member.user?._id ? member.user._id.toString() : member.user.toString();
    return memberId === userId;
  });

  if (!isOwner && !isMember) {
    return next(new AppError('You do not have access to this workspace', 403));
  }

  // Attach workspace object to request to avoid re-querying in route handlers
  req.workspace = workspace;
  next();
});

// Middleware: Restrict specific actions based on member roles (e.g., 'owner', 'admin')
exports.restrictToRoles = (...allowedRoles) => {
  return (req, res, next) => {
    const userId = (req.user._id || req.user.id).toString();
    const isOwner = req.workspace.owner.toString() === userId;

    let userRole = 'member';
    if (isOwner) {
      userRole = 'owner';
    } else {
      const memberRecord = req.workspace.members.find((m) => {
        const memberId = m.user?._id ? m.user._id.toString() : m.user.toString();
        return memberId === userId;
      });
      userRole = memberRecord?.role || 'member';
    }

    if (!allowedRoles.includes(userRole)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }

    next();
  };
};

// ==========================================
// CONTROLLER HANDLERS
// ==========================================

// Get all workspaces user belongs to or owns
exports.getUserWorkspaces = catchAsync(async (req, res, next) => {
  const userId = req.user._id || req.user.id;

  const workspaces = await Workspace.find({
    $or: [{ owner: userId }, { 'members.user': userId }],
  })
    .populate('owner', 'name email')
    .populate('members.user', 'name email');

  res.status(200).json({
    status: 'success',
    results: workspaces.length,
    data: { workspaces },
  });
});

// Create workspace
exports.createWorkspace = catchAsync(async (req, res, next) => {
  const userId = req.user._id || req.user.id;

  const newWorkspace = await Workspace.create({
    name: req.body.name,
    description: req.body.description,
    owner: userId,
    members: [{ user: userId, role: 'owner' }],
  });

  res.status(201).json({
    status: 'success',
    data: { workspace: newWorkspace },
  });
});

// Get workspace by ID
exports.getWorkspaceById = catchAsync(async (req, res, next) => {
  const workspace = await Workspace.findById(req.params.workspaceId)
    .populate('owner', 'name email')
    .populate('members.user', 'name email');

  if (!workspace) {
    return next(new AppError('No workspace found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { workspace },
  });
});

// Update workspace
exports.updateWorkspace = catchAsync(async (req, res, next) => {
  const updateData = { description: req.body.description };

  if (req.body.name) {
    updateData.name = req.body.name;
    updateData.slug = slugify(req.body.name, { lower: true, strict: true });
  }

  const workspace = await Workspace.findByIdAndUpdate(
    req.params.workspaceId,
    updateData,
    { new: true, runValidators: true }
  );

  if (!workspace) {
    return next(new AppError('No workspace found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { workspace },
  });
});

// Delete workspace
exports.deleteWorkspace = catchAsync(async (req, res, next) => {
  const workspace = await Workspace.findByIdAndDelete(req.params.workspaceId);

  if (!workspace) {
    return next(new AppError('No workspace found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// Add member (Supports receiving either `email` or `userId` in req.body)
exports.addMember = catchAsync(async (req, res, next) => {
  const { email, userId: providedUserId, role } = req.body;
  let targetUserId = providedUserId;

  // 1. Resolve email to user ID if necessary
  if (!targetUserId && email) {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return next(new AppError('No user found with that email address', 404));
    }
    targetUserId = user._id;
  }

  if (!targetUserId) {
    return next(new AppError('Please provide either a userId or email', 400));
  }

  // 2. Fetch workspace (or use req.workspace attached by middleware)
  const workspace = req.workspace || (await Workspace.findById(req.params.workspaceId));
  if (!workspace) return next(new AppError('Workspace not found', 404));

  // 3. Safe membership check
  const isAlreadyMember = workspace.members.some((member) => {
    const memberId = member.user?._id ? member.user._id.toString() : member.user.toString();
    return memberId === targetUserId.toString();
  });

  if (isAlreadyMember) {
    return next(new AppError('User is already a member of this workspace', 400));
  }

  // 4. Push, save, and safely populate
  workspace.members.push({ user: targetUserId, role: role || 'member' });
  await workspace.save();

  const updatedWorkspace = await Workspace.findById(workspace._id)
    .populate('owner', 'name email')
    .populate('members.user', 'name email');

  res.status(200).json({ status: 'success', data: { workspace: updatedWorkspace } });
});

// Update member role
exports.updateMemberRole = catchAsync(async (req, res, next) => {
  const { workspaceId, userId } = req.params;
  const { role } = req.body;

  const workspace = await Workspace.findOneAndUpdate(
    { _id: workspaceId, 'members.user': userId },
    { $set: { 'members.$.role': role } },
    { new: true, runValidators: true }
  ).populate('members.user', 'name email');

  if (!workspace) {
    return next(new AppError('Workspace or member not found', 404));
  }

  res.status(200).json({ status: 'success', data: { workspace } });
});

// Remove member
exports.removeMember = catchAsync(async (req, res, next) => {
  const workspace = await Workspace.findByIdAndUpdate(
    req.params.workspaceId,
    { $pull: { members: { user: req.params.userId } } },
    { new: true }
  ).populate('members.user', 'name email');

  if (!workspace) {
    return next(new AppError('Workspace not found', 404));
  }

  res.status(200).json({ status: 'success', data: { workspace } });
});

// Dashboard Statistics
exports.getDashboardStats = catchAsync(async (req, res, next) => {
  const userId = req.user._id || req.user.id;

  // 1. Find all workspaces the user owns or belongs to
  const userWorkspaces = await Workspace.find({
    $or: [{ owner: userId }, { 'members.user': userId }],
  }).select('_id');

  const workspaceIds = userWorkspaces.map((w) => w._id);

  // 2. Find all boards across those workspaces
  const userBoards = await Board.find({
    $or: [
      { workspaceId: { $in: workspaceIds } },
      { workspace: { $in: workspaceIds } },
    ],
  }).select('_id');

  const boardIds = userBoards.map((b) => b._id);

  if (boardIds.length === 0) {
    return res.status(200).json({
      status: 'success',
      data: {
        workspaces: workspaceIds.length,
        openTasks: 0,
        completedTasks: 0,
        overdueTasks: 0,
      },
    });
  }

  // 3. Fetch all tasks associated with the user's boards
  const allTasks = await Task.find({ boardId: { $in: boardIds } });

  // 4. Calculate task metrics dynamically
  const completedPattern = /done|completed|finish/i;
  const now = new Date();

  let openTasks = 0;
  let completedTasks = 0;
  let overdueTasks = 0;

  allTasks.forEach((task) => {
    const isCompleted = completedPattern.test(task.columnId || '');

    if (isCompleted) {
      completedTasks++;
    } else {
      openTasks++;
      if (task.dueDate && new Date(task.dueDate) < now) {
        overdueTasks++;
      }
    }
  });

  res.status(200).json({
    status: 'success',
    data: {
      workspaces: workspaceIds.length,
      openTasks,
      completedTasks,
      overdueTasks,
    },
  });
});