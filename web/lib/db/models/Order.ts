import mongoose, { InferSchemaType, Model } from "mongoose";

const orderSchema = new mongoose.Schema(
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
    source: {
      type: String,
      enum: ["cashfree", "manual"],
      default: "cashfree",
      required: true,
      index: true,
    },
    planType: {
      type: String,
      enum: ["pro", "advance"],
      required: true,
    },
    entitlementVersion: { type: Number, enum: [1, 2], default: null },
    billingInterval: { type: String, enum: ["month", "year"], default: null },
    termMonths: { type: Number, default: null, min: 1 },
    monthlyLimit: { type: Number, default: null, min: 0 },
    entitlementStartsAt: { type: Date, default: null },
    entitlementEndsAt: { type: Date, default: null },
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
      default: "created",
      required: true,
    },
    paymentStatus: {
      type: String,
      default: "PENDING",
      required: true,
    },
    credited: {
      type: Boolean,
      default: false,
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
    note: {
      type: String,
      default: null,
      trim: true,
    },
    manualPaidAt: {
      type: Date,
      default: null,
    },
    lastWebhookAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export type OrderDocument = InferSchemaType<typeof orderSchema> & {
  _id: mongoose.Types.ObjectId;
};

const Order =
  (mongoose.models.Order as Model<OrderDocument>) ||
  mongoose.model<OrderDocument>("Order", orderSchema);

export default Order;
