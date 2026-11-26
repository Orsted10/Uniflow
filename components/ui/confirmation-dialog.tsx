"use client";

import * as React from "react";

export interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationDialog({
  isOpen,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const titleId = React.useId();
  const descriptionId = React.useId();

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md"
    >
      <div className="apple-glass bg-[#0c0b09]/95 rounded-3xl border border-white/[0.14] shadow-[0_32px_80px_rgba(0,0,0,0.75)] max-w-lg w-full overflow-hidden">
        {/* Subtle editorial accent bar */}
        <div
          className={`h-1 w-full ${
            isDestructive
              ? "bg-gradient-to-r from-rose-500/80 via-amber-400/70 to-rose-500/40"
              : "bg-gradient-to-r from-[#f3e7d3]/80 via-emerald-400/60 to-transparent"
          }`}
        />

        <div className="p-6 sm:p-7">
          <div className="flex items-start gap-4">
            <div
              className={`shrink-0 flex h-11 w-11 items-center justify-center rounded-2xl border ${
                isDestructive
                  ? "bg-rose-500/12 border-rose-500/30 text-rose-400"
                  : "bg-[#f3e7d3]/12 border-[#f3e7d3]/30 text-[#f3e7d3]"
              }`}
              aria-hidden="true"
            >
              {isDestructive ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                  />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-[11px] font-medium uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                    isDestructive
                      ? "bg-rose-500/10 border-rose-500/25 text-rose-300"
                      : "bg-white/[0.05] border-white/[0.12] text-zinc-300"
                  }`}
                >
                  {isDestructive ? "Integrity Guard" : "Confirm Action"}
                </span>
              </div>
              <h3 id={titleId} className="text-lg sm:text-xl font-semibold text-[#f5efe6] tracking-tight">
                {title}
              </h3>
              <p id={descriptionId} className="mt-2.5 text-sm text-zinc-300 leading-relaxed">
                {description}
              </p>
            </div>
          </div>

          <div className="mt-7 pt-5 border-t border-white/[0.08] flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 text-sm font-medium text-zinc-200 bg-white/[0.06] border border-white/[0.12] rounded-full hover:bg-white/[0.12] hover:text-white transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`px-6 py-2.5 text-sm font-semibold rounded-full transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0b09] ${
                isDestructive
                  ? "bg-gradient-to-r from-rose-500 to-rose-600 text-white border border-rose-400/30 shadow-[0_8px_24px_rgba(244,63,94,0.28)] hover:from-rose-400 hover:to-rose-500 focus-visible:ring-rose-500"
                  : "champagne-pill focus-visible:ring-[#f3e7d3]"
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
