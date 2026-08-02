const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please tell us your name!'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide your email!'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Please provide a password!'],
      minlength: [8, 'A password must have at least 8 characters'],
      validate: {
        validator: function (value) {
          // Enforces: 1 lowercase, 1 uppercase, 1 digit, 1 special character
          return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#\-_~^+=])\S{8,}$/.test(value);
        },
        message:
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
      },
      select: false, // Prevents password hash from being returned in standard queries
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    subscriptionPlan: {
      type: String,
      default: 'free',
    },
    passwordResetToken: {
      type: String,
      select: false, // Prevents token hash leakage
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    passwordChangedAt: Date,
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  }
);

/* =====================================================
    🔒 ENCRYPTION HOOK
===================================================== */
userSchema.pre('save', async function () {
  // Only run this function if password was actually modified
  if (!this.isModified('password')) return;

  // Hash the password with a cost factor of 12
  this.password = await bcrypt.hash(this.password, 12);

  // Set passwordChangedAt if document is modified (not on initial creation)
  if (!this.isNew) {
    this.passwordChangedAt = Date.now() - 1000; // Subtract 1s to prevent JWT race conditions
  }
});

/* =====================================================
    🛠️ INSTANCE METHODS
===================================================== */

// 1. Compare candidate password with hashed password during login
userSchema.methods.correctPassword = async function (candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// 2. Generate and hash password reset token
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Hash token before storing in database
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expiration (10 minutes)
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  // Return unencrypted token to be sent in reset email
  return resetToken;
};

// 3. Verify if password was changed after a JWT token was issued
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

const User = mongoose.model('User', userSchema);
module.exports = User;