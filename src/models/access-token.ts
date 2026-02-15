import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IAccessToken extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  name: string;
  tokenHash: string;
  tokenPrefix: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AccessTokenSchema = new Schema<IAccessToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    tokenPrefix: { type: String, required: true },
    lastUsedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const AccessToken: Model<IAccessToken> =
  mongoose.models.AccessToken ||
  mongoose.model<IAccessToken>("AccessToken", AccessTokenSchema);
