import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IAccount extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  provider: string;
  providerAccountId: string;
  createdAt: Date;
  updatedAt: Date;
}

const AccountSchema = new Schema<IAccount>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    provider: { type: String, required: true },
    providerAccountId: { type: String, required: true },
  },
  { timestamps: true },
);

AccountSchema.index({ provider: 1, providerAccountId: 1 }, { unique: true });
AccountSchema.index({ userId: 1, provider: 1 }, { unique: true });

export const Account: Model<IAccount> =
  mongoose.models.Account || mongoose.model<IAccount>("Account", AccountSchema);
