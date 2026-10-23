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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
    >
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-5 animate-in fade-in zoom-in-95 duration-150">
        <h3 id="dialog-title" className="text-sm font-semibold text-slate-900 tracking-tight">
          {title}
        </h3>
        <p className="mt-2 text-xs text-slate-600 leading-relaxed">{description}</p>
        <div className="mt-5 flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-3.5 py-1.5 text-xs font-medium text-white rounded transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
              isDestructive
                ? "bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500"
                : "bg-slate-900 hover:bg-slate-800 focus-visible:ring-slate-500"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
