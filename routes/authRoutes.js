const express = require("express");
const authController = require("../controllers/authController"); // Adjust path based on your file structure

const router = express.Router();

// ================= PUBLIC ROUTES =================
// Anyone can access these routes
router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.post("/logout", authController.logout);

router.post("/forgotPassword", authController.forgotPassword);
router.patch("/resetPassword/:token", authController.resetPassword);

// ================= PROTECTED ROUTES =================
// Everything below this middleware requires the user to be logged in
router.use(authController.protect);

router.patch("/updateMyPassword", authController.updatePassword);

// ================= RESTRICTED ROUTES (Example) =================
// Everything below this middleware requires the user to be logged in AND have a specific role
// router.delete("/deleteUser/:id", authController.restrictTo("admin"), userController.deleteUser);

module.exports = router;
