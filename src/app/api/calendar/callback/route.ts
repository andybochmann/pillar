import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Account } from "@/models/account";
import { CalendarSync } from "@/models/calendar-sync";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Clear state cookie regardless of outcome
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

  if (error) {
    return clearCookie(
      NextResponse.redirect(
        new URL(`/settings?calendar=error&reason=${encodeURIComponent(error)}`, request.url),
      ),
    );
  }

  if (!code || !state) {
    return clearCookie(
      NextResponse.redirect(
        new URL("/settings?calendar=error&reason=missing_params", request.url),
      ),
    );
  }

  // Validate CSRF state
  const savedState = request.cookies.get("calendar_oauth_state")?.value;
  if (!savedState || savedState !== state) {
    return clearCookie(
      NextResponse.redirect(
        new URL("/settings?calendar=error&reason=invalid_state", request.url),
      ),
    );
  }

  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  const authUrl = process.env.AUTH_URL;
  if (!clientId || !clientSecret || !authUrl) {
    return clearCookie(
      NextResponse.redirect(
        new URL("/settings?calendar=error&reason=not_configured", request.url),
      ),
    );
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
    return clearCookie(
      NextResponse.redirect(
        new URL("/settings?calendar=error&reason=token_exchange_failed", request.url),
      ),
    );
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
    // User signed up with email — create an Account record for Google API access
    // We need a providerAccountId, extract from the id_token or use a placeholder
    let providerAccountId = `calendar-${session.user.id}`;
    if (tokens.id_token) {
      try {
        // Decode JWT payload (no verification needed — just getting the sub claim)
        const payload = JSON.parse(
          Buffer.from(tokens.id_token.split(".")[1], "base64").toString(),
        );
        if (payload.sub) providerAccountId = payload.sub;
      } catch {
        // Use fallback
      }
    }

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
