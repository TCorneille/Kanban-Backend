const Board = require('../models/boardModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.createColumn = catchAsync(async (req, res, next) => {
  const board = await Board.findById(req.params.boardId);
  if (!board) return next(new AppError('No board found with that ID', 404));

  const newColumn = {
    title: req.body.title,
    position: board.columns.length,
  };

  board.columns.push(newColumn);
  await board.save();

  res.status(201).json({
    status: 'success',
    data: { board },
  });
});

exports.updateColumn = catchAsync(async (req, res, next) => {
  const { boardId, columnId } = req.params;

  const board = await Board.findOneAndUpdate(
    { _id: boardId, 'columns._id': columnId },
    { $set: { 'columns.$.title': req.body.title } },
    { new: true }
  );

  if (!board) return next(new AppError('Board or column not found', 404));

  res.status(200).json({
    status: 'success',
    data: { board },
  });
});

exports.deleteColumn = catchAsync(async (req, res, next) => {
  const { boardId, columnId } = req.params;

  const board = await Board.findByIdAndUpdate(
    boardId,
    { $pull: { columns: { _id: columnId } } },
    { new: true }
  );

  res.status(200).json({
    status: 'success',
    data: { board },
  });
});