import * as React from "react";

export interface ErrorPanelProps {
  title?: string;
  message: string;
  details?: string[];
  onDismiss?: () => void;
  className?: string;
}

export function ErrorPanel({
  title = "Error",
  message,
  details,
  onDismiss,
  className = "",
}: ErrorPanelProps) {
  const [showDetails, setShowDetails] = React.useState(false);

  return (
    <div
      role="alert"
      className={`border border-rose-200 bg-rose-50/70 text-rose-900 rounded-md p-3.5 text-xs shadow-sm ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-2">
          <span className="font-bold text-rose-600 mt-0.5">⚠</span>
          <div>
            <span className="font-semibold text-rose-900">{title}:</span>{" "}
            <span className="text-rose-800">{message}</span>
            {details && details.length > 0 && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-[11px] font-mono text-rose-700 underline hover:text-rose-900"
                >
                  {showDetails ? "Hide details" : `Show ${details.length} diagnostic details`}
                </button>
                {showDetails && (
                  <ul className="mt-1.5 list-disc list-inside space-y-1 font-mono text-[11px] text-rose-800 bg-white/70 p-2 rounded border border-rose-200">
                    {details.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss error"
            className="text-rose-500 hover:text-rose-800 font-bold ml-2 text-sm leading-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-400 rounded"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
