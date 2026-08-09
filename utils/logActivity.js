const Activity = require('../models/activity');

/**
 * Universally handles both object-style and positional-style activity logging
 */
const logActivity = async (firstArg, secondArg, thirdArg, fourthArg = {}) => {
  try {
    let userId, actionType, details, workspaceId, boardId, taskId;

    // 1. Detect if called with an object: logActivity({ userId, actionType, ... })
    if (
      typeof firstArg === 'object' &&
      firstArg !== null &&
      !firstArg._bsontype &&
      firstArg.constructor?.name !== 'ObjectId'
    ) {
      ({ userId, actionType, details, workspaceId, boardId, taskId } = firstArg);
    } else {
      // 2. Handle positional call: logActivity(userId, actionType, details, { boardId, taskId })
      userId = firstArg;
      actionType = secondArg;
      details = thirdArg;
      workspaceId = fourthArg.workspaceId;
      boardId = fourthArg.boardId;
      taskId = fourthArg.taskId;
    }

    // Validation guard
    if (!userId || !actionType || !details) {
      console.warn('⚠️ [logActivity] Missing required fields:', { userId: !!userId, actionType: !!actionType, details: !!details });
      return;
    }

    const activity = await Activity.create({
      user: userId,
      actionType,
      details,
      workspace: workspaceId || null,
      board: boardId || null,
      task: taskId || null,
    });

    console.log('✅ [logActivity] Saved:', activity.actionType, '-', activity.details);
  } catch (error) {
    console.error('❌ [logActivity] Failed to save to MongoDB:', error.message);
  }
};

module.exports = logActivity;