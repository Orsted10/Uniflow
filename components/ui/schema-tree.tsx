"use client";

import * as React from "react";
import { NormalizedField, NormalizedSchema } from "@/lib/specs/types";

interface SchemaTreeProps {
  schema: NormalizedSchema | null;
  side: "source" | "target";
  className?: string;
}

export function SchemaTree({ schema, side, className = "" }: SchemaTreeProps) {
  if (!schema) {
    return (
      <div className="p-5 text-center text-sm text-zinc-400 italic bg-black/45 border border-white/[0.09] rounded-2xl">
        No normalized {side} schema available. Import a specification above.
      </div>
    );
  }

  return (
    <div
      className={`border border-white/[0.1] rounded-2xl bg-[#090807]/90 overflow-hidden text-sm ${className}`}
    >
      <div className="bg-white/[0.04] px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className={`font-semibold uppercase tracking-wider text-xs ${
              side === "source" ? "text-amber-300" : "text-teal-300"
            }`}
          >
            {side.toUpperCase()} Schema Tree
          </span>
          <span className="font-mono text-xs text-zinc-300 bg-white/[0.06] border border-white/[0.1] px-2.5 py-0.5 rounded-full">
            {schema.metadata.fieldCount} fields &bull; max depth {schema.metadata.maxDepth}
          </span>
        </div>
        {schema.metadata.isInferred && (
          <span className="font-mono text-xs text-amber-200 bg-amber-500/15 border border-amber-400/30 px-2.5 py-0.5 rounded-full">
            Inferred Sample
          </span>
        )}
      </div>

      {schema.warnings && schema.warnings.length > 0 && (
        <div className="p-3 bg-amber-950/40 border-b border-amber-500/30 text-amber-200 text-xs space-y-1">
          {schema.warnings.map((w, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="text-amber-400 font-bold">!</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 max-h-96 overflow-y-auto space-y-1.5 divide-y divide-white/[0.05] font-mono text-[13px]">
        {schema.fields.map((field) => (
          <TreeNode key={field.path} field={field} depth={0} />
        ))}
      </div>
    </div>
  );
}

function TreeNode({ field, depth }: { field: NormalizedField; depth: number }) {
  const [expanded, setExpanded] = React.useState(true);
  const hasChildren = Boolean(field.children && field.children.length > 0);

  const typeColor =
    field.type === "string"
      ? "text-emerald-300 bg-emerald-500/15 border-emerald-400/30"
      : field.type === "integer" || field.type === "number"
      ? "text-sky-300 bg-sky-500/15 border-sky-400/30"
      : field.type === "boolean"
      ? "text-violet-300 bg-violet-500/15 border-violet-400/30"
      : field.type === "array"
      ? "text-amber-300 bg-amber-500/15 border-amber-400/30"
      : "text-zinc-300 bg-white/[0.06] border-white/[0.12]";

  return (
    <div className="pt-2 first:pt-0">
      <div
        className="flex items-center justify-between py-1 hover:bg-white/[0.04] rounded-lg px-2 group transition-colors"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <div className="flex items-center gap-2 truncate">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-zinc-400 hover:text-zinc-100 font-bold w-3.5 text-left focus:outline-none"
            >
              {expanded ? "▼" : "▶"}
            </button>
          ) : (
            <span className="w-3.5 inline-block text-zinc-600">•</span>
          )}

          <span className="font-semibold text-[#f5dfb8] group-hover:text-white transition-colors">
            {field.name}
          </span>

          {field.required && (
            <span className="text-[#f4845f] font-bold text-xs" title="Required field">
              *
            </span>
          )}

          <span className={`px-2 py-0.5 rounded-full text-xs border ${typeColor}`}>
            {field.type}
            {field.format ? `:${field.format}` : ""}
          </span>

          {field.nullable && (
            <span className="px-2 py-0.5 rounded-full text-[11px] bg-white/[0.06] text-zinc-400 border border-white/[0.1]">
              nullable
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 text-xs text-zinc-400">
          {field.enum && (
            <span
              className="text-violet-300 bg-violet-500/15 border border-violet-400/30 px-2.5 py-0.5 rounded-full max-w-[200px] truncate"
              title={`enum: ${field.enum.join(", ")}`}
            >
              enum: [{field.enum.slice(0, 3).join(", ")}
              {field.enum.length > 3 ? ", ..." : ""}]
            </span>
          )}
          <span className="hidden xl:inline text-zinc-600 text-[11px]">{field.path}</span>
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="mt-1 space-y-1">
          {field.children!.map((child) => (
            <TreeNode key={child.path} field={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
