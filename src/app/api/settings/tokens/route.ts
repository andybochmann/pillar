import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { AccessToken } from "@/models/access-token";
import { generateToken, hashToken } from "@/lib/mcp-auth";

const MAX_TOKENS_PER_USER = 10;
// Access tokens must expire (M18). Callers may request a shorter lifetime; we
// default to 90 days and hard-cap at 365 days so a leaked token cannot live
// forever with full privileges.
const DEFAULT_TOKEN_LIFETIME_DAYS = 90;
const MAX_TOKEN_LIFETIME_DAYS = 365;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const CreateTokenSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  expiresInDays: z
    .number()
    .int()
    .min(1, "expiresInDays must be at least 1")
    .max(
      MAX_TOKEN_LIFETIME_DAYS,
      `expiresInDays must be at most ${MAX_TOKEN_LIFETIME_DAYS}`,
    )
    .optional(),
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

  const lifetimeDays =
    result.data.expiresInDays ?? DEFAULT_TOKEN_LIFETIME_DAYS;
  const expiresAt = new Date(Date.now() + lifetimeDays * MS_PER_DAY);

  const raw = generateToken();
  const token = await AccessToken.create({
    userId: session.user.id,
    name: result.data.name,
    tokenHash: hashToken(raw),
    tokenPrefix: raw.slice(0, 8),
    expiresAt,
  });

  return NextResponse.json(
    {
      _id: token._id.toString(),
      name: token.name,
      tokenPrefix: token.tokenPrefix,
      token: raw,
      expiresAt: token.expiresAt ? token.expiresAt.toISOString() : null,
      createdAt: token.createdAt.toISOString(),
    },
    { status: 201 },
  );
}
