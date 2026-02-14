import { Skeleton } from "@/components/ui/skeleton";

export function CalendarSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-1 h-5 w-48" />
      </div>

      <div className="space-y-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-40" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-9" />
          </div>
        </div>

        {/* Calendar grid */}
        <div className="rounded-lg border">
          <div className="grid grid-cols-7 border-b">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="py-2 text-center">
                <Skeleton className="mx-auto h-4 w-8" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="min-h-24 border-b border-r p-1">
                <Skeleton className="h-4 w-4" />
                {i % 5 === 0 && <Skeleton className="mt-1 h-4 w-full" />}
                {i % 7 === 2 && <Skeleton className="mt-1 h-4 w-3/4" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
