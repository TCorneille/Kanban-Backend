const Activity = require('../models/Activity');

/**
 * @desc    Get activity timeline for a specific workspace
 * @route   GET /api/workspaces/:workspaceId/activities
 * @access  Private (Requires workspace membership)
 */
const getWorkspaceActivities = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const limit = parseInt(req.query.limit, 10) || 15;

    const activities = await Activity.find({ workspace: workspaceId })
      .populate('user', 'name avatar email') // Populate user info for avatar display
      .populate('board', 'name')
      .populate('task', 'title')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      count: activities.length,
      data: activities,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch workspace activities',
      error: error.message,
    });
  }
};

module.exports = { getWorkspaceActivities };