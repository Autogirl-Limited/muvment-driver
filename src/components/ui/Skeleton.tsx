export const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`skeleton ${className}`} aria-hidden="true" />
);

export const CardSkeleton = () => (
  <div className="card mb-4 p-4">
    <div className="mb-4 flex gap-2">
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="h-5 w-24 rounded-full" />
    </div>
    <Skeleton className="mb-4 h-5 w-2/3" />
    <Skeleton className="mb-2 h-4 w-5/6" />
    <Skeleton className="mb-2 h-4 w-1/2" />
    <Skeleton className="h-4 w-3/5" />
  </div>
);
