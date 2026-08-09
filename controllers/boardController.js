const Board = require('../models/boardModel');
const Task = require('../models/taskModel');
const Activity = require('../models/activity'); // 💡 Imported Activity Model
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
      workspace: extra.workspaceId || null,
      board: extra.boardId || null,
    });
  } catch (error) {
    console.error('⚠️ Activity logging error:', error.message);
  }
};

// Get all boards for a specific workspace
exports.getBoards = catchAsync(async (req, res, next) => {
  const workspaceId = req.params.workspaceId || req.query.workspace;

  if (!workspaceId) {
    return next(new AppError('Please provide a workspace ID', 400));
  }

  const boards = await Board.find({ workspace: workspaceId });

  res.status(200).json({
    status: 'success',
    results: boards.length,
    data: { boards },
  });
});

// Create board with automatic position & activity logging
exports.createBoard = catchAsync(async (req, res, next) => {
  const workspaceId = req.params.workspaceId || req.body.workspace;

  if (!workspaceId) {
    return next(new AppError('A board must belong to a workspace', 400));
  }

  const newBoard = await Board.create({
    title: req.body.title || req.body.name,
    workspace: workspaceId,
    columns: req.body.columns || [
      { title: 'To Do', position: 0 },
      { title: 'In Progress', position: 1 },
      { title: 'Done', position: 2 },
    ],
  });

  // 🚀 AUTOMATIC LOG: Board Created
  logActivity(
    req.user?._id || req.user?.id,
    'BOARD_CREATED',
    `Created board "${newBoard.title}"`,
    { workspaceId, boardId: newBoard._id }
  );

  res.status(201).json({
    status: 'success',
    data: { board: newBoard },
  });
});

// Get single board by ID along with its tasks
exports.getBoardById = catchAsync(async (req, res, next) => {
  const board = await Board.findById(req.params.boardId);
  if (!board) return next(new AppError('No board found with that ID', 404));

  // Handles both 'board' and 'boardId' field names in Task schema
  const tasks = await Task.find({
    $or: [{ board: req.params.boardId }, { boardId: req.params.boardId }],
  }).sort('position');

  res.status(200).json({
    status: 'success',
    data: { board, tasks },
  });
});

// Update board & log updates
exports.updateBoard = catchAsync(async (req, res, next) => {
  const board = await Board.findByIdAndUpdate(req.params.boardId, req.body, {
    new: true,
    runValidators: true,
  });

  if (!board) return next(new AppError('No board found with that ID', 404));

  // 🚀 AUTOMATIC LOG: Board Updated
  logActivity(
    req.user?._id || req.user?.id,
    'BOARD_UPDATED',
    `Updated board "${board.title}"`,
    { workspaceId: board.workspace, boardId: board._id }
  );

  res.status(200).json({
    status: 'success',
    data: { board },
  });
});

// Delete board, associated tasks, & log deletion
exports.deleteBoard = catchAsync(async (req, res, next) => {
  const board = await Board.findById(req.params.boardId);
  if (!board) return next(new AppError('No board found with that ID', 404));

  // Clean up associated tasks before removing the board
  await Task.deleteMany({
    $or: [{ board: req.params.boardId }, { boardId: req.params.boardId }],
  });
  await board.deleteOne();

  // 🚀 AUTOMATIC LOG: Board Deleted
  logActivity(
    req.user?._id || req.user?.id,
    'BOARD_DELETED',
    `Deleted board "${board.title}"`,
    { workspaceId: board.workspace }
  );

  res.status(204).json({
    status: 'success',
    data: null,
  });
});