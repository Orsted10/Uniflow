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
  proposed: "bg-slate-100 text-slate-700 border-slate-300",
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-300",
  rejected: "bg-rose-50 text-rose-700 border-rose-300",
  edited: "bg-sky-50 text-sky-700 border-sky-300",
  needs_confirmation: "bg-amber-50 text-amber-800 border-amber-300",
  compiled: "bg-indigo-50 text-indigo-700 border-indigo-300",
  executed: "bg-emerald-50 text-emerald-700 border-emerald-300",
  invalid: "bg-rose-50 text-rose-700 border-rose-300",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-800 border-amber-200",
  high: "bg-rose-50 text-rose-800 border-rose-200",
  info: "bg-sky-50 text-sky-700 border-sky-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  error: "bg-rose-50 text-rose-700 border-rose-200",
  neutral: "bg-slate-100 text-slate-600 border-slate-200",
};

export function StatusChip({
  label,
  variant = "neutral",
  className = "",
  size = "sm",
}: StatusChipProps) {
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  const colorClasses = variantStyles[variant] || variantStyles.neutral;

  return (
    <span
      className={`inline-flex items-center font-mono font-medium rounded border ${sizeClasses} ${colorClasses} ${className}`}
    >
      {label}
    </span>
  );
}
