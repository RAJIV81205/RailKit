import mongoose, { InferSchemaType, Model } from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    apiKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    usage: {
      type: Number,
      default: 0,
      min: 0,
    },

    limit: {
      type: Number,
      default: 0,
      min: 0,
    },

    active: {
      type: Boolean,
      default: true,
      required: true,
    },

    plan: {
      type: String,
      enum: ["free", "pro", "enterprise"],
      default: "free",
      required: true,
    },

    billingDate: {
      type: Date,
      default: null,
    },

    expirationDate: {
      type: Date,
      default: null,
    },

    // ── Trust & moderation state ────────────────────────────────────────────
    // Tracks whether the account has been flagged for review or banned.
    // `active` still controls runtime access; `status` records moderation history.
    status: {
      type: String,
      enum: ["clean", "flagged", "banned"],
      default: "clean",
      required: true,
      index: true,
    },

    statusReasons: {
      type: [
        {
          reason: { type: String, required: true, trim: true },
          by: { type: String, required: true, trim: true },
          at: { type: Date, required: true, default: () => new Date() },
          note: { type: String, trim: true, default: null },
        },
      ],
      default: [],
    },

    flaggedAt: {
      type: Date,
      default: null,
    },

    bannedAt: {
      type: Date,
      default: null,
    },

    bannedUntil: {
      type: Date,
      default: null,
    },

    bannedBy: {
      type: String,
      default: null,
      trim: true,
    },

    whitelisted: {
      type: Boolean,
      default: false,
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

userSchema.virtual("isBanned").get(function () {
  return this.status === "banned";
});


export type UserDocument = InferSchemaType<typeof userSchema> & {
  _id: mongoose.Types.ObjectId;
};

const User =
  (mongoose.models.User as Model<UserDocument>) ||
  mongoose.model<UserDocument>("User", userSchema);

export default User;
