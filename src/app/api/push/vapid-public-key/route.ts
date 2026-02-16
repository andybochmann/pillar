import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isWebPushConfigured, getVapidPublicKey } from "@/lib/web-push";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isWebPushConfigured()) {
    return NextResponse.json(
      { error: "Web push is not configured" },
      { status: 503 },
    );
  }

  return NextResponse.json({ publicKey: getVapidPublicKey() });
}
