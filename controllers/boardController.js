const Board = require('../models/boardModel');
const Task = require('../models/taskModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

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

// Create board
exports.createBoard = catchAsync(async (req, res, next) => {
  const workspaceId = req.params.workspaceId || req.body.workspace;

  if (!workspaceId) {
    return next(new AppError('A board must belong to a workspace', 400));
  }

  const newBoard = await Board.create({
    title: req.body.title,
    workspace: workspaceId,
    columns: req.body.columns || [
      { title: 'To Do', position: 0 },
      { title: 'In Progress', position: 1 },
      { title: 'Done', position: 2 },
    ],
  });

  res.status(201).json({
    status: 'success',
    data: { board: newBoard },
  });
});

// Get single board by ID along with its tasks
exports.getBoardById = catchAsync(async (req, res, next) => {
  const board = await Board.findById(req.params.boardId);
  if (!board) return next(new AppError('No board found with that ID', 404));

  const tasks = await Task.find({ board: req.params.boardId }).sort('position');

  res.status(200).json({
    status: 'success',
    data: { board, tasks },
  });
});

// Update board
exports.updateBoard = catchAsync(async (req, res, next) => {
  const board = await Board.findByIdAndUpdate(req.params.boardId, req.body, {
    new: true,
    runValidators: true,
  });

  if (!board) return next(new AppError('No board found with that ID', 404));

  res.status(200).json({
    status: 'success',
    data: { board },
  });
});

// Delete board and associated tasks safely
exports.deleteBoard = catchAsync(async (req, res, next) => {
  const board = await Board.findById(req.params.boardId);
  if (!board) return next(new AppError('No board found with that ID', 404));

  // Clean up associated tasks before removing the board
  await Task.deleteMany({ board: req.params.boardId });
  await board.deleteOne();

  res.status(204).json({
    status: 'success',
    data: null,
  });
});