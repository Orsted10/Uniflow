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
      <div className="p-4 text-center text-xs text-zinc-500 italic bg-zinc-950/60 border border-zinc-800 rounded-lg">
        No normalized {side} schema available. Import a specification above.
      </div>
    );
  }

  return (
    <div className={`border border-zinc-800 rounded-lg bg-zinc-900/60 overflow-hidden text-xs ${className}`}>
      <div className="bg-zinc-950/80 px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-zinc-200 uppercase tracking-wider text-[11px]">
            {side.toUpperCase()} Schema Tree
          </span>
          <span className="font-mono text-[10px] text-zinc-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">
            {schema.metadata.fieldCount} fields &bull; max depth {schema.metadata.maxDepth}
          </span>
        </div>
        {schema.metadata.isInferred && (
          <span className="font-mono text-[10px] text-amber-300 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded">
            Inferred Sample
          </span>
        )}
      </div>

      {schema.warnings && schema.warnings.length > 0 && (
        <div className="p-2.5 bg-amber-950/30 border-b border-amber-800/40 text-amber-200 text-[11px] space-y-1">
          {schema.warnings.map((w, idx) => (
            <div key={idx} className="flex items-start gap-1.5">
              <span className="text-amber-400 font-bold">!</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      <div className="p-3 max-h-80 overflow-y-auto space-y-1 divide-y divide-zinc-800/50 font-mono text-[11px]">
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
      ? "text-emerald-300 bg-emerald-950/60 border-emerald-800/60"
      : field.type === "integer" || field.type === "number"
      ? "text-sky-300 bg-sky-950/60 border-sky-800/60"
      : field.type === "boolean"
      ? "text-purple-300 bg-purple-950/60 border-purple-800/60"
      : field.type === "array"
      ? "text-amber-300 bg-amber-950/60 border-amber-800/60"
      : "text-zinc-300 bg-zinc-800 border-zinc-700";

  return (
    <div className="pt-1.5 first:pt-0">
      <div
        className="flex items-center justify-between py-0.5 hover:bg-zinc-800/50 rounded px-1 group"
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        <div className="flex items-center space-x-1.5 truncate">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-zinc-500 hover:text-zinc-200 font-bold w-3 text-left focus:outline-none"
            >
              {expanded ? "▼" : "▶"}
            </button>
          ) : (
            <span className="w-3 inline-block text-zinc-600">•</span>
          )}

          <span className="font-semibold text-zinc-100 group-hover:text-emerald-400 transition-colors">
            {field.name}
          </span>

          {field.required && (
            <span className="text-rose-400 font-bold text-[10px]" title="Required field">
              *
            </span>
          )}

          <span className={`text-[10px] px-1 py-0.2 rounded border font-medium ${typeColor}`}>
            {field.type}
            {field.format ? `:${field.format}` : ""}
          </span>

          {field.nullable && (
            <span className="text-[9px] text-zinc-400 bg-zinc-800 px-1 rounded border border-zinc-700">
              nullable
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1 shrink-0 text-[10px]">
          {field.enum && field.enum.length > 0 && (
            <span
              className="text-indigo-300 bg-indigo-950/60 border border-indigo-800/60 px-1.5 py-0.2 rounded truncate max-w-[120px]"
              title={`Enum values: ${field.enum.join(", ")}`}
            >
              enum: [{field.enum.join(", ")}]
            </span>
          )}
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="space-y-1">
          {field.children!.map((child) => (
            <TreeNode key={child.path} field={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
