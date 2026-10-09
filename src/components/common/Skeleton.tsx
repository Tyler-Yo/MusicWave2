import { cn } from '@/utils/cn';

export function Skeleton({ className }: { className?: string }) {
  return <span className={cn('skeleton block', className)} aria-hidden="true" />;
}

export function CardSkeleton() {
  return (
    <div className="w-40 shrink-0 sm:w-44" aria-hidden="true">
      <Skeleton className="aspect-square w-full rounded-xl" />
      <Skeleton className="mt-3 h-3.5 w-3/4" />
      <Skeleton className="mt-2 h-3 w-1/2" />
    </div>
  );
}

export function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2" aria-hidden="true">
      <Skeleton className="h-11 w-11 rounded-md" />
      <div className="flex-1">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="mt-2 h-3 w-1/5" />
      </div>
      <Skeleton className="h-3 w-10" />
    </div>
  );
}

export function ShelfSkeleton({ title = true }: { title?: boolean }) {
  return (
    <div className="space-y-4" aria-busy="true">
      {title && <Skeleton className="h-6 w-48" />}
      <div className="flex gap-5 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
