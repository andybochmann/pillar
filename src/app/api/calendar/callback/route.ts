import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Account } from "@/models/account";
import { CalendarSync } from "@/models/calendar-sync";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

function extractProviderAccountId(idToken: string | undefined, userId: string): string {
  if (!idToken) return `calendar-${userId}`;

  try {
    const payload = JSON.parse(
      Buffer.from(idToken.split(".")[1], "base64").toString(),
    );
    return payload.sub || `calendar-${userId}`;
  } catch {
    return `calendar-${userId}`;
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const clearCookie = (response: NextResponse) => {
    response.cookies.set("calendar_oauth_state", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });
    return response;
  };

  const redirectWithError = (reason: string) =>
    clearCookie(
      NextResponse.redirect(
        new URL(`/settings?calendar=error&reason=${encodeURIComponent(reason)}`, request.url),
      ),
    );

  if (error) return redirectWithError(error);
  if (!code || !state) return redirectWithError("missing_params");

  const savedState = request.cookies.get("calendar_oauth_state")?.value;
  if (!savedState || savedState !== state) {
    return redirectWithError("invalid_state");
  }

  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  const authUrl = process.env.AUTH_URL;
  if (!clientId || !clientSecret || !authUrl) {
    return redirectWithError("not_configured");
  }

  // Exchange code for tokens
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${authUrl}/api/calendar/callback`,
    }),
  });

  if (!tokenRes.ok) {
    console.error("[calendar/callback] Token exchange failed:", await tokenRes.text());
    return redirectWithError("token_exchange_failed");
  }

  const tokens = await tokenRes.json();

  await connectDB();

  // Upsert tokens onto the Google Account record
  const updated = await Account.findOneAndUpdate(
    { userId: session.user.id, provider: "google" },
    {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + (tokens.expires_in ?? 3600),
      scope: tokens.scope,
      token_type: tokens.token_type ?? "Bearer",
    },
    { returnDocument: "after" },
  );

  if (!updated) {
    const providerAccountId = extractProviderAccountId(
      tokens.id_token,
      session.user.id,
    );

    await Account.create({
      userId: session.user.id,
      provider: "google",
      providerAccountId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + (tokens.expires_in ?? 3600),
      scope: tokens.scope,
      token_type: tokens.token_type ?? "Bearer",
    });
  }

  // Create or enable CalendarSync record
  await CalendarSync.findOneAndUpdate(
    { userId: session.user.id },
    {
      enabled: true,
      syncErrors: 0,
      lastSyncError: undefined,
    },
    { upsert: true, returnDocument: "after" },
  );

  return clearCookie(
    NextResponse.redirect(
      new URL("/settings?calendar=connected", request.url),
    ),
  );
}
