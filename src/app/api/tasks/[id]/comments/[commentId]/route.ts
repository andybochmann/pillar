import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { emitSyncEvent } from "@/lib/event-bus";
import { Comment } from "@/models/comment";
import { getProjectRole, getProjectMemberUserIds } from "@/lib/project-access";

interface RouteParams {
  params: Promise<{ id: string; commentId: string }>;
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, commentId } = await params;
  await connectDB();

  const comment = await Comment.findOne({ _id: commentId, taskId: id });
  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const projectId = comment.projectId.toString();
  const role = await getProjectRole(session.user.id, projectId);
  if (!role) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  // Author OR project owner may delete
  const isAuthor = comment.userId.toString() === session.user.id;
  if (!isAuthor && role !== "owner") {
    return NextResponse.json(
      { error: "Only the author or a project owner can delete this comment" },
      { status: 403 },
    );
  }

  await Comment.deleteOne({ _id: commentId });

  const targetUserIds = await getProjectMemberUserIds(projectId);
  emitSyncEvent({
    entity: "comment",
    action: "deleted",
    userId: session.user.id,
    sessionId: request.headers.get("X-Session-Id") ?? "",
    entityId: commentId,
    projectId,
    targetUserIds,
    timestamp: Date.now(),
  });

  return NextResponse.json({ success: true });
}
