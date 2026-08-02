const Board = require('../models/boardModel');
const Task = require('../models/taskModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.getBoards = catchAsync(async (req, res, next) => {
  const boards = await Board.find({ workspace: req.params.workspaceId });

  res.status(200).json({
    status: 'success',
    results: boards.length,
    data: { boards },
  });
});

exports.createBoard = catchAsync(async (req, res, next) => {
  const workspaceId = req.params.workspaceId || req.body.workspace;

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

exports.getBoardById = catchAsync(async (req, res, next) => {
  const board = await Board.findById(req.params.boardId);
  if (!board) return next(new AppError('No board found with that ID', 404));

  const tasks = await Task.find({ board: req.params.boardId }).sort('position');

  res.status(200).json({
    status: 'success',
    data: { board, tasks },
  });
});

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

exports.deleteBoard = catchAsync(async (req, res, next) => {
  const board = await Board.findByIdAndDelete(req.params.boardId);
  if (!board) return next(new AppError('No board found with that ID', 404));

  await Task.deleteMany({ board: req.params.boardId });

  res.status(204).json({
    status: 'success',
    data: null,
  });
});