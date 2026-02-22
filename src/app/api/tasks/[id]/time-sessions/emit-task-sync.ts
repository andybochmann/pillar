import { emitSyncEvent } from "@/lib/event-bus";
import { Task } from "@/models/task";
import { getProjectMemberUserIds } from "@/lib/project-access";

export async function emitTaskSync(
  task: typeof Task.prototype,
  userId: string,
  sessionId: string,
) {
  const targetUserIds = await getProjectMemberUserIds(
    task.projectId.toString(),
  );
  emitSyncEvent({
    entity: "task",
    action: "updated",
    userId,
    sessionId,
    entityId: task._id.toString(),
    projectId: task.projectId.toString(),
    targetUserIds,
    data: task.toJSON(),
    timestamp: Date.now(),
  });
}
