const express = require('express');
const taskController = require('../controllers/taskController');
const { protect } = require('../controllers/authController');

// mergeParams: true allows access to :boardId if nested under boardRouter
const router = express.Router({ mergeParams: true });

// Protect all task routes
router.use(protect);

/* =====================================================
    📝 TASK ROUTES
===================================================== */

router
  .route('/')
  .get(taskController.getTasks) // <-- ADD THIS to fetch tasks for the board
  .post(taskController.createTask);

router
  .route('/:taskId')
  .get(taskController.getTaskById)
  .patch(taskController.updateTask)
  .delete(taskController.deleteTask);

// Special endpoint for drag-and-drop / column move
router
  .route('/:taskId/move')
  .patch(taskController.moveTask);

module.exports = router;