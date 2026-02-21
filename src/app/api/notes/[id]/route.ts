import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { emitSyncEvent } from "@/lib/event-bus";
import { Note } from "@/models/note";
import { Category } from "@/models/category";
import {
  getProjectRole,
  getProjectMemberUserIds,
} from "@/lib/project-access";

const UpdateNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(50000).optional(),
  pinned: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function verifyNoteAccess(
  userId: string,
  note: { parentType: string; categoryId?: { toString(): string }; projectId?: { toString(): string } },
  requiredLevel: "viewer" | "editor",
): Promise<{ allowed: boolean; status: number; error: string; projectId?: string }> {
  if (note.parentType === "category") {
    const category = await Category.findOne({
      _id: note.categoryId?.toString(),
      userId,
    });
    if (!category) {
      return { allowed: false, status: 404, error: "Note not found" };
    }
    return { allowed: true, status: 200, error: "" };
  }

  // project or task notes — check project role
  const pId = note.projectId?.toString();
  if (!pId) {
    return { allowed: false, status: 404, error: "Note not found" };
  }

  const role = await getProjectRole(userId, pId);
  if (!role) {
    return { allowed: false, status: 404, error: "Note not found" };
  }
  if (requiredLevel === "editor" && role === "viewer") {
    return { allowed: false, status: 403, error: "Viewers cannot modify notes" };
  }

  return { allowed: true, status: 200, error: "", projectId: pId };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();
  const note = await Note.findById(id);

  if (!note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  const access = await verifyNoteAccess(session.user.id, note, "viewer");
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  return NextResponse.json(note);
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const result = UpdateNoteSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    await connectDB();
    const existingNote = await Note.findById(id);
    if (!existingNote) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const access = await verifyNoteAccess(session.user.id, existingNote, "editor");
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const note = await Note.findByIdAndUpdate(
      id,
      result.data,
      { returnDocument: "after" },
    );

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const targetUserIds = access.projectId
      ? await getProjectMemberUserIds(access.projectId)
      : [session.user.id];

    emitSyncEvent({
      entity: "note",
      action: "updated",
      userId: session.user.id,
      sessionId: request.headers.get("X-Session-Id") ?? "",
      entityId: note._id.toString(),
      projectId: access.projectId,
      targetUserIds,
      data: note.toJSON(),
      timestamp: Date.now(),
    });

    return NextResponse.json(note);
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

  const { id } = await params;
  await connectDB();

  const note = await Note.findById(id);
  if (!note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  const access = await verifyNoteAccess(session.user.id, note, "editor");
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  await Note.deleteOne({ _id: id });

  const targetUserIds = access.projectId
    ? await getProjectMemberUserIds(access.projectId)
    : [session.user.id];

  emitSyncEvent({
    entity: "note",
    action: "deleted",
    userId: session.user.id,
    sessionId: request.headers.get("X-Session-Id") ?? "",
    entityId: id,
    projectId: access.projectId,
    targetUserIds,
    timestamp: Date.now(),
  });

  return NextResponse.json({ success: true });
}
