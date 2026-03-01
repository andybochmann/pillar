import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { emitSyncEvent } from "@/lib/event-bus";
import { FilterPreset } from "@/models/filter-preset";

const CreateFilterPresetSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  context: z.enum(["overview", "kanban"]),
  filters: z.record(z.string(), z.union([z.string(), z.array(z.string())])).default({}),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const { searchParams } = new URL(request.url);
  const context = searchParams.get("context");

  const filter: Record<string, unknown> = { userId: session.user.id };
  if (context && ["overview", "kanban"].includes(context)) {
    filter.context = context;
  }

  const presets = await FilterPreset.find(filter).sort({ order: 1 });
  return NextResponse.json(presets);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = CreateFilterPresetSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    await connectDB();

    const count = await FilterPreset.countDocuments({
      userId: session.user.id,
      context: result.data.context,
    });

    if (count >= 50) {
      return NextResponse.json(
        { error: "Maximum of 50 presets per context reached" },
        { status: 400 },
      );
    }

    const preset = await FilterPreset.create({
      ...result.data,
      userId: session.user.id,
      order: count,
    });

    emitSyncEvent({
      entity: "filter-preset",
      action: "created",
      userId: session.user.id,
      sessionId: request.headers.get("X-Session-Id") ?? "",
      entityId: preset._id.toString(),
      data: preset.toJSON(),
      timestamp: Date.now(),
    });

    return NextResponse.json(preset, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
