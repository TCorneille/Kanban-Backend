const Activity = require('../models/activity');

/**
 * Universal helper supporting both single-object and positional arguments.
 */
const logActivity = async (firstArg, secondArg, thirdArg, fourthArg = {}) => {
  try {
    let userId, actionType, details, workspaceId, boardId, taskId;

    // Detect single-object call: logActivity({ userId, actionType, details, ... })
    if (
      typeof firstArg === 'object' &&
      firstArg !== null &&
      !firstArg._bsontype &&
      firstArg.constructor?.name !== 'ObjectId'
    ) {
      ({ userId, actionType, details, workspaceId, boardId, taskId } = firstArg);
    } else {
      // Positional call: logActivity(userId, actionType, details, extra)
      userId = firstArg;
      actionType = secondArg;
      details = thirdArg;
      workspaceId = fourthArg.workspaceId;
      boardId = fourthArg.boardId || fourthArg.board;
      taskId = fourthArg.taskId || fourthArg.task;
    }

    if (!userId) return;

    await Activity.create({
      user: userId,
      actionType,
      details,
      workspace: workspaceId || null,
      board: boardId || null,
      task: taskId || null,
    });
  } catch (error) {
    console.error('⚠️ Activity logging error:', error.message);
  }
};

module.exports = logActivity;