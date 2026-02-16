import mongoose, { Schema, type Document, type Model } from "mongoose";

export type PushPlatform = "web" | "android" | "ios";

export interface IPushSubscription extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  platform: PushPlatform;
  endpoint?: string;
  keys?: {
    p256dh: string;
    auth: string;
  };
  deviceToken?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ["web", "android", "ios"],
      default: "web",
      required: true,
    },
    endpoint: {
      type: String,
      sparse: true,
      unique: true,
    },
    keys: {
      p256dh: { type: String },
      auth: { type: String },
    },
    deviceToken: {
      type: String,
      sparse: true,
      unique: true,
    },
    userAgent: { type: String },
  },
  { timestamps: true },
);

export const PushSubscription: Model<IPushSubscription> =
  mongoose.models.PushSubscription ||
  mongoose.model<IPushSubscription>("PushSubscription", PushSubscriptionSchema);
