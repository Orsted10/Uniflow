import * as React from "react";

export interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-zinc-800/80 rounded ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonTable({ rows = 4, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/50">
      <div className="bg-zinc-950/80 border-b border-zinc-800 p-3 flex space-x-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      <div className="p-3 space-y-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex space-x-4">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
