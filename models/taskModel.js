const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'A task must have a title'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    board: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Board',
      required: [true, 'A task must belong to a board'],
    },
    columnId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'A task must belong to a specific column'],
    },
    position: {
      type: Number,
      default: 0,
    },
    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Task = mongoose.model('Task', taskSchema);
module.exports = Task;