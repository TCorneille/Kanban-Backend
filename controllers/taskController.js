const Task = require('../models/taskModel');
const Activity = require('../models/activity'); // 💡 Activity Model imported
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

/**
 * Helper to record activities without interrupting the main controller logic
 */
const logActivity = async (userId, actionType, details, extra = {}) => {
  try {
    if (!userId) return;
    await Activity.create({
      user: userId,
      actionType,
      details,
      board: extra.boardId || null,
      task: extra.taskId || null,
    });
  } catch (error) {
    console.error('⚠️ Activity logging error:', error.message);
  }
};

// Get all tasks for a board
exports.getTasks = catchAsync(async (req, res, next) => {
  const boardId = req.params.boardId || req.query.boardId || req.query.board;

  if (!boardId) {
    return next(new AppError('Please provide a board ID', 400));
  }

  const tasks = await Task.find({ boardId }).sort('position');

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

  // Calculate highest position in target column
  const taskCount = await Task.countDocuments({
    boardId,
    columnId: req.body.columnId,
  });

  const newTask = await Task.create({
    title: req.body.title,
    description: req.body.description,
    boardId,
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
    { boardId: task.boardId, taskId: task._id }
  );

  res.status(200).json({
    status: 'success',
    data: { task },
  });
});

exports.moveTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { columnId, position } = req.body;
    const userId = req.user?.id || req.user?._id;

    // 1. Fetch current task before moving it
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const oldColumnId = task.columnId;

    // 2. Fetch the board to resolve column titles from subdocuments
    const board = await Board.findById(task.board);

    let sourceColName = 'a column';
    let targetColName = 'a column';

    if (board && board.columns) {
      // Mongoose subdocument helper .id() searches columns by _id
      const sourceCol = board.columns.id(oldColumnId);
      if (sourceCol) sourceColName = sourceCol.title;

      const targetCol = board.columns.id(columnId);
      if (targetCol) targetColName = targetCol.title;
    }

    // 3. Update task column and position
    task.columnId = columnId;
    if (position !== undefined) task.position = position;
    await task.save();

    // 4. Log activity with real column names
    const details = `Moved "${task.title}" from ${sourceColName} to ${targetColName}`;

    await logActivity({
      userId,
      actionType: 'TASK_MOVED',
      details,
      workspaceId: board?.workspace,
      boardId: task.board,
      taskId: task._id,
    });

    return res.status(200).json({
      success: true,
      data: { task },
    });
  } catch (error) {
    console.error('❌ Error in moveTask:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to move task',
      error: error.message,
    });
  }
};

// Delete task, adjust surrounding indices, & log deletion
exports.deleteTask = catchAsync(async (req, res, next) => {
  const task = await Task.findByIdAndDelete(req.params.taskId);
  if (!task) return next(new AppError('No task found with that ID', 404));

  // Shift remaining tasks down by 1 in column
  await Task.updateMany(
    {
      boardId: task.boardId,
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
    { boardId: task.boardId }
  );

  res.status(204).json({
    status: 'success',
    data: null,
  });
});