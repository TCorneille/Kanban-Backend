const Task = require('../models/taskModel');
const Board = require('../models/boardModel'); // 💡 FIXED: Imported missing Board model
const Activity = require('../models/activity');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

/**
 * Universal helper to record activities without interrupting main operations.
 * Supports BOTH object-style and positional-style calls.
 */
const logActivity = async (firstArg, secondArg, thirdArg, fourthArg = {}) => {
  try {
    let userId, actionType, details, workspaceId, boardId, taskId;

    if (
      typeof firstArg === 'object' &&
      firstArg !== null &&
      !firstArg._bsontype &&
      firstArg.constructor?.name !== 'ObjectId'
    ) {
      ({ userId, actionType, details, workspaceId, boardId, taskId } = firstArg);
    } else {
      userId = firstArg;
      actionType = secondArg;
      details = thirdArg;
      workspaceId = fourthArg.workspaceId;
      boardId = fourthArg.boardId || fourthArg.board;
      taskId = fourthArg.taskId || fourthArg.task;
    }

    if (!userId) return;

    await Activity.create({
      user: userId,
      actionType,
      details,
      workspace: workspaceId || null,
      board: boardId || null,
      task: taskId || null,
    });
  } catch (error) {
    console.error('⚠️ Activity logging error:', error.message);
  }
};

/**
 * Safely looks up column titles without throwing CastError
 */
const getColumnTitle = (board, colId) => {
  if (!board || !board.columns || !colId) return 'a column';

  const col = board.columns.find(
    (c) =>
      c._id?.toString() === colId?.toString() ||
      c.id === colId
  );

  return col ? (col.title || col.name) : 'a column';
};

// Get all tasks for a board
exports.getTasks = catchAsync(async (req, res, next) => {
  const boardId = req.params.boardId || req.query.boardId || req.query.board;

  if (!boardId) {
    return next(new AppError('Please provide a board ID', 400));
  }

  const tasks = await Task.find({
    $or: [{ board: boardId }, { boardId }],
  }).sort('position');

  res.status(200).json({
    status: 'success',
    results: tasks.length,
    data: { tasks },
  });
});

// Create task with automatic position calculation & activity logging
exports.createTask = catchAsync(async (req, res, next) => {
  const boardId = req.params.boardId || req.body.boardId || req.body.board;

  if (!boardId) {
    return next(new AppError('A task must belong to a board', 400));
  }

  const taskCount = await Task.countDocuments({
    $or: [{ board: boardId }, { boardId }],
    columnId: req.body.columnId,
  });

  const newTask = await Task.create({
    title: req.body.title,
    description: req.body.description,
    board: boardId,
    boardId: boardId, // Keeps backwards compatibility
    columnId: req.body.columnId,
    priority: req.body.priority || 'medium',
    position: req.body.position ?? taskCount,
    assignedTo: req.body.assignedTo,
    dueDate: req.body.dueDate,
  });

  // 🚀 AUTOMATIC LOG: Task Created
  logActivity(
    req.user?._id || req.user?.id,
    'TASK_CREATED',
    `Created task "${newTask.title}"`,
    { boardId, taskId: newTask._id }
  );

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

// Update task details & log updates
exports.updateTask = catchAsync(async (req, res, next) => {
  const task = await Task.findByIdAndUpdate(req.params.taskId, req.body, {
    new: true,
    runValidators: true,
  });

  if (!task) return next(new AppError('No task found with that ID', 404));

  // 🚀 AUTOMATIC LOG: Task Updated
  logActivity(
    req.user?._id || req.user?.id,
    'TASK_UPDATED',
    `Updated task "${task.title}"`,
    { boardId: task.board || task.boardId, taskId: task._id }
  );

  res.status(200).json({
    status: 'success',
    data: { task },
  });
});

// Move task cleanly between columns with automatic column title resolution
exports.moveTask = catchAsync(async (req, res, next) => {
  const { taskId } = req.params;
  const { columnId, position } = req.body;
  const userId = req.user?.id || req.user?._id;

  // 1. Fetch current task
  const task = await Task.findById(taskId);
  if (!task) {
    return next(new AppError('Task not found', 404));
  }

  const oldColumnId = task.columnId;
  const boardId = task.board || task.boardId;

  // 2. Fetch board safely to resolve column names
  let sourceColName = 'a column';
  let targetColName = 'a column';
  let workspaceId = null;

  if (boardId) {
    try {
      const board = await Board.findById(boardId);
      if (board) {
        sourceColName = getColumnTitle(board, oldColumnId);
        targetColName = getColumnTitle(board, columnId);
        workspaceId = board.workspace;
      }
    } catch (boardErr) {
      console.warn('⚠️ Board/Column lookup warning:', boardErr.message);
    }
  }

  // 3. Update task location and position
  task.columnId = columnId;
  if (position !== undefined) task.position = position;
  await task.save();

  // 4. Log activity safely
  const details = `Moved "${task.title}" from ${sourceColName} to ${targetColName}`;

  logActivity({
    userId,
    actionType: 'TASK_MOVED',
    details,
    workspaceId,
    boardId,
    taskId: task._id,
  });

  // 5. Response matching frontend expected envelope
  res.status(200).json({
    status: 'success',
    data: { task },
  });
});

// Delete task, adjust surrounding indices, & log deletion
exports.deleteTask = catchAsync(async (req, res, next) => {
  const task = await Task.findByIdAndDelete(req.params.taskId);
  if (!task) return next(new AppError('No task found with that ID', 404));

  const boardId = task.board || task.boardId;

  // Shift remaining tasks down by 1 in column
  await Task.updateMany(
    {
      $or: [{ board: boardId }, { boardId }],
      columnId: task.columnId,
      position: { $gt: task.position },
    },
    { $inc: { position: -1 } }
  );

  // 🚀 AUTOMATIC LOG: Task Deleted
  logActivity(
    req.user?._id || req.user?.id,
    'TASK_DELETED',
    `Deleted task "${task.title}"`,
    { boardId }
  );

  res.status(200).json({
    status: 'success',
    data: null,
  });
});