// models/taskModel.js
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'A task must have a title'],
  },
  boardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Board',
    required: true,
  },
  // 💡 Change this from ObjectId to String
  columnId: {
    type: String,
    required: true,
    enum: ['todo', 'in_progress', 'done'], // optional: enforce valid columns
  },
  position: {
    type: Number,
    default: 0,
  },
});

module.exports = mongoose.model('Task', taskSchema);