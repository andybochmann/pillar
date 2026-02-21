import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Category } from "@/models/category";
import { Note } from "@/models/note";
import { NotesSplitView } from "@/components/notes/notes-split-view";

interface CategoryNotePageProps {
  params: Promise<{ id: string; noteId: string }>;
}

export default async function CategoryNotePage({
  params,
}: CategoryNotePageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id, noteId } = await params;
  await connectDB();

  const category = await Category.findOne({
    _id: id,
    userId: session.user.id,
  });
  if (!category) redirect("/home");

  // Verify the note exists and belongs to this category/user before rendering
  const note = await Note.findOne({
    _id: noteId,
    categoryId: id,
    userId: session.user.id,
  });
  if (!note) redirect(`/categories/${id}/notes`);

  return (
    <NotesSplitView
      parentType="category"
      categoryId={id}
      initialNoteId={noteId}
    />
  );
}
