import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Category } from "@/models/category";
import { StickyNote } from "lucide-react";

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
    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <StickyNote className="h-12 w-12 opacity-20" />
      <p className="text-sm">Select a note from the sidebar to start editing</p>
    </div>
  );
}
