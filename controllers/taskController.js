const Task = require('../models/taskModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// Get all tasks for a board
exports.getTasks = catchAsync(async (req, res, next) => {
  const boardId = req.params.boardId || req.query.board;

  if (!boardId) {
    return next(new AppError('Please provide a board ID', 400));
  }

  const tasks = await Task.find({ board: boardId }).sort('position');

  res.status(200).json({
    status: 'success',
    results: tasks.length,
    data: { tasks },
  });
});

// Create task with automatic position calculation
exports.createTask = catchAsync(async (req, res, next) => {
  const boardId = req.params.boardId || req.body.board;

  if (!boardId) {
    return next(new AppError('A task must belong to a board', 400));
  }

  // Calculate highest position in target column
  const taskCount = await Task.countDocuments({
    board: boardId,
    columnId: req.body.columnId,
  });

  const newTask = await Task.create({
    title: req.body.title,
    description: req.body.description,
    board: boardId,
    columnId: req.body.columnId,
    position: req.body.position ?? taskCount,
    assignedTo: req.body.assignedTo,
    dueDate: req.body.dueDate,
  });

  res.status(201).json({
    status: 'success',
    data: { task: newTask },
  });
});

// Get task details by ID
exports.getTaskById = catchAsync(async (req, res, next) => {
  const task = await Task.findById(req.params.taskId).populate(
    'assignedTo',
    'name email avatar'
  );

  if (!task) return next(new AppError('No task found with that ID', 404));

  res.status(200).json({
    status: 'success',
    data: { task },
  });
});

// Update task details
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

// Move task and shift positions of siblings in target column
exports.moveTask = catchAsync(async (req, res, next) => {
  const { columnId, position } = req.body;
  const { taskId } = req.params;

  const currentTask = await Task.findById(taskId);
  if (!currentTask) return next(new AppError('No task found with that ID', 404));

  const targetColumn = columnId || currentTask.columnId;
  const targetPosition = position ?? currentTask.position;

  // Shift existing tasks at or after target position in target column
  await Task.updateMany(
    {
      board: currentTask.board,
      columnId: targetColumn,
      position: { $gte: targetPosition },
      _id: { $ne: taskId },
    },
    { $inc: { position: 1 } }
  );

  currentTask.columnId = targetColumn;
  currentTask.position = targetPosition;
  await currentTask.save();

  res.status(200).json({
    status: 'success',
    data: { task: currentTask },
  });
});

// Delete task and adjust surrounding indices
exports.deleteTask = catchAsync(async (req, res, next) => {
  const task = await Task.findByIdAndDelete(req.params.taskId);
  if (!task) return next(new AppError('No task found with that ID', 404));

  // Shift remaining tasks down by 1 in column
  await Task.updateMany(
    {
      board: task.board,
      columnId: task.columnId,
      position: { $gt: task.position },
    },
    { $inc: { position: -1 } }
  );

  res.status(204).json({
    status: 'success',
    data: null,
  });
});