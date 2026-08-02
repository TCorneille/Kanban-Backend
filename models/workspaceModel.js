const mongoose = require('mongoose');
const slugify = require('slugify');

/* =====================================================
   📌 SUBDOCUMENT SCHEMA: MEMBER
===================================================== */
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
        message: 'Role must be either: owner, admin, or member',
      },
      default: 'member',
      lowercase: true, // Converts incoming strings to lowercase automatically
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false } // Prevent generating individual _ids for member subdocuments
);

/* =====================================================
   📌 MAIN SCHEMA: WORKSPACE
===================================================== */
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
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* =====================================================
   ⚡ INDEXES FOR PERFORMANCE
===================================================== */
// Enables fast querying of all workspaces belonging to a specific user
workspaceSchema.index({ 'members.user': 1 });

/* =====================================================
   🔗 VIRTUAL POPULATION
===================================================== */
workspaceSchema.virtual('boards', {
  ref: 'Board',
  foreignField: 'workspace',
  localField: '_id',
});

/* =====================================================
   🛠️ INSTANCE METHODS
===================================================== */
// Check if a user is a member of this workspace
workspaceSchema.methods.isMember = function (userId) {
  if (!userId) return false;
  return this.members.some(
    (member) => member.user.toString() === userId.toString()
  );
};

// Get user role within the workspace
workspaceSchema.methods.getUserRole = function (userId) {
  if (!userId) return null;
  const member = this.members.find(
    (m) => m.user.toString() === userId.toString()
  );
  return member ? member.role : null;
};

/* =====================================================
   🔒 MIDDLEWARE / HOOKS (Fixed async / next syntax)
===================================================== */

// 1. Automatically generate slug before validation runs
workspaceSchema.pre('validate', function () {
  if (this.name && !this.slug) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
});

// 2. Sync workspace owner into members array on creation
workspaceSchema.pre('save', function () {
  if (this.isNew) {
    const ownerExists = this.members.some(
      (member) => member.user.toString() === this.owner.toString()
    );

    if (!ownerExists) {
      this.members.push({
        user: this.owner,
        role: 'owner',
      });
    }
  }
});

const Workspace = mongoose.model('Workspace', workspaceSchema);
module.exports = Workspace;