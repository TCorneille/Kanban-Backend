const express = require('express');
const boardController = require('../controllers/boardController');
const columnController = require('../controllers/columnController');
const taskRouter = require('./taskRoutes');
const { protect } = require('../controllers/authController');

// mergeParams: true ensures req.params.workspaceId is available when mounted as nested route
const router = express.Router({ mergeParams: true });

// Protect all board routes with authentication
router.use(protect);

/* =====================================================
    🔀 NESTED TASK ROUTE MOUNTING
    Redirects /api/workspaces/:workspaceId/boards/:boardId/tasks
===================================================== */
router.use('/:boardId/tasks', taskRouter);

/* =====================================================
    📋 BOARD CRUD ROUTES
===================================================== */

router
  .route('/')
  .get(boardController.getBoards)
  .post(boardController.createBoard);

router
  .route('/:boardId')
  .get(boardController.getBoardById)
  .patch(boardController.updateBoard)
  .delete(boardController.deleteBoard);

/* =====================================================
    🏛️ COLUMN ROUTES (/api/boards/:boardId/columns)
===================================================== */

router
  .route('/:boardId/columns')
  .post(columnController.createColumn);

router
  .route('/:boardId/columns/:columnId')
  .patch(columnController.updateColumn)
  .delete(columnController.deleteColumn);

module.exports = router;