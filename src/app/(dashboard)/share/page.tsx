import { ShareTaskForm } from "@/components/share/share-task-form";

interface SharePageProps {
  searchParams: Promise<{
    title?: string;
    text?: string;
    url?: string;
  }>;
}

export default async function SharePage({ searchParams }: SharePageProps) {
  const params = await searchParams;
  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Create Task from Shared Content</h1>
      <ShareTaskForm
        sharedTitle={params.title}
        sharedText={params.text}
        sharedUrl={params.url}
      />
    </div>
  );
}
