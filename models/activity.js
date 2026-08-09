const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
    // User who performed the action
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'An activity must belong to a user'],
      index: true,
    },
    // The workspace where this action took place (Optional)
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      index: true,
    },
    // Optional reference to a specific board
    board: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Board',
    },
    // Optional reference to a specific task/card
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
    },
    actionType: {
      type: String,
      required: true,
      enum: [
        'WORKSPACE_CREATED',
        'WORKSPACE_UPDATED',
        'MEMBER_JOINED',
        'BOARD_CREATED',
        'BOARD_UPDATED',
        'BOARD_DELETED',
        'TASK_CREATED',
        'TASK_MOVED',
        'TASK_UPDATED',
        'TASK_ASSIGNED',
        'TASK_COMPLETED',
        'TASK_DELETED',
      ],
    },
    details: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

/* =====================================================
   ⚡ COMPOUND INDEXES FOR TIMELINE QUERIES
===================================================== */
activitySchema.index({ workspace: 1, createdAt: -1 });
activitySchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);