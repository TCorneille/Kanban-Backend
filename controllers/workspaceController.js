const Workspace = require('../models/workspaceModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

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

exports.createWorkspace = catchAsync(async (req, res, next) => {
  const newWorkspace = await Workspace.create({
    name: req.body.name,
    description: req.body.description,
    owner: req.user.id,
    members: [{ user: req.user.id, role: 'admin' }],
  });

  res.status(201).json({
    status: 'success',
    data: { workspace: newWorkspace },
  });
});

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

exports.updateWorkspace = catchAsync(async (req, res, next) => {
  const workspace = await Workspace.findByIdAndUpdate(
    req.params.workspaceId,
    { name: req.body.name, description: req.body.description },
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

exports.addMember = catchAsync(async (req, res, next) => {
  const { userId, role } = req.body;
  const workspace = await Workspace.findById(req.params.workspaceId);

  if (!workspace) return next(new AppError('Workspace not found', 404));

  workspace.members.push({ user: userId, role: role || 'member' });
  await workspace.save();

  res.status(200).json({ status: 'success', data: { workspace } });
});

exports.updateMemberRole = catchAsync(async (req, res, next) => {
  const { workspaceId, userId } = req.params;
  const { role } = req.body;

  const workspace = await Workspace.findOneAndUpdate(
    { _id: workspaceId, 'members.user': userId },
    { $set: { 'members.$.role': role } },
    { new: true }
  );

  res.status(200).json({ status: 'success', data: { workspace } });
});

exports.removeMember = catchAsync(async (req, res, next) => {
  const workspace = await Workspace.findByIdAndUpdate(
    req.params.workspaceId,
    { $pull: { members: { user: req.params.userId } } },
    { new: true }
  );

  res.status(200).json({ status: 'success', data: { workspace } });
});