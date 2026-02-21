import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Project } from "@/models/project";
import { getProjectRole } from "@/lib/project-access";
import { NotesListView } from "@/components/notes/notes-list-view";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

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
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6">
        <Link
          href={`/projects/${id}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {project.name as string}
        </Link>
      </div>
      <NotesListView parentType="project" projectId={id} />
    </div>
  );
}
