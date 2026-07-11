import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Project } from "@/models/project";
import { Category } from "@/models/category";
import { getAccessibleProjectIds } from "@/lib/project-access";
import { MyWorkView } from "@/components/my-work/my-work-view";
import type { Project as ProjectType, Category as CategoryType } from "@/types";

export default async function MyWorkPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await connectDB();

  // Load every project the user can access (owned + shared) so task rows can
  // resolve project names. Tasks themselves are fetched client-side via the
  // existing GET /api/tasks?assigneeId=<me> endpoint.
  const accessibleIds = await getAccessibleProjectIds(session.user.id);
  const [projectsRaw, categoriesRaw] = await Promise.all([
    Project.find({ _id: { $in: accessibleIds } }).lean(),
    Category.find({ userId: session.user.id }).lean(),
  ]);

  const projects: ProjectType[] = JSON.parse(JSON.stringify(projectsRaw));
  const categories: CategoryType[] = JSON.parse(JSON.stringify(categoriesRaw));

  return (
    <MyWorkView
      userId={session.user.id}
      projects={projects}
      categories={categories}
    />
  );
}
