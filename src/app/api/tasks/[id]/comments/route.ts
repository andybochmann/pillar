import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { emitSyncEvent, emitNotificationEvent } from "@/lib/event-bus";
import { Comment, type IComment } from "@/models/comment";
import { Task } from "@/models/task";
import { User } from "@/models/user";
import { Notification } from "@/models/notification";
import { getProjectRole, getProjectMemberUserIds } from "@/lib/project-access";

const CreateCommentSchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(5000),
  mentions: z.array(z.string()).max(50).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface PopulatedAuthor {
  _id: { toString(): string };
  name?: string;
  image?: string;
}

/**
 * Serializes a comment document (with optional populated author) into the
 * string-id/date shape the client expects.
 */
function serializeComment(
  comment: Pick<
    IComment,
    "_id" | "taskId" | "projectId" | "body" | "mentions" | "createdAt" | "updatedAt"
  > & { userId: unknown },
  author?: { name?: string; image?: string },
) {
  const rawUser = comment.userId;
  const isPopulated =
    typeof rawUser === "object" && rawUser !== null && "_id" in rawUser;
  const populated = isPopulated ? (rawUser as PopulatedAuthor) : null;
  const userId = populated
    ? populated._id.toString()
    : (rawUser as { toString(): string }).toString();

  return {
    _id: comment._id.toString(),
    taskId: comment.taskId.toString(),
    projectId: comment.projectId.toString(),
    userId,
    body: comment.body,
    mentions: comment.mentions.map((m) => m.toString()),
    authorName: author?.name ?? populated?.name,
    authorImage: author?.image ?? populated?.image,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();

  const task = await Task.findById(id).select("projectId");
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Any project member (including viewers) may read the thread
  const role = await getProjectRole(session.user.id, task.projectId.toString());
  if (!role) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const comments = await Comment.find({ taskId: id })
    .populate("userId", "name image")
    .sort({ createdAt: 1 });

  return NextResponse.json(comments.map((c) => serializeComment(c)));
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const rawBody = await request.json();
    const result = CreateCommentSchema.safeParse(rawBody);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    await connectDB();

    const task = await Task.findById(id).select("projectId title");
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const projectId = task.projectId.toString();

    // Any project member (including viewers) may comment — collaboration, not editing
    const role = await getProjectRole(session.user.id, projectId);
    if (!role) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const memberUserIds = await getProjectMemberUserIds(projectId);
    const memberSet = new Set(memberUserIds);

    // Validate mentions are project members; de-dupe and drop self-mentions
    const requestedMentions = result.data.mentions ?? [];
    for (const mentionId of requestedMentions) {
      if (!memberSet.has(mentionId)) {
        return NextResponse.json(
          { error: "Mentioned user is not a project member" },
          { status: 400 },
        );
      }
    }
    const mentions = [...new Set(requestedMentions)];

    const author = await User.findById(session.user.id).select("name image");

    const comment = await Comment.create({
      taskId: id,
      projectId,
      userId: session.user.id,
      body: result.data.body,
      mentions,
    });

    const serialized = serializeComment(comment, {
      name: author?.name,
      image: author?.image,
    });

    // Create a mention notification for each mentioned member (except the author)
    const mentionTargets = mentions.filter((m) => m !== session.user.id);
    await Promise.all(
      mentionTargets.map(async (mentionUserId) => {
        try {
          const notification = await Notification.create({
            userId: mentionUserId,
            taskId: id,
            type: "mention",
            title: "You were mentioned",
            message: `${author?.name ?? "Someone"} mentioned you in a comment on "${task.title}".`,
            metadata: {
              projectId,
              taskId: id,
              commentId: comment._id.toString(),
            },
          });

          emitNotificationEvent({
            type: "mention",
            notificationId: notification._id.toString(),
            userId: mentionUserId,
            taskId: id,
            title: notification.title,
            message: notification.message,
            metadata: notification.metadata as Record<string, unknown>,
            timestamp: Date.now(),
          });
        } catch (err) {
          console.error(
            `[comments/POST] Failed to notify mentioned user ${mentionUserId}:`,
            err,
          );
        }
      }),
    );

    // Live-update the thread for all project members
    emitSyncEvent({
      entity: "comment",
      action: "created",
      userId: session.user.id,
      sessionId: request.headers.get("X-Session-Id") ?? "",
      entityId: comment._id.toString(),
      projectId,
      targetUserIds: memberUserIds,
      data: serialized,
      timestamp: Date.now(),
    });

    return NextResponse.json(serialized, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
