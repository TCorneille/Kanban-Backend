const Activity = require('../models/activity');

/
 * @param {Object} params
 * @param {string} params.userId - Logged-in user's ID (req.user.id or req.user._id)
 * @param {string} params.actionType - 'TASK_CREATED', 'TASK_MOVED', 'TASK_DELETED', 'BOARD_CREATED', etc.
 * @param {string} params.details - Descriptive string (e.g., 'Moved "Fix Auth" to Done')
 * @param {string} [params.workspaceId] - Optional Workspace reference
 * @param {string} [params.boardId] - Optional Board reference
 * @param {string} [params.taskId] - Optional Task reference
 */
const logActivity = async ({ userId, actionType, details, workspaceId, boardId, taskId }) => {
  try {
    if (!userId || !actionType || !details) return;

    await Activity.create({
      user: userId,
      actionType,
      details,
      workspace: workspaceId || null,
      board: boardId || null,
      task: taskId || null,
    });
  } catch (error) {
    // Non-blocking catch to prevent activity errors from breaking main user operations
    console.error('⚠️ Automatic activity logging failed:', error.message);
  }
};

module.exports = logActivity;