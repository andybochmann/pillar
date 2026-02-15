import mongoose, { Schema, type Document, type Model } from "mongoose";

export type NotificationType =
  | "due-soon"
  | "overdue"
  | "reminder"
  | "daily-summary";

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  taskId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  dismissed: boolean;
  scheduledFor?: Date;
  sentAt?: Date;
  snoozedUntil?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    taskId: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["due-soon", "overdue", "reminder", "daily-summary"],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    read: {
      type: Boolean,
      default: false,
    },
    dismissed: {
      type: Boolean,
      default: false,
    },
    scheduledFor: {
      type: Date,
    },
    sentAt: {
      type: Date,
    },
    snoozedUntil: {
      type: Date,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: true },
);

// Compound indexes for efficient queries
NotificationSchema.index({ userId: 1, read: 1 });
NotificationSchema.index({ userId: 1, scheduledFor: 1 });

export const Notification: Model<INotification> =
  mongoose.models.Notification ||
  mongoose.model<INotification>("Notification", NotificationSchema);
