const slugify = require('slugify');
const Workspace = require('../models/workspaceModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// Get all workspaces user belongs to or owns
exports.getUserWorkspaces = catchAsync(async (req, res, next) => {
  const workspaces = await Workspace.find({
    $or: [{ owner: req.user.id }, { 'members.user': req.user.id }],
  }).populate('owner', 'name email');

  res.status(200).json({
    status: 'success',
    results: workspaces.length,
    data: { workspaces },
  });
});

// Create workspace (owner added automatically via pre('save') hook)
exports.createWorkspace = catchAsync(async (req, res, next) => {
  const newWorkspace = await Workspace.create({
    name: req.body.name,
    description: req.body.description,
    owner: req.user.id,
    // Note: members array is handled by the model hook automatically
  });

  res.status(201).json({
    status: 'success',
    data: { workspace: newWorkspace },
  });
});

// Get workspace by ID with populated owner & member details
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

// Update workspace details & sync slug if name changes
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

// Add new member (with duplicate check)
exports.addMember = catchAsync(async (req, res, next) => {
  const { userId, role } = req.body;
  const workspace = await Workspace.findById(req.params.workspaceId);

  if (!workspace) return next(new AppError('Workspace not found', 404));

  // Check if user is already a member
  if (workspace.isMember(userId)) {
    return next(new AppError('User is already a member of this workspace', 400));
  }

  workspace.members.push({ user: userId, role: role || 'member' });
  await workspace.save();

  res.status(200).json({ status: 'success', data: { workspace } });
});

// Update role of an existing member
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

// Remove a member from workspace
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