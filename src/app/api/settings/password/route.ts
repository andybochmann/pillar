import { NextResponse } from "next/server";
import { z } from "zod";
import { compare, hash } from "bcryptjs";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/user";
import { Account } from "@/models/account";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

// Password policy (M20): min length + at least two character classes, matching
// the registration route.
const newPasswordField = z
  .string()
  .min(10, "New password must be at least 10 characters")
  .max(100)
  .refine(
    (v) =>
      [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(v))
        .length >= 2,
    "New password must include at least two of: lowercase, uppercase, number, symbol",
  );

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: newPasswordField,
});

const SetPasswordSchema = z.object({
  newPassword: newPasswordField,
});

// M19: throttle password-change attempts per user.
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 15 * 60 * 1000;

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = rateLimit(
    `password:${session.user.id}:${getClientIp(request)}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil(limit.retryAfterMs / 1000).toString(),
        },
      },
    );
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
    // L20: stamp the change so previously-issued JWTs can be invalidated by the
    // jwt callback. Dormant until `passwordChangedAt` is added to the User model
    // (cross-file dependency — see report).
    user.set("passwordChangedAt", new Date());
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
