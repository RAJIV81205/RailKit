import mongoose, { InferSchemaType, Model } from "mongoose";

const limitTopupSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    cfOrderId: {
      type: Number,
      default: null,
    },
    paymentSessionId: {
      type: String,
      default: null,
    },
    extraLimit: {
      type: Number,
      required: true,
      min: 0,
    },
    expiresAt: { type: Date, default: null, index: true },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
      required: true,
    },
    status: {
      type: String,
      enum: ["created", "active", "paid", "failed", "cancelled", "expired"],
      default: "paid",
      required: true,
    },
    paymentStatus: {
      type: String,
      default: "SUCCESS",
      required: true,
    },
    credited: {
      type: Boolean,
      default: true,
      required: true,
    },
    cashfreeOrderStatus: {
      type: String,
      default: null,
    },
    transactionReference: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { timestamps: true }
);

export type LimitTopupDocument = InferSchemaType<typeof limitTopupSchema> & {
  _id: mongoose.Types.ObjectId;
};

const LimitTopup =
  (mongoose.models.LimitTopup as Model<LimitTopupDocument>) ||
  mongoose.model<LimitTopupDocument>("LimitTopup", limitTopupSchema);

export default LimitTopup;
