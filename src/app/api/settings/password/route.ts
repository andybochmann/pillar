import { NextResponse } from "next/server";
import { z } from "zod";
import { compare, hash } from "bcryptjs";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/user";
import { Account } from "@/models/account";

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .max(100),
});

const SetPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .max(100),
});

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  await connectDB();

  const user = await User.findById(session.user.id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.passwordHash) {
    // Change password flow — requires current password
    const result = ChangePasswordSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    const isValid = await compare(result.data.currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 },
      );
    }

    user.passwordHash = await hash(result.data.newPassword, 12);
    await user.save();
  } else {
    // Set password flow — OAuth user setting password for first time
    const result = SetPasswordSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    user.passwordHash = await hash(result.data.newPassword, 12);
    await user.save();

    // Create credentials Account if missing
    const hasCredentials = await Account.findOne({
      userId: user._id,
      provider: "credentials",
    });
    if (!hasCredentials) {
      await Account.create({
        userId: user._id,
        provider: "credentials",
        providerAccountId: user._id.toString(),
      });
    }
  }

  return NextResponse.json({ message: "Password updated" });
}
