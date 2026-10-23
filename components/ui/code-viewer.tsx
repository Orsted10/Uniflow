import * as React from "react";

export interface CodeViewerProps {
  code: string;
  language?: string;
  maxHeight?: string;
  showLineNumbers?: boolean;
  className?: string;
}

export function CodeViewer({
  code,
  language = "typescript",
  maxHeight = "400px",
  showLineNumbers = true,
  className = "",
}: CodeViewerProps) {
  const [copied, setCopied] = React.useState(false);

  function copyToClipboard() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const lines = code.split("\n");

  return (
    <div className={`relative border border-slate-200 rounded-md bg-slate-900 text-slate-100 overflow-hidden shadow-sm ${className}`}>
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950 border-b border-slate-800 text-[11px] font-mono text-slate-400">
        <span>{language}</span>
        <button
          type="button"
          onClick={copyToClipboard}
          className="hover:text-slate-200 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition text-[10px] uppercase font-sans font-medium"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>

      <div
        style={{ maxHeight }}
        className="overflow-auto p-3 font-mono text-xs leading-relaxed"
      >
        <pre className="flex">
          {showLineNumbers && (
            <div className="select-none text-slate-600 text-right pr-4 border-r border-slate-800 mr-4 shrink-0">
              {lines.map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
          )}
          <code className="flex-1 whitespace-pre">{code}</code>
        </pre>
      </div>
    </div>
  );
}
