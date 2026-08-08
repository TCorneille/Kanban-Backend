const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
    // User who performed the action
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // The workspace where this action took place
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    // Optional reference to a specific board
    board: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Board',
    },
    // Optional reference to a specific task/card for direct UI deep-linking
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
    },
    actionType: {
      type: String,
      required: true,
      enum: [
        'WORKSPACE_CREATED',
        'MEMBER_JOINED',
        'BOARD_CREATED',
        'TASK_CREATED',
        'TASK_MOVED',
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
// Fast timeline fetching per workspace (newest first)
activitySchema.index({ workspace: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);