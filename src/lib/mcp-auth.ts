import { createHash, randomBytes } from "crypto";
import { connectDB } from "@/lib/db";
import { AccessToken } from "@/models/access-token";

const TOKEN_PREFIX = "plt_";

export function generateToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString("hex");
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function validateBearerToken(
  authHeader: string | null,
): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const raw = authHeader.slice(7);
  if (!raw.startsWith(TOKEN_PREFIX)) return null;

  const hash = hashToken(raw);

  await connectDB();

  const token = await AccessToken.findOneAndUpdate(
    { tokenHash: hash },
    { $set: { lastUsedAt: new Date() } },
    { returnDocument: "after" },
  );

  if (!token) return null;

  if (token.expiresAt && token.expiresAt < new Date()) return null;

  return token.userId.toString();
}
