import mongoose, { Schema, type Document, type Model } from "mongoose";

export type Priority = "urgent" | "high" | "medium" | "low";
export type RecurrenceFrequency =
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "none";

export interface IRecurrence {
  frequency: RecurrenceFrequency;
  interval: number;
  endDate?: Date;
}

export interface ISubtask {
  _id: mongoose.Types.ObjectId;
  title: string;
  completed: boolean;
}

export interface IStatusHistoryEntry {
  columnId: string;
  timestamp: Date;
}

export interface ITask extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  projectId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  columnId: string;
  priority: Priority;
  dueDate?: Date;
  recurrence: IRecurrence;
  order: number;
  labels: mongoose.Types.ObjectId[];
  subtasks: ISubtask[];
  statusHistory: IStatusHistoryEntry[];
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RecurrenceSchema = new Schema<IRecurrence>(
  {
    frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly", "none"],
      default: "none",
    },
    interval: { type: Number, default: 1, min: 1 },
    endDate: { type: Date },
  },
  { _id: false },
);

const SubtaskSchema = new Schema<ISubtask>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    completed: { type: Boolean, default: false },
  },
  { _id: true },
);

const StatusHistoryEntrySchema = new Schema<IStatusHistoryEntry>(
  {
    columnId: { type: String, required: true },
    timestamp: { type: Date, required: true },
  },
  { _id: false },
);

const TaskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    columnId: { type: String, required: true },
    priority: {
      type: String,
      enum: ["urgent", "high", "medium", "low"],
      default: "medium",
    },
    dueDate: { type: Date },
    recurrence: {
      type: RecurrenceSchema,
      default: { frequency: "none", interval: 1 },
    },
    order: { type: Number, required: true, default: 0 },
    labels: { type: [Schema.Types.ObjectId], ref: "Label", default: [] },
    subtasks: {
      type: [SubtaskSchema],
      default: [],
      validate: {
        validator: (v: ISubtask[]) => v.length <= 50,
        message: "A task cannot have more than 50 subtasks",
      },
    },
    statusHistory: { type: [StatusHistoryEntrySchema], default: [] },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

TaskSchema.index({ projectId: 1, columnId: 1, order: 1 });
TaskSchema.index({ userId: 1, dueDate: 1 });
TaskSchema.index({ userId: 1, priority: 1 });
TaskSchema.index({ title: "text", description: "text" });

export const Task: Model<ITask> =
  mongoose.models.Task || mongoose.model<ITask>("Task", TaskSchema);
