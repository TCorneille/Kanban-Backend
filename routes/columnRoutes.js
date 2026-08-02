// src/routes/boardRoutes.js
const express = require('express');
const boardController = require('../controllers/boardController');
const taskRouter = require('./taskRoutes');
const columnRouter = require('./columnRoutes'); // <--- Import column router
const { protect } = require('../controllers/authController');

const router = express.Router({ mergeParams: true });

router.use(protect);

/* =====================================================
    🔀 NESTED SUB-ROUTERS
===================================================== */
router.use('/:boardId/tasks', taskRouter);
router.use('/:boardId/columns', columnRouter); // <--- Mount column router

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

module.exports = router;