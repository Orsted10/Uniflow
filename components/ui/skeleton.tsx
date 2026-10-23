import * as React from "react";

export interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-slate-200/80 rounded ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonTable({ rows = 4, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex space-x-4">
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
