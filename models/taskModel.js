const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'A task must have a title'],
      trim: true,
      maxlength: [100, 'A task title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    boardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Board',
      required: [true, 'A task must belong to a board'],
      index: true,
    },
    columnId: {
      type: String,
      required: [true, 'A task must belong to a column'],
      index: true,
    },
    position: {
      type: Number,
      default: 0,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ✅ Direct default export
const Task = mongoose.model('Task', taskSchema);
module.exports = Task;