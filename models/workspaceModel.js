const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A member must be associated with a valid User ID'],
    },
    role: {
      type: String,
      enum: {
        values: ['owner', 'admin', 'member'],
        message: 'Role must be either: OWNER, ADMIN, or MEMBER',
      },
      default: 'member',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false } // Avoid generating separate _id for embedded member subdocuments
);

const workspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A workspace must have a name'],
      trim: true,
      maxlength: [50, 'Workspace name cannot exceed 50 characters'],
    },
    slug: {
      type: String,
      required: [true, 'A workspace must have a slug'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [250, 'Description cannot exceed 250 characters'],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A workspace must have an owner'],
    },
    members: [memberSchema],
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* =====================================================
    ⚡ INDEXES FOR PERFORMANCE
===================================================== */
// Enables fast querying of all workspaces belonging to a specific user
workspaceSchema.index({ 'members.user': 1 });

// Slug index for URL lookups (e.g., /workspaces/my-team-slug)
workspaceSchema.index({ slug: 1 });

/* =====================================================
    🔗 VIRTUAL REPLIES / POPULATION
===================================================== */
// Virtual populate boards associated with this workspace
workspaceSchema.virtual('boards', {
  ref: 'Board',
  foreignField: 'workspace',
  localField: '_id',
});

/* =====================================================
    🛠️ INSTANCE & STATIC METHODS
===================================================== */

// Helper to check if a user is a member of this workspace
workspaceSchema.methods.isMember = function (userId) {
  return this.members.some(
    (member) => member.user.toString() === userId.toString()
  );
};

// Helper to check a user's role in the workspace
workspaceSchema.methods.getUserRole = function (userId) {
  const member = this.members.find(
    (m) => m.user.toString() === userId.toString()
  );
  return member ? member.role : null;
};

/* =====================================================
    🔒 MIDDLEWARE / HOOKS
===================================================== */

// Ensure the workspace owner is automatically added to the members array with 'OWNER' role
workspaceSchema.pre('save', function (next) {
  if (this.isNew) {
    const ownerExists = this.members.some(
      (member) => member.user.toString() === this.owner.toString()
    );

    if (!ownerExists) {
      this.members.push({
        user: this.owner,
        role: 'OWNER',
      });
    }
  }
  next();
});

const Workspace = mongoose.model('Workspace', workspaceSchema);
module.exports = Workspace;