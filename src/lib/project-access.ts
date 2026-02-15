import { ProjectMember, type ProjectRole } from "@/models/project-member";
import { Project } from "@/models/project";

/**
 * Returns all project IDs where the user is a member (any role).
 * Falls back to Project.userId for projects not yet migrated to ProjectMember.
 */
export async function getAccessibleProjectIds(
  userId: string,
): Promise<string[]> {
  const memberDocs = await ProjectMember.find(
    { userId },
    { projectId: 1 },
  ).lean();
  const memberProjectIds = new Set(
    memberDocs.map((m) => m.projectId.toString()),
  );

  // Fallback: include projects owned by userId that have no ProjectMember records
  const ownedProjects = await Project.find({ userId }, { _id: 1 }).lean();
  for (const p of ownedProjects) {
    const pid = p._id.toString();
    if (!memberProjectIds.has(pid)) {
      const hasMember = await ProjectMember.exists({ projectId: p._id });
      if (!hasMember) {
        memberProjectIds.add(pid);
      }
    }
  }

  return [...memberProjectIds];
}

/**
 * Returns the user's role on a specific project, or null if no access.
 * Falls back to Project.userId for projects not yet migrated.
 */
export async function getProjectRole(
  userId: string,
  projectId: string,
): Promise<ProjectRole | null> {
  const member = await ProjectMember.findOne(
    { userId, projectId },
    { role: 1 },
  ).lean();

  if (member) return member.role;

  // Fallback: check if user is the project creator and no members exist
  const project = await Project.findOne(
    { _id: projectId, userId },
    { _id: 1 },
  ).lean();
  if (project) {
    const hasMember = await ProjectMember.exists({ projectId });
    if (!hasMember) return "owner";
  }

  return null;
}

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

  if (minimumRole === "owner" && role !== "owner") {
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

  if (members.length > 0) {
    return members.map((m) => m.userId.toString());
  }

  // Fallback for non-migrated projects
  const project = await Project.findById(projectId, { userId: 1 }).lean();
  return project ? [project.userId.toString()] : [];
}
