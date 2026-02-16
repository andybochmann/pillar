import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface INotificationPreference extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  enableInAppNotifications: boolean;
  enableBrowserPush: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // format: "HH:mm" (e.g., "22:00")
  quietHoursEnd: string; // format: "HH:mm" (e.g., "08:00")
  enableOverdueSummary: boolean;
  enableDailySummary: boolean;
  dailySummaryTime: string; // format: "HH:mm" (e.g., "09:00")
  reminderTimings: number[]; // minutes before due (e.g., [1440, 60, 15])
  timezone: string; // IANA timezone (e.g., "America/New_York")
  createdAt: Date;
  updatedAt: Date;
}

const NotificationPreferenceSchema = new Schema<INotificationPreference>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    enableInAppNotifications: { type: Boolean, default: true },
    enableBrowserPush: { type: Boolean, default: false },
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
    enableDailySummary: { type: Boolean, default: true },
    dailySummaryTime: {
      type: String,
      default: "09:00",
      validate: {
        validator: (v: string) => /^([0-1]\d|2[0-3]):[0-5]\d$/.test(v),
        message: "dailySummaryTime must be in HH:mm format (e.g., 09:00)",
      },
    },
    reminderTimings: {
      type: [Number],
      default: [1440, 60, 15],
    },
    timezone: {
      type: String,
      default: "UTC",
    },
  },
  { timestamps: true },
);

export const NotificationPreference: Model<INotificationPreference> =
  mongoose.models.NotificationPreference ||
  mongoose.model<INotificationPreference>(
    "NotificationPreference",
    NotificationPreferenceSchema,
  );
