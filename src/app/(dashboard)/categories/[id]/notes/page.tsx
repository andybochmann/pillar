import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Category } from "@/models/category";
import { NotesSplitView } from "@/components/notes/notes-split-view";

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

  return <NotesSplitView parentType="category" categoryId={id} />;
}
