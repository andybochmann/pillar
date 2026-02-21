import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Project } from "@/models/project";
import { getProjectRole } from "@/lib/project-access";
import { NotesSplitView } from "@/components/notes/notes-split-view";

interface ProjectNotesPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectNotesPage({
  params,
}: ProjectNotesPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  await connectDB();

  const role = await getProjectRole(session.user.id, id);
  if (!role) redirect("/home");

  const project = await Project.findById(id).select("name").lean();
  if (!project) redirect("/home");

  return (
    <NotesSplitView
      parentType="project"
      projectId={id}
      backHref={`/projects/${id}`}
      backLabel={project.name as string}
    />
  );
}
