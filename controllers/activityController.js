const Activity = require('../models/activity');

/**
 * @desc    Get recent activities for the logged-in user
 * @route   GET /api/activities/me
 * @access  Private
 */
const getMyActivities = async (req, res) => {
  try {
    // Safely check for user ID from auth middleware
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User ID missing from context',
      });
    }

    const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);

    // Fetch user activities and populate references
    const activities = await Activity.find({ user: userId })
      .populate('workspace', 'name slug')
      .populate('board', 'name')
      .populate('task', 'title')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Ensure _id maps to id for frontend React keys
    const formattedData = activities.map((item) => ({
      ...item,
      id: item._id.toString(),
    }));

    return res.status(200).json({
      success: true,
      count: formattedData.length,
      data: formattedData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve user activities',
      error: error.message,
    });
  }
};

module.exports = {
  getMyActivities,
};