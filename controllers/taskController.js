const Task = require('../models/taskModel');
const Board = require('../models/boardModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const logActivity = require('../utils/logActivity');

/**
 * Resolves column titles from board.columns array
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

// Create task & log activity
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
    boardId: boardId,
    columnId: req.body.columnId,
    priority: req.body.priority || 'medium',
    position: req.body.position ?? taskCount,
    assignedTo: req.body.assignedTo,
    dueDate: req.body.dueDate,
  });

  let workspaceId = null;
  try {
    const board = await Board.findById(boardId);
    if (board) workspaceId = board.workspace;
  } catch (err) {}

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

  const boardId = task.board || task.boardId;

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

// Move task between columns
exports.moveTask = catchAsync(async (req, res, next) => {
  const { taskId } = req.params;
  const { columnId, position } = req.body;
  const userId = req.user?.id || req.user?._id;

  const task = await Task.findById(taskId);
  if (!task) {
    return next(new AppError('Task not found', 404));
  }

  const oldColumnId = task.columnId;
  const boardId = task.board || task.boardId;

  let sourceColName = 'a column';
  let targetColName = 'a column';
  let workspaceId = null;

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

  task.columnId = columnId;
  if (position !== undefined) task.position = position;
  await task.save();

  const details = `Moved "${task.title}" from ${sourceColName} to ${targetColName}`;

  logActivity({
    userId,
    actionType: 'TASK_MOVED',
    details,
    workspaceId,
    boardId,
    taskId: task._id,
  });

  res.status(200).json({
    status: 'success',
    data: { task },
  });
});

// Delete task & adjust positions
exports.deleteTask = catchAsync(async (req, res, next) => {
  const task = await Task.findByIdAndDelete(req.params.taskId);
  if (!task) return next(new AppError('No task found with that ID', 404));

  const boardId = task.board || task.boardId;

  await Task.updateMany(
    {
      $or: [{ board: boardId }, { boardId }],
      columnId: task.columnId,
      position: { $gt: task.position },
    },
    { $inc: { position: -1 } }
  );

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