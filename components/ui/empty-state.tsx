import * as React from "react";
import Link from "next/link";

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
      className={`apple-glass rounded-3xl p-12 sm:p-16 text-center flex flex-col items-center justify-center ${className}`}
    >
      {icon ? (
        <div className="mb-5 text-[#f5dfb8]">{icon}</div>
      ) : (
        <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-[#f5dfb8] font-mono text-2xl mb-5 shadow-[0_0_30px_rgba(245,223,184,0.12)]">
          ∿
        </div>
      )}
      <h3 className="text-2xl font-semibold text-white tracking-tight">{title}</h3>
      <p className="mt-2.5 text-sm sm:text-base text-zinc-300 max-w-lg leading-relaxed">
        {description}
      </p>
      {action && (
        <div className="mt-7">
          {action.href ? (
            <Link
              href={action.href}
              className="champagne-pill inline-flex items-center gap-2 text-sm sm:text-[15px] font-semibold px-7 py-3.5 rounded-full transition"
            >
              {action.label} →
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="champagne-pill inline-flex items-center gap-2 text-sm sm:text-[15px] font-semibold px-7 py-3.5 rounded-full transition"
            >
              {action.label} →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
