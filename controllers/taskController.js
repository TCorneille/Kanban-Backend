const Task = require('../models/taskModel');
const Board = require('../models/boardModel');
const Activity = require('../models/activity');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

/* =====================================================
   🛠️ HELPER FUNCTIONS
===================================================== */

/**
 * Universal helper to record activities safely without crashing main operations.
 * Supports both object parameter and positional parameter styles.
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
 * Resolves column titles from board.columns array matching column ObjectId strings.
 */
const getColumnTitle = (board, colId) => {
  if (!board || !board.columns || !colId) return 'a column';

  const colIdStr = colId.toString();

  const col = board.columns.find((c) => {
    const cId = c._id ? c._id.toString() : c.id;
    return cId === colIdStr;
  });

  return col ? col.title : 'a column';
};

/* =====================================================
   🎮 CONTROLLER HANDLERS
===================================================== */

/**
 * @desc    Get all tasks for a board
 * @route   GET /api/v1/tasks?boardId=xxx OR GET /api/v1/boards/:boardId/tasks
 * @access  Private
 */
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

/**
 * @desc    Create a new task & log activity
 * @route   POST /api/v1/tasks
 * @access  Private
 */
exports.createTask = catchAsync(async (req, res, next) => {
  const boardId = req.params.boardId || req.body.boardId || req.body.board;

  if (!boardId) {
    return next(new AppError('A task must belong to a board', 400));
  }

  // Calculate highest position index in target column
  const taskCount = await Task.countDocuments({
    $or: [{ board: boardId }, { boardId }],
    columnId: req.body.columnId,
  });

  const newTask = await Task.create({
    title: req.body.title,
    description: req.body.description,
    board: boardId,
    boardId: boardId,
    columnId: req.body.columnId,
    priority: req.body.priority || 'medium',
    position: req.body.position ?? taskCount,
    assignedTo: req.body.assignedTo,
    dueDate: req.body.dueDate,
  });

  // Fetch workspace reference for logging if board exists
  let workspaceId = null;
  try {
    const board = await Board.findById(boardId);
    if (board) workspaceId = board.workspace;
  } catch (err) {
    /* Silent catch for board lookup */
  }

  // 🚀 AUTOMATIC LOG: Task Created
  logActivity({
    userId: req.user?._id || req.user?.id,
    actionType: 'TASK_CREATED',
    details: `Created task "${newTask.title}"`,
    workspaceId,
    boardId,
    taskId: newTask._id,
  });

  res.status(201).json({
    status: 'success',
    data: { task: newTask },
  });
});

/**
 * @desc    Get task details by ID
 * @route   GET /api/v1/tasks/:taskId
 * @access  Private
 */
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

/**
 * @desc    Update task details & log updates
 * @route   PATCH /api/v1/tasks/:taskId
 * @access  Private
 */
exports.updateTask = catchAsync(async (req, res, next) => {
  const task = await Task.findByIdAndUpdate(req.params.taskId, req.body, {
    new: true,
    runValidators: true,
  });

  if (!task) return next(new AppError('No task found with that ID', 404));

  const boardId = task.board || task.boardId;

  // 🚀 AUTOMATIC LOG: Task Updated
  logActivity({
    userId: req.user?._id || req.user?.id,
    actionType: 'TASK_UPDATED',
    details: `Updated task "${task.title}"`,
    boardId,
    taskId: task._id,
  });

  res.status(200).json({
    status: 'success',
    data: { task },
  });
});

/**
 * @desc    Move task between columns with automatic column title resolution
 * @route   PATCH /api/v1/tasks/:taskId/move
 * @access  Private
 */
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

  let sourceColName = 'a column';
  let targetColName = 'a column';
  let workspaceId = null;

  // 2. Fetch board to resolve exact column titles
  if (boardId) {
    try {
      const board = await Board.findById(boardId);
      if (board) {
        workspaceId = board.workspace;
        sourceColName = getColumnTitle(board, oldColumnId);
        targetColName = getColumnTitle(board, columnId);
      }
    } catch (boardErr) {
      console.warn('⚠️ Board/Column lookup warning:', boardErr.message);
    }
  }

  // 3. Update task column and position
  task.columnId = columnId;
  if (position !== undefined) task.position = position;
  await task.save();

  // 4. Log activity string
  const details = `Moved "${task.title}" from ${sourceColName} to ${targetColName}`;

  logActivity({
    userId,
    actionType: 'TASK_MOVED',
    details,
    workspaceId,
    boardId,
    taskId: task._id,
  });

  // 5. Send clean success response
  res.status(200).json({
    status: 'success',
    data: { task },
  });
});

/**
 * @desc    Delete task, adjust position indices, & log deletion
 * @route   DELETE /api/v1/tasks/:taskId
 * @access  Private
 */
exports.deleteTask = catchAsync(async (req, res, next) => {
  const task = await Task.findByIdAndDelete(req.params.taskId);
  if (!task) return next(new AppError('No task found with that ID', 404));

  const boardId = task.board || task.boardId;

  // Shift remaining tasks up by 1 in position within column
  await Task.updateMany(
    {
      $or: [{ board: boardId }, { boardId }],
      columnId: task.columnId,
      position: { $gt: task.position },
    },
    { $inc: { position: -1 } }
  );

  // 🚀 AUTOMATIC LOG: Task Deleted
  logActivity({
    userId: req.user?._id || req.user?.id,
    actionType: 'TASK_DELETED',
    details: `Deleted task "${task.title}"`,
    boardId,
  });

  res.status(200).json({
    status: 'success',
    data: null,
  });
});