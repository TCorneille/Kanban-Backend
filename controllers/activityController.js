const Activity = require('../models/activity');

/**
 * @desc    Get recent activities for the logged-in user
 * @route   GET /api/activities/me
 * @access  Private
 */
const getMyActivities = async (req, res) => {
  try {
    // Safely check for user ID whether auth middleware attaches req.user.id or req.user._id
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User missing from request context',
      });
    }

    // .lean() retrieves plain JavaScript objects instead of heavy Mongoose documents
    const activities = await Activity.find({ user: userId })
      .sort({ createdAt: -1 }) // Newest first
      .limit(10)               // Last 10 activities
      .lean();

    // Map _id to id so frontend components receive clean React keys
    const formattedActivities = activities.map((item) => ({
      ...item,
      id: item._id.toString(),
    }));

    // Standardized JSON response payload
    return res.status(200).json({
      success: true,
      count: formattedActivities.length,
      data: formattedActivities,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server Error fetching activities',
      error: error.message,
    });
  }
};

module.exports = { getMyActivities };