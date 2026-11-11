import * as React from "react";

export type StatusChipVariant =
  | "proposed"
  | "accepted"
  | "rejected"
  | "edited"
  | "needs_confirmation"
  | "compiled"
  | "executed"
  | "invalid"
  | "low"
  | "medium"
  | "high"
  | "info"
  | "warning"
  | "error"
  | "neutral";

export interface StatusChipProps {
  label: string;
  variant?: StatusChipVariant;
  className?: string;
  size?: "sm" | "md";
}

const variantStyles: Record<StatusChipVariant, string> = {
  proposed: "bg-slate-800 text-slate-300 border-slate-700",
  accepted: "bg-emerald-950/80 text-emerald-400 border-emerald-800",
  rejected: "bg-rose-950/80 text-rose-400 border-rose-800",
  edited: "bg-sky-950/80 text-sky-400 border-sky-800",
  needs_confirmation: "bg-amber-950/80 text-amber-400 border-amber-800",
  compiled: "bg-indigo-950/80 text-indigo-400 border-indigo-800",
  executed: "bg-teal-950/80 text-teal-400 border-teal-800",
  invalid: "bg-rose-950/80 text-rose-400 border-rose-800",
  low: "bg-emerald-950/80 text-emerald-400 border-emerald-800",
  medium: "bg-amber-950/80 text-amber-400 border-amber-800",
  high: "bg-rose-950/80 text-rose-400 border-rose-800",
  info: "bg-sky-950/80 text-sky-400 border-sky-800",
  warning: "bg-amber-950/80 text-amber-400 border-amber-800",
  error: "bg-rose-950/80 text-rose-400 border-rose-800",
  neutral: "bg-slate-800/80 text-slate-300 border-slate-700",
};

export function StatusChip({
  label,
  variant = "neutral",
  className = "",
  size = "sm",
}: StatusChipProps) {
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  const colorClasses = variantStyles[variant] || variantStyles.neutral;

  return (
    <span
      className={`inline-flex items-center font-mono font-medium rounded border ${sizeClasses} ${colorClasses} ${className}`}
    >
      {label}
    </span>
  );
}
