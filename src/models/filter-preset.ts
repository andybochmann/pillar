import mongoose, { Schema, type Document, type Model } from "mongoose";

export type FilterPresetContext = "overview" | "kanban";

export interface IFilterPreset extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  userId: mongoose.Types.ObjectId;
  context: FilterPresetContext;
  filters: Record<string, string | string[]>;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const FilterPresetSchema = new Schema<IFilterPreset>(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    context: {
      type: String,
      enum: ["overview", "kanban"],
      required: true,
    },
    filters: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

FilterPresetSchema.index({ userId: 1, context: 1 });

export const FilterPreset: Model<IFilterPreset> =
  mongoose.models.FilterPreset ||
  mongoose.model<IFilterPreset>("FilterPreset", FilterPresetSchema);
