const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const validator = require('validator');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please tell us your name!'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },

    email: {
      type: String,
      required: [true, 'Please provide your email!'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: validator.isEmail,
        message: 'Please provide a valid email address.',
      },
    },

    password: {
      type: String,
      required: [true, 'Please provide a password!'],
      minlength: [8, 'Password must have at least 8 characters'],
      validate: {
        validator: function (value) {
          // At least:
          // - 1 uppercase
          // - 1 lowercase
          // - 1 number
          // - 1 special character
          return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#\-_~^+=])[A-Za-z\d@$!%*?&.#\-_~^+=]{8,}$/.test(
            value
          );
        },
        message:
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
      },
      select: false,
    },

    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },

    subscriptionPlan: {
      type: String,
      enum: ['free', 'premium', 'enterprise'],
      default: 'free',
    },

    passwordResetToken: {
      type: String,
      select: false,
    },

    passwordResetExpires: {
      type: Date,
      select: false,
    },

    passwordChangedAt: Date,
  },
  {
    timestamps: true,
  }
);

/* =====================================================
   HASH PASSWORD BEFORE SAVING
===================================================== */
userSchema.pre('save', async function () {
  // Only hash if password was modified
  if (!this.isModified('password')) return;

  // Hash password
  this.password = await bcrypt.hash(this.password, 12);

  // Set passwordChangedAt except for new users
  if (!this.isNew) {
    this.passwordChangedAt = Date.now() - 1000;
  }
});

/* =====================================================
   INSTANCE METHODS
===================================================== */

/**
 * Compare login password with hashed password
 */
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

/**
 * Generate password reset token
 */
userSchema.methods.createPasswordResetToken = function () {
  // Generate random token
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Save hashed token in database
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Token expires in 10 minutes
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  // Return plain token
  return resetToken;
};

/**
 * Check if password changed after JWT was issued
 */
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );

    return JWTTimestamp < changedTimestamp;
  }

  return false;
};

const User = mongoose.model('User', userSchema);

module.exports = User;