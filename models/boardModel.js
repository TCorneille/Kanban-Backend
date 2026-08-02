const mongoose = require('mongoose');

const boardSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'A board must have a title'],
      trim: true,
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'A board must belong to a workspace'],
    },
    columns: [
      {
        title: {
          type: String,
          required: [true, 'A column must have a title'],
        },
        position: {
          type: Number,
          default: 0,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Board = mongoose.model('Board', boardSchema);
module.exports = Board;