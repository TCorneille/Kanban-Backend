const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const User = require("../models/userModel");

const sendEmail = require("../utils/email");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

// ================= TOKEN HELPERS =================

const signToken = (id) => {
  // Hard crash fallback check for missing environment configuration properties
  if (!process.env.JWT_SECRET) {
    console.error("❌ ERROR: JWT_SECRET environment variable is missing on your server settings!");
  }
  
  return jwt.sign({ id }, process.env.JWT_SECRET || "fallback_secret_development_only", {
    expiresIn: process.env.JWT_EXPIRES_IN || "30d",
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  // Clean string values like "30d" or "90d" safely to calculate milliseconds
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "30d";
  const days = parseInt(jwtExpiresIn.replace(/[^0-9]/g, ""), 10) || 30;

  const cookieOptions = {
    expires: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    httpOnly: true,
  };

  // Ensure cookies use secure transport layers in production environments
  if (process.env.NODE_ENV === "production") {
    cookieOptions.secure = true;
    cookieOptions.sameSite = "none"; // Essential for cross-site cookie sharing on Render
  }

  res.cookie("jwt", token, cookieOptions);

  // Strip password variables away from the outbound JSON document payload
  user.password = undefined;
  user.confirmPassword = undefined;

  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user,
    },
  });
};

// ================= SIGNUP =================

exports.signup = catchAsync(async (req, res, next) => {
  // 1) Create the new user
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    role: req.body.role
  });

  // 2) Design the Welcome Email Text & HTML contents
  const welcomeMessage = `Welcome to Vow wow, ${newUser.name}!\nYour account has been successfully created. We are thrilled to have you on board!`;

  const welcomeHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e4; border-radius: 5px;">
      <h2 style="color: #74583D99; text-align: center;">Welcome to Vow wow! 🎉</h2>
      <p>Hello <strong>${newUser.name}</strong>,</p>
      <p>Thank you for joining us! Your account has been successfully created using the email address: <em>${newUser.email}</em>.</p>
      <p>We are dedicated to giving you the best experience possible. You can now log in, complete your profile, and explore everything we have to offer.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${req.protocol}://${req.get("host")}" target="_blank" style="background-color: #74583D99; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Go to Dashboard</a>
      </div>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #999999; font-size: 12px; text-align: center;">If you did not sign up for this account, please contact our support team immediately.</p>
    </div>
  `;

  // 3) Fire-and-forget failsafe design pattern for asynchronous background email delivery
  // This guarantees that any missing/broken server SMTP environment configuration won't trigger a 500 error for users signing up
  sendEmail({
    email: newUser.email,
    subject: "Welcome to Vow wow! Account Created Successfully",
    message: welcomeMessage,
    html: welcomeHtml,
  }).catch((err) => {
    console.error("⚠️ BACKGROUND EMAIL ERROR: Email setup failed or environment credentials are missing.", err.message);
  });

  // 4) Automatically issue cookie, sign token, strip passwords, and respond
  createSendToken(newUser, 201, res);
});

// ================= LOGIN =================

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if email and password exist in the request
  if (!email || !password) {
    return next(new AppError("Please provide email and password!", 400));
  }

  // 2) Check if user exists & password is correct
  const user = await User.findOne({ email }).select("+password");

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return next(new AppError("Incorrect email or password", 401));
  }

  // 3) If everything is ok, send token to client
  createSendToken(user, 200, res);
});

// ================= LOGOUT (POST) =================

exports.logout = (req, res) => {
  const cookieOptions = {
    expires: new Date(Date.now() - 1000), // Expiries instantly (1 second ago)
    httpOnly: true,
  };

  // Ensure options match the sign-in cookie configuration exactly
  if (process.env.NODE_ENV === "production") {
    cookieOptions.secure = true;
    cookieOptions.sameSite = "none"; // Required for cross-domain cookie clearance on Render
  }

  res.cookie("jwt", "loggedout", cookieOptions);

  res.status(200).json({
    status: "success",
    message: "Logged out successfully"
  });
};

// ================= PROTECT ROUTE =================

exports.protect = catchAsync(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) return next(new AppError("You are not logged in!", 401));

  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const currentUser = await User.findById(decoded.id);

  if (!currentUser) {
    return next(new AppError("User not found. Please log in again.", 401));
  }

  req.user = currentUser;
  next();
});

// ================= ROLE AUTHORIZATION =================

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403),
      );
    }

    next();
  };
};

// ================= FORGOT PASSWORD =================

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Find user by posted email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError("No user found with that email address.", 404));
  }

  // 2) Generate the random reset token (saves hashed version to DB)
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // 3) Create reset URL
  const resetURL = `${req.protocol}://${req.get(
    "host",
  )}/api/v1/auth/resetPassword/${resetToken}`;

  // 4) Design the Email Text & HTML contents
  const message = `Forgot your password? Submit a PATCH request with your new password and confirmPassword to: ${resetURL}.\nIf you didn't forget your password, please ignore this email.`;

  const htmlMessage = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e4; border-radius: 5px;">
      <h2 style="color: #333333;">Password Reset Request</h2>
      <p>Hello ${user.name || "there"},</p>
      <p>We received a request to reset your password for your <strong>Vow wow</strong> account. Click the button below to reset it. This link is only valid for 10 minutes.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetURL}" target="_blank" style="background-color: #74583D99; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Reset Your Password</a>
      </div>
      <p style="color: #666666; font-size: 12px;">If the button above doesn't work, copy and paste this URL into your web browser:</p>
      <p style="color: #0066cc; font-size: 12px; word-break: break-all;">${resetURL}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #999999; font-size: 12px;">If you did not request this change, you can safely ignore this email. Your password will remain secure.</p>
    </div>
  `;

  // 5) Try to send email
  try {
    await sendEmail({
      email: user.email,
      subject: "Your password reset token (Valid for 10 min)",
      message,
      html: htmlMessage,
    });

    res.status(200).json({
      status: "success",
      message: "Token sent to email successfully!",
    });
  } catch (err) {
    // If mail setup fails, instantly erase the token states from database
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        "There was an error sending the email. Try again later.",
        500,
      ),
    );
  }
});

// ================= RESET PASSWORD =================

exports.resetPassword = catchAsync(async (req, res, next) => {
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) return next(new AppError("Token is invalid or expired", 400));

  user.password = req.body.password;
  user.confirmPassword = req.body.confirmPassword;

  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();

  createSendToken(user, 200, res);
});

// ================= UPDATE PASSWORD =================

exports.updatePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword, newPasswordConfirm } = req.body;

  const user = await User.findById(req.user.id).select("+password");

  if (!user) return next(new AppError("User not found", 404));

  if (!(await bcrypt.compare(currentPassword, user.password)))
    return next(new AppError("Current password is wrong", 401));

  user.password = newPassword;
  user.confirmPassword = newPasswordConfirm;

  await user.save();

  createSendToken(user, 200, res);
});