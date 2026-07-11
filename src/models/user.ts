import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash?: string;
  image?: string;
  passwordChangedAt?: Date;
  /**
   * Secret token for the read-only iCal (.ics) feed. Present only when the user
   * has enabled the feed. Anyone holding this token can read the user's task
   * due dates via the public feed endpoint, so it is high-entropy
   * (32 random bytes, hex-encoded) and can be regenerated to revoke access.
   */
  calendarFeedToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String },
    image: { type: String },
    passwordChangedAt: { type: Date },
    // Sparse + unique: only enabled users have the field, and each token maps
    // to at most one user for the public feed lookup.
    calendarFeedToken: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true },
);

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
