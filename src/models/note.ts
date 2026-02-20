import mongoose, { Schema, type Document, type Model } from "mongoose";

export type NoteParentType = "category" | "project" | "task";

export interface INote extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  content: string;
  parentType: NoteParentType;
  categoryId?: mongoose.Types.ObjectId;
  projectId?: mongoose.Types.ObjectId;
  taskId?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  pinned: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const NoteSchema = new Schema<INote>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, default: "", maxlength: 50000 },
    parentType: {
      type: String,
      enum: ["category", "project", "task"],
      required: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      index: true,
    },
    taskId: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    pinned: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

NoteSchema.pre("validate", function () {
  switch (this.parentType) {
    case "category":
      if (!this.categoryId) {
        throw new Error("categoryId is required for category notes");
      }
      this.projectId = undefined;
      this.taskId = undefined;
      break;
    case "project":
      if (!this.projectId) {
        throw new Error("projectId is required for project notes");
      }
      this.categoryId = undefined;
      this.taskId = undefined;
      break;
    case "task":
      if (!this.projectId) {
        throw new Error("projectId is required for task notes");
      }
      if (!this.taskId) {
        throw new Error("taskId is required for task notes");
      }
      this.categoryId = undefined;
      break;
  }
});

NoteSchema.index({ categoryId: 1, pinned: -1, order: 1 });
NoteSchema.index({ projectId: 1, parentType: 1, pinned: -1, order: 1 });
NoteSchema.index({ taskId: 1, pinned: -1, order: 1 });
NoteSchema.index({ title: "text", content: "text" });

export const Note: Model<INote> =
  mongoose.models.Note || mongoose.model<INote>("Note", NoteSchema);
