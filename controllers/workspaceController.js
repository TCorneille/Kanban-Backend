const slugify = require('slugify');
const Workspace = require('../models/workspaceModel');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Board = require('../models/boardModel');
const Task = require('../models/taskModel');

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

  // 2. Fetch workspace
  const workspace = await Workspace.findById(req.params.workspaceId);
  if (!workspace) return next(new AppError('Workspace not found', 404));

  // 3. Safe membership check (handles ObjectIds and string formats smoothly)
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
exports.getDashboardStats = catchAsync(async (req, res, next) => {
  const userId = req.user._id || req.user.id;

  // 1. Get all workspace IDs the logged-in user belongs to or owns
  const userWorkspaces = await Workspace.find({
    $or: [{ owner: userId }, { 'members.user': userId }],
  }).select('_id');

  const workspaceIds = userWorkspaces.map((w) => w._id);

  // 2. Fetch all boards linked to these workspaces
  const userBoards = await Board.find({
    workspaceId: { $in: workspaceIds }, // Adjust field name if your Board model uses 'workspace' or 'workspaceId'
  }).select('_id');

  const boardIds = userBoards.map((b) => b._id);

  // 3. Define column IDs that count as "completed" vs "open"
  const COMPLETED_COLUMNS = ['done', 'completed'];

  // 4. Run parallel queries for optimal performance
  const [openTasks, completedTasks, overdueTasks] = await Promise.all([
    // Open tasks: Belongs to user's boards AND NOT in a completed column
    Task.countDocuments({
      boardId: { $in: boardIds },
      columnId: { $nin: COMPLETED_COLUMNS },
    }),

    // Completed tasks: Belongs to user's boards AND in a completed column
    Task.countDocuments({
      boardId: { $in: boardIds },
      columnId: { $in: COMPLETED_COLUMNS },
    }),

    // Overdue tasks: Due date has passed AND NOT in a completed column
    Task.countDocuments({
      boardId: { $in: boardIds },
      columnId: { $nin: COMPLETED_COLUMNS },
      dueDate: { $lt: new Date() },
    }),
  ]);

  // 5. Send response payload expected by frontend
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