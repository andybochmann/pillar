import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface INotificationPreference extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  enableBrowserPush: boolean;
  enableInAppNotifications: boolean;
  reminderTimings: number[]; // in minutes before due date (e.g., [1440, 60, 15] for 1 day, 1 hour, 15 min)
  enableEmailDigest: boolean;
  emailDigestFrequency: "daily" | "weekly" | "none";
  quietHoursEnabled: boolean;
  quietHoursStart: string; // format: "HH:mm" (e.g., "22:00")
  quietHoursEnd: string; // format: "HH:mm" (e.g., "08:00")
  enableOverdueSummary: boolean;
  pushSubscription?: IPushSubscription;
  createdAt: Date;
  updatedAt: Date;
}

const PushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  },
  { _id: false },
);

const NotificationPreferenceSchema = new Schema<INotificationPreference>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    enableBrowserPush: { type: Boolean, default: false },
    enableInAppNotifications: { type: Boolean, default: true },
    reminderTimings: {
      type: [Number],
      default: [1440, 60, 15], // 1 day, 1 hour, 15 minutes
      validate: {
        validator: (v: number[]) => v.every((timing) => timing > 0),
        message: "All reminder timings must be positive numbers",
      },
    },
    enableEmailDigest: { type: Boolean, default: false },
    emailDigestFrequency: {
      type: String,
      enum: ["daily", "weekly", "none"],
      default: "none",
    },
    quietHoursEnabled: { type: Boolean, default: false },
    quietHoursStart: {
      type: String,
      default: "22:00",
      validate: {
        validator: (v: string) => /^([0-1]\d|2[0-3]):[0-5]\d$/.test(v),
        message: "quietHoursStart must be in HH:mm format (e.g., 22:00)",
      },
    },
    quietHoursEnd: {
      type: String,
      default: "08:00",
      validate: {
        validator: (v: string) => /^([0-1]\d|2[0-3]):[0-5]\d$/.test(v),
        message: "quietHoursEnd must be in HH:mm format (e.g., 08:00)",
      },
    },
    enableOverdueSummary: { type: Boolean, default: true },
    pushSubscription: { type: PushSubscriptionSchema },
  },
  { timestamps: true },
);

export const NotificationPreference: Model<INotificationPreference> =
  mongoose.models.NotificationPreference ||
  mongoose.model<INotificationPreference>(
    "NotificationPreference",
    NotificationPreferenceSchema,
  );
