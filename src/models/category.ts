import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface ICategory extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  color: string;
  icon?: string;
  userId: mongoose.Types.ObjectId;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true },
    color: { type: String, required: true, default: "#6366f1" },
    icon: { type: String },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    order: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

CategorySchema.index({ userId: 1, order: 1 });

export const Category: Model<ICategory> =
  mongoose.models.Category ||
  mongoose.model<ICategory>("Category", CategorySchema);
