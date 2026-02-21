import { Skeleton } from "@/components/ui/skeleton";

export function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-1 h-5 w-56" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-32" />
        ))}
      </div>

      {/* Task count */}
      <Skeleton className="h-4 w-16" />

      {/* Mobile: card skeletons */}
      <div className="flex flex-col gap-2 md:hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-md border p-3">
            <div className="flex items-start gap-2">
              <Skeleton className="mt-1 h-2 w-2 rounded-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <div className="mt-1.5 flex gap-3 pl-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: grid skeletons */}
      <div className="hidden md:block">
        <div className="rounded-md border">
          <div className="grid grid-cols-[1fr_160px_80px_100px_160px] gap-4 border-b px-4 py-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-20" />
            ))}
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_160px_80px_100px_160px] items-center gap-4 border-b px-4 py-3 last:border-b-0"
            >
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
