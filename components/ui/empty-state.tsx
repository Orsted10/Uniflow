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
      className={`border border-dashed border-slate-300 rounded-lg p-8 text-center bg-white flex flex-col items-center justify-center ${className}`}
    >
      {icon ? (
        <div className="mb-3 text-slate-400">{icon}</div>
      ) : (
        <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-mono text-sm mb-3">
          ∅
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-900 tracking-tight">{title}</h3>
      <p className="mt-1 text-xs text-slate-500 max-w-md">{description}</p>
      {action && (
        <div className="mt-4">
          {action.href ? (
            <a
              href={action.href}
              className="inline-flex items-center text-xs font-medium px-3.5 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-800 transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              {action.label}
            </a>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center text-xs font-medium px-3.5 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-800 transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
