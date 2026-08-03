const slugify = require('slugify');
const Workspace = require('../models/workspaceModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// Get all workspaces user belongs to or owns
exports.getUserWorkspaces = catchAsync(async (req, res, next) => {
  const userId = req.user._id || req.user.id;
  
  // 🔍 Check what backend receives from JWT
  console.log('Backend querying workspaces for User ID:', userId);

  const workspaces = await Workspace.find({
    $or: [{ owner: userId }, { 'members.user': userId }],
  }).populate('owner', 'name email');

  console.log('Workspaces found in DB:', workspaces);

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

// Add member
exports.addMember = catchAsync(async (req, res, next) => {
  const { userId, role } = req.body;
  const workspace = await Workspace.findById(req.params.workspaceId);

  if (!workspace) return next(new AppError('Workspace not found', 404));

  if (workspace.isMember(userId)) {
    return next(new AppError('User is already a member of this workspace', 400));
  }

  workspace.members.push({ user: userId, role: role || 'member' });
  await workspace.save();

  res.status(200).json({ status: 'success', data: { workspace } });
});

// Update member role
exports.updateMemberRole = catchAsync(async (req, res, next) => {
  const { workspaceId, userId } = req.params;
  const { role } = req.body;

  const workspace = await Workspace.findOneAndUpdate(
    { _id: workspaceId, 'members.user': userId },
    { $set: { 'members.$.role': role } },
    { new: true, runValidators: true }
  );

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
  );

  if (!workspace) {
    return next(new AppError('Workspace not found', 404));
  }

  res.status(200).json({ status: 'success', data: { workspace } });
});