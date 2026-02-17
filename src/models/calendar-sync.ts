import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface ICalendarSync extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  enabled: boolean;
  calendarId: string;
  syncErrors: number;
  lastSyncError?: string;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CalendarSyncSchema = new Schema<ICalendarSync>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    enabled: { type: Boolean, default: false },
    calendarId: { type: String, default: "primary" },
    syncErrors: { type: Number, default: 0 },
    lastSyncError: { type: String },
    lastSyncAt: { type: Date },
  },
  { timestamps: true },
);

export const CalendarSync: Model<ICalendarSync> =
  mongoose.models.CalendarSync ||
  mongoose.model<ICalendarSync>("CalendarSync", CalendarSyncSchema);
