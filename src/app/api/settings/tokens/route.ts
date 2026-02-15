import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { AccessToken } from "@/models/access-token";
import { generateToken, hashToken } from "@/lib/mcp-auth";

const MAX_TOKENS_PER_USER = 10;

const CreateTokenSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const tokens = await AccessToken.find(
    { userId: session.user.id },
    { tokenHash: 0 },
  )
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json(
    tokens.map((t) => ({
      _id: t._id.toString(),
      name: t.name,
      tokenPrefix: t.tokenPrefix,
      lastUsedAt: t.lastUsedAt ? t.lastUsedAt.toISOString() : null,
      expiresAt: t.expiresAt ? t.expiresAt.toISOString() : null,
      createdAt: t.createdAt.toISOString(),
    })),
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const result = CreateTokenSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 },
    );
  }

  await connectDB();

  const count = await AccessToken.countDocuments({ userId: session.user.id });
  if (count >= MAX_TOKENS_PER_USER) {
    return NextResponse.json(
      { error: `Maximum of ${MAX_TOKENS_PER_USER} tokens allowed` },
      { status: 400 },
    );
  }

  const raw = generateToken();
  const token = await AccessToken.create({
    userId: session.user.id,
    name: result.data.name,
    tokenHash: hashToken(raw),
    tokenPrefix: raw.slice(0, 8),
  });

  return NextResponse.json(
    {
      _id: token._id.toString(),
      name: token.name,
      tokenPrefix: token.tokenPrefix,
      token: raw,
      createdAt: token.createdAt.toISOString(),
    },
    { status: 201 },
  );
}
