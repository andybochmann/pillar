import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { emitSyncEvent } from "@/lib/event-bus";
import { FilterPreset } from "@/models/filter-preset";

const UpdateFilterPresetSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  filters: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const result = UpdateFilterPresetSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    await connectDB();

    const preset = await FilterPreset.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      result.data,
      { returnDocument: "after" },
    );

    if (!preset) {
      return NextResponse.json(
        { error: "Filter preset not found" },
        { status: 404 },
      );
    }

    emitSyncEvent({
      entity: "filter-preset",
      action: "updated",
      userId: session.user.id,
      sessionId: request.headers.get("X-Session-Id") ?? "",
      entityId: id,
      data: preset.toJSON(),
      timestamp: Date.now(),
    });

    return NextResponse.json(preset);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await connectDB();

    const preset = await FilterPreset.findOneAndDelete({
      _id: id,
      userId: session.user.id,
    });

    if (!preset) {
      return NextResponse.json(
        { error: "Filter preset not found" },
        { status: 404 },
      );
    }

    emitSyncEvent({
      entity: "filter-preset",
      action: "deleted",
      userId: session.user.id,
      sessionId: request.headers.get("X-Session-Id") ?? "",
      entityId: id,
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
