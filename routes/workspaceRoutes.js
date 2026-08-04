const express = require('express');
const workspaceController = require('../controllers/workspaceController');
const boardRouter = require('./boardRoutes');
const { protect, restrictTo } = require('../controllers/authController');

const router = express.Router();

// Protect all routes with JWT authentication
router.use(protect);

/* =====================================================
    📊 DASHBOARD STATS ROUTE
    MUST be defined BEFORE parameterized routes (/:workspaceId)
===================================================== */
router.get('/stats', workspaceController.getDashboardStats);

/* =====================================================
    🔀 NESTED ROUTES MOUNTING
    Redirects /api/workspaces/:workspaceId/boards to boardRouter
===================================================== */
router.use('/:workspaceId/boards', boardRouter);

/* =====================================================
    🏢 WORKSPACE CRUD ROUTES (/api/workspaces)
===================================================== */

router
  .route('/')
  .get(workspaceController.getUserWorkspaces) // Fetch all workspaces for the logged-in user
  .post(workspaceController.createWorkspace);

router
  .route('/:workspaceId')
  .get(workspaceController.getWorkspaceById)
  .patch(restrictTo('admin'), workspaceController.updateWorkspace)
  .delete(restrictTo('admin'), workspaceController.deleteWorkspace);

/* =====================================================
    👥 MEMBER MANAGEMENT ROUTES
===================================================== */

router
  .route('/:workspaceId/members')
  .post(restrictTo('admin'), workspaceController.addMember);

router
  .route('/:workspaceId/members/:userId')
  .patch(restrictTo('admin'), workspaceController.updateMemberRole)
  .delete(restrictTo('admin'), workspaceController.removeMember);

module.exports = router;