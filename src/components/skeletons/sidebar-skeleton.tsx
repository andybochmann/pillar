import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export function SidebarSkeleton() {
  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-card">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-8 w-8" />
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <nav className="p-3 space-y-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}

          <Separator className="my-3" />

          <div className="flex items-center justify-between px-3 py-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-5" />
          </div>

          {Array.from({ length: 2 }).map((_, cat) => (
            <div key={cat} className="space-y-1">
              <div className="flex items-center gap-2 px-3 py-1">
                <Skeleton className="h-2.5 w-2.5 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
              {Array.from({ length: 2 }).map((_, proj) => (
                <Skeleton
                  key={proj}
                  className="ml-4 h-9 w-[calc(100%-1rem)] rounded-md"
                />
              ))}
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t p-3">
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
    </aside>
  );
}
