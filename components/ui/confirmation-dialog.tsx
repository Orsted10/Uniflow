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
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
    >
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 shadow-2xl max-w-md w-full p-5">
        <h3 id="dialog-title" className="text-sm font-semibold text-white tracking-tight">
          {title}
        </h3>
        <p className="mt-2 text-xs text-zinc-400 leading-relaxed">{description}</p>
        <div className="mt-5 flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700 transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
              isDestructive
                ? "bg-rose-600 text-white hover:bg-rose-500 focus-visible:ring-rose-500"
                : "bg-emerald-500 text-zinc-950 hover:bg-emerald-400 focus-visible:ring-emerald-500"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
