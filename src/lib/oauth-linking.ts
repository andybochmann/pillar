import { connectDB } from "@/lib/db";
import { User } from "@/models/user";
import { Account } from "@/models/account";

export interface OAuthProfile {
  email?: string | null;
  name?: string | null;
  image?: string | null;
  email_verified?: boolean;
}

export interface OAuthAccount {
  provider: string;
  providerAccountId: string;
}

export async function handleOAuthSignIn(
  profile: OAuthProfile,
  account: OAuthAccount,
): Promise<string | null> {
  if (!profile.email) return null;

  if (account.provider === "google" && !profile.email_verified) {
    return null;
  }

  await connectDB();

  const existingAccount = await Account.findOne({
    provider: account.provider,
    providerAccountId: account.providerAccountId,
  });

  if (existingAccount) {
    const user = await User.findById(existingAccount.userId);
    if (!user) return null;

    if (!user.image && profile.image) {
      user.image = profile.image;
      await user.save();
    }

    return user._id.toString();
  }

  const existingUser = await User.findOne({
    email: profile.email.toLowerCase(),
  });

  if (existingUser) {
    await Account.create({
      userId: existingUser._id,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
    });

    if (!existingUser.image && profile.image) {
      existingUser.image = profile.image;
      await existingUser.save();
    }

    return existingUser._id.toString();
  }

  const newUser = await User.create({
    name: profile.name ?? profile.email.split("@")[0],
    email: profile.email.toLowerCase(),
    image: profile.image ?? undefined,
  });

  await Account.create({
    userId: newUser._id,
    provider: account.provider,
    providerAccountId: account.providerAccountId,
  });

  return newUser._id.toString();
}
