import { Skeleton } from "@/components/ui/skeleton";

export function KPISkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-lg" />
      ))}
    </div>
  );
}

export function AlertsSkeleton() {
  return <Skeleton className="h-40 rounded-lg" />;
}

export function PodTableSkeleton() {
  return <Skeleton className="h-64 rounded-lg" />;
}

export function HeatmapSkeleton() {
  return <Skeleton className="h-48 rounded-lg" />;
}
