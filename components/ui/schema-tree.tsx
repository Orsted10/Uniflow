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
      <div className="p-4 text-center text-xs text-slate-400 italic bg-slate-50 border border-slate-200 rounded">
        No normalized {side} schema available. Import a specification above.
      </div>
    );
  }

  return (
    <div className={`border border-slate-200 rounded-lg bg-white overflow-hidden text-xs ${className}`}>
      <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-slate-800 uppercase tracking-wider text-[11px]">
            {side.toUpperCase()} Schema Tree
          </span>
          <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
            {schema.metadata.fieldCount} fields &bull; max depth {schema.metadata.maxDepth}
          </span>
        </div>
        {schema.metadata.isInferred && (
          <span className="font-mono text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
            Inferred Sample
          </span>
        )}
      </div>

      {schema.warnings && schema.warnings.length > 0 && (
        <div className="p-2.5 bg-amber-50/70 border-b border-amber-200 text-amber-900 text-[11px] space-y-1">
          {schema.warnings.map((w, idx) => (
            <div key={idx} className="flex items-start gap-1.5">
              <span className="text-amber-500 font-bold">⚠</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      <div className="p-3 max-h-80 overflow-y-auto space-y-1 divide-y divide-slate-100 font-mono text-[11px]">
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
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : field.type === "integer" || field.type === "number"
      ? "text-sky-700 bg-sky-50 border-sky-200"
      : field.type === "boolean"
      ? "text-purple-700 bg-purple-50 border-purple-200"
      : field.type === "array"
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-slate-700 bg-slate-100 border-slate-200";

  return (
    <div className="pt-1.5 first:pt-0">
      <div
        className="flex items-center justify-between py-0.5 hover:bg-slate-50 rounded px-1 group"
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        <div className="flex items-center space-x-1.5 truncate">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-slate-400 hover:text-slate-700 font-bold w-3 text-left focus:outline-none"
            >
              {expanded ? "▼" : "▶"}
            </button>
          ) : (
            <span className="w-3 inline-block text-slate-300">•</span>
          )}

          <span className="font-semibold text-slate-900 group-hover:text-teal-700 transition-colors">
            {field.name}
          </span>

          {field.required && (
            <span className="text-rose-500 font-bold text-[10px]" title="Required field">
              *
            </span>
          )}

          <span className={`text-[10px] px-1 py-0.2 rounded border font-medium ${typeColor}`}>
            {field.type}
            {field.format ? `:${field.format}` : ""}
          </span>

          {field.nullable && (
            <span className="text-[9px] text-slate-400 bg-slate-100 px-1 rounded border border-slate-200">
              nullable
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1 shrink-0 text-[10px]">
          {field.enum && field.enum.length > 0 && (
            <span
              className="text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded truncate max-w-[120px]"
              title={`Enum values: ${field.enum.join(", ")}`}
            >
              enum[{field.enum.length}]
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
