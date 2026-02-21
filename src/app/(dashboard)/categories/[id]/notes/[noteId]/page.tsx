import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Category } from "@/models/category";
import { Note } from "@/models/note";
import { NoteFullEditor } from "@/components/notes/note-full-editor";
import type { Note as NoteType } from "@/types";

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

  const note = await Note.findOne({
    _id: noteId,
    categoryId: id,
    userId: session.user.id,
  }).lean();
  if (!note) redirect(`/categories/${id}/notes`);

  // Serialize Mongoose doc to plain type
  const serialized: NoteType = JSON.parse(JSON.stringify(note)) as NoteType;

  return <NoteFullEditor initialNote={serialized} categoryId={id} />;
}
