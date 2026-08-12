const express = require('express');
const workspaceController = require('../controllers/workspaceController');
const authController = require('../controllers/authController');

const router = express.Router();

// 1. All routes below require user authentication
router.use(authController.protect);

// 2. User-level workspace routes
router.get('/dashboard-stats', workspaceController.getDashboardStats);
router.get('/', workspaceController.getUserWorkspaces);
router.post('/', workspaceController.createWorkspace);

// 3. Protect all routes with workspaceId param - checks if user is owner or member
router.use('/:workspaceId', workspaceController.restrictToWorkspaceMembers);

// Members and Owners can read workspace details
router.get('/:workspaceId', workspaceController.getWorkspaceById);

// Only Owners and Admin roles can update workspace details
router.patch(
  '/:workspaceId',
  workspaceController.restrictToRoles('owner', 'admin'),
  workspaceController.updateWorkspace
);

// Only Workspace Owner can delete the workspace
router.delete(
  '/:workspaceId',
  workspaceController.restrictToRoles('owner'),
  workspaceController.deleteWorkspace
);

// 4. Member Management Routes (Owners & Admins only)
router.post(
  '/:workspaceId/members',
  workspaceController.restrictToRoles('owner', 'admin'),
  workspaceController.addMember
);

router.patch(
  '/:workspaceId/members/:userId',
  workspaceController.restrictToRoles('owner', 'admin'),
  workspaceController.updateMemberRole
);

router.delete(
  '/:workspaceId/members/:userId',
  workspaceController.restrictToRoles('owner', 'admin'),
  workspaceController.removeMember
);

module.exports = router;