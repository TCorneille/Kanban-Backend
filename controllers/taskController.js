const Task = require('../models/taskModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.createTask = catchAsync(async (req, res, next) => {
  const newTask = await Task.create(req.body);

  res.status(201).json({
    status: 'success',
    data: { task: newTask },
  });
});

exports.getTaskById = catchAsync(async (req, res, next) => {
  const task = await Task.findById(req.params.taskId).populate('assignedTo', 'name email');
  if (!task) return next(new AppError('No task found with that ID', 404));

  res.status(200).json({
    status: 'success',
    data: { task },
  });
});

exports.updateTask = catchAsync(async (req, res, next) => {
  const task = await Task.findByIdAndUpdate(req.params.taskId, req.body, {
    new: true,
    runValidators: true,
  });

  if (!task) return next(new AppError('No task found with that ID', 404));

  res.status(200).json({
    status: 'success',
    data: { task },
  });
});

exports.moveTask = catchAsync(async (req, res, next) => {
  const { columnId, position } = req.body;

  const task = await Task.findByIdAndUpdate(
    req.params.taskId,
    { columnId, position },
    { new: true }
  );

  if (!task) return next(new AppError('No task found with that ID', 404));

  res.status(200).json({
    status: 'success',
    data: { task },
  });
});

exports.deleteTask = catchAsync(async (req, res, next) => {
  const task = await Task.findByIdAndDelete(req.params.taskId);
  if (!task) return next(new AppError('No task found with that ID', 404));

  res.status(204).json({
    status: 'success',
    data: null,
  });
});