const Activity = require('../models/activity');

// @desc    Get recent activities for the logged-in user
// @route   GET /api/activities/me
// @access  Private
const getMyActivities = async (req, res) => {
  try {
    // req.user.id comes from your auth/JWT middleware
    const activities = await Activity.find({ user: req.user.id })
      .sort({ createdAt: -1 }) // Newest first
      .limit(10);              // Only return the last 10 activities

    res.status(200).json(activities);
  } catch (error) {
    res.status(500).json({ message: 'Server Error fetching activities', error: error.message });
  }
};

module.exports = { getMyActivities };