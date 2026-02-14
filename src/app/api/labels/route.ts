import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Label } from "@/models/label";

const CreateLabelSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color"),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const labels = await Label.find({ userId: session.user.id }).sort({
    name: 1,
  });

  return NextResponse.json(labels);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = CreateLabelSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    await connectDB();

    const existing = await Label.findOne({
      userId: session.user.id,
      name: result.data.name,
    });

    if (existing) {
      return NextResponse.json(
        { error: "Label already exists" },
        { status: 409 },
      );
    }

    const label = await Label.create({
      ...result.data,
      userId: session.user.id,
    });

    return NextResponse.json(label, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
