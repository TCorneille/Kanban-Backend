const Activity = require('../models/activity');

/**
 * @desc    Get recent activities for the logged-in user
 * @route   GET /api/v1/activities/me
 * @access  Private
 */
exports.getMyActivities = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User ID missing from context',
      });
    }

    const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);

    const activities = await Activity.find({ user: userId })
      .populate({ path: 'user', select: 'name email avatar', strictPopulate: false })
      .populate({ path: 'workspace', select: 'name slug', strictPopulate: false })
      .populate({ path: 'board', select: 'name title', strictPopulate: false })
      .populate({ path: 'task', select: 'title', strictPopulate: false })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const formattedData = activities.map((item) => ({
      ...item,
      id: item._id ? item._id.toString() : String(Math.random()),
    }));

    return res.status(200).json({
      success: true,
      count: formattedData.length,
      data: formattedData,
    });
  } catch (error) {
    console.error('💥 Error in getMyActivities:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve user activities',
      error: error.message,
    });
  }
};