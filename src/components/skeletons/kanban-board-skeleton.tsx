import { Skeleton } from "@/components/ui/skeleton";

export function KanbanBoardSkeleton() {
  return (
    <div className="space-y-4">
      <div>
        <Skeleton className="h-8 w-52" />
        <Skeleton className="mt-1 h-5 w-72" />
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 3 }).map((_, col) => (
          <div
            key={col}
            className="flex w-72 flex-shrink-0 flex-col rounded-lg bg-muted/50 p-3"
          >
            <div className="mb-3 flex items-center justify-between">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
            <div className="flex flex-col gap-2">
              {Array.from({ length: col === 0 ? 3 : col === 1 ? 2 : 1 }).map(
                (_, card) => (
                  <div
                    key={card}
                    className="rounded-lg border bg-card p-3 space-y-2"
                  >
                    <Skeleton className="h-4 w-full" />
                    <div className="flex gap-1.5">
                      <Skeleton className="h-5 w-14 rounded-full" />
                      <Skeleton className="h-5 w-10 rounded-full" />
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
