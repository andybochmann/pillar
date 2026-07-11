import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/user";
import { buildFeedUrl, generateCalendarFeedToken } from "@/lib/calendar-feed";

/**
 * GET — return the current iCal feed URL for the signed-in user, or null when
 * the feed has not been enabled.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const user = await User.findById(session.user.id).select(
    "calendarFeedToken",
  );
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const token = user.calendarFeedToken;
  return NextResponse.json({
    enabled: !!token,
    url: token ? buildFeedUrl(token, request.headers) : null,
  });
}

/**
 * POST — enable the feed or regenerate the token. Regenerating replaces the
 * secret, which immediately revokes any previously shared URL. Returns the new
 * absolute feed URL.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const token = generateCalendarFeedToken();
  const user = await User.findByIdAndUpdate(
    session.user.id,
    { $set: { calendarFeedToken: token } },
    { returnDocument: "after" },
  ).select("calendarFeedToken");

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      enabled: true,
      url: buildFeedUrl(token, request.headers),
    },
    { status: 201 },
  );
}

/**
 * DELETE — disable the feed by unsetting the token. The previously shared URL
 * stops working immediately.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const user = await User.findByIdAndUpdate(
    session.user.id,
    { $unset: { calendarFeedToken: "" } },
    { returnDocument: "after" },
  ).select("calendarFeedToken");

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
