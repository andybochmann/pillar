import { ProjectMember, type ProjectRole } from "@/models/project-member";

/**
 * Returns all project IDs where the user is a member (any role).
 */
export async function getAccessibleProjectIds(
  userId: string,
): Promise<string[]> {
  const memberDocs = await ProjectMember.find(
    { userId },
    { projectId: 1 },
  ).lean();
  return memberDocs.map((m) => m.projectId.toString());
}

/**
 * Returns the user's role on a specific project, or null if no access.
 */
export async function getProjectRole(
  userId: string,
  projectId: string,
): Promise<ProjectRole | null> {
  const member = await ProjectMember.findOne(
    { userId, projectId },
    { role: 1 },
  ).lean();
  return member ? member.role : null;
}

const ROLE_LEVEL: Record<ProjectRole, number> = {
  viewer: 0,
  editor: 1,
  owner: 2,
};

/**
 * Checks that a user has at least the minimum role on a project.
 * Returns the actual role, or throws with status info for API routes.
 */
export async function requireProjectRole(
  userId: string,
  projectId: string,
  minimumRole: ProjectRole,
): Promise<ProjectRole> {
  const role = await getProjectRole(userId, projectId);

  if (!role) {
    const err = new Error("Project not found") as Error & { status: number };
    err.status = 404;
    throw err;
  }

  if (ROLE_LEVEL[role] < ROLE_LEVEL[minimumRole]) {
    const err = new Error("Forbidden") as Error & { status: number };
    err.status = 403;
    throw err;
  }

  return role;
}

/**
 * Returns all member userIds for a project (for SSE targeting).
 */
export async function getProjectMemberUserIds(
  projectId: string,
): Promise<string[]> {
  const members = await ProjectMember.find(
    { projectId },
    { userId: 1 },
  ).lean();
  return members.map((m) => m.userId.toString());
}
