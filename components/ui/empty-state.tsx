import * as React from "react";

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`border border-dashed border-zinc-800 rounded-lg p-8 text-center bg-zinc-950/60 flex flex-col items-center justify-center ${className}`}
    >
      {icon ? (
        <div className="mb-3 text-zinc-400">{icon}</div>
      ) : (
        <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 font-mono text-sm mb-3">
          ∅
        </div>
      )}
      <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">{title}</h3>
      <p className="mt-1 text-xs text-zinc-400 max-w-md leading-relaxed">{description}</p>
      {action && (
        <div className="mt-4">
          {action.href ? (
            <a
              href={action.href}
              className="inline-flex items-center text-xs font-medium px-3.5 py-1.5 rounded-md bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              {action.label}
            </a>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center text-xs font-medium px-3.5 py-1.5 rounded-md bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
