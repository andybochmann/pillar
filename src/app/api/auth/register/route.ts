import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/user";
import { Account } from "@/models/account";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

// Password policy (M20): min length + at least two character classes so a
// password can't be all-one-class (e.g. "aaaaaaaaaa"). Applied identically in
// the password-change route.
const RegisterSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(10, "Password must be at least 10 characters")
    .max(100)
    .refine(
      (v) =>
        [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(v))
          .length >= 2,
      "Password must include at least two of: lowercase, uppercase, number, symbol",
    ),
});

// M19: throttle registration attempts per IP.
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const limit = rateLimit(
      `register:${getClientIp(request)}`,
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
    const result = RegisterSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    await connectDB();

    // Always hash password for timing normalization (prevents timing attacks)
    const passwordHash = await hash(result.data.password, 12);

    const existingUser = await User.findOne({
      email: result.data.email.toLowerCase(),
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Invalid registration data" },
        { status: 400 },
      );
    }

    let user;
    try {
      user = await User.create({
        name: result.data.name,
        email: result.data.email.toLowerCase(),
        passwordHash,
      });
    } catch (err) {
      // Concurrent registration race (M22): the unique email index rejects the
      // second writer. Return the same generic error to avoid enumeration.
      if ((err as { code?: number }).code === 11000) {
        return NextResponse.json(
          { error: "Invalid registration data" },
          { status: 400 },
        );
      }
      throw err;
    }

    await Account.create({
      userId: user._id,
      provider: "credentials",
      providerAccountId: user._id.toString(),
    });

    return NextResponse.json(
      {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
