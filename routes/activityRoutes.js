const express = require('express');
const router = express.Router();
const { getMyActivities } = require('../controllers/activityController'); // Adjust path if needed
const { protect } = require('../controllers/authController')

/**
 * @route   GET /api/activities/me
 * @desc    Get recent activities for logged-in user
 * @access  Private
 */
router.get('/me', protect, getMyActivities);

module.exports = router;