import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Category } from "@/models/category";
import { NotesListView } from "@/components/notes/notes-list-view";

interface CategoryNotesPageProps {
  params: Promise<{ id: string }>;
}

export default async function CategoryNotesPage({
  params,
}: CategoryNotesPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  await connectDB();

  const category = await Category.findOne({
    _id: id,
    userId: session.user.id,
  });

  if (!category) redirect("/home");

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: category.color }}
          />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {category.name}
          </p>
        </div>
      </div>
      <NotesListView parentType="category" categoryId={id} />
    </div>
  );
}
