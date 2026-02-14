import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface ILabel extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  color: string;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LabelSchema = new Schema<ILabel>(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    color: {
      type: String,
      required: true,
      match: /^#[0-9a-fA-F]{6}$/,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

LabelSchema.index({ userId: 1, name: 1 }, { unique: true });

export const Label: Model<ILabel> =
  mongoose.models.Label || mongoose.model<ILabel>("Label", LabelSchema);
