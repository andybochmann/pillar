import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/user";

const RegisterSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = RegisterSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    await connectDB();

    const existingUser = await User.findOne({
      email: result.data.email.toLowerCase(),
    });

    // Always hash password for timing normalization (prevents timing attacks)
    const passwordHash = await hash(result.data.password, 12);

    if (existingUser) {
      return NextResponse.json(
        { error: "Invalid registration data" },
        { status: 400 },
      );
    }
    const user = await User.create({
      name: result.data.name,
      email: result.data.email.toLowerCase(),
      passwordHash,
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
