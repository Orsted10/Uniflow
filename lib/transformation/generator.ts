import { TransformationPlan, TransformationStep } from "./ir";

/**
 * Generates pure TypeScript adapter code from the compiled TransformationPlan.
 * Does not execute AI-generated code; uses deterministic code generation.
 */
export function generateTypeScriptAdapter(plan: TransformationPlan): string {
  const lines: string[] = [];

  lines.push("// -------------------------------------------------------------");
  lines.push("// UNIFLOW ∞ — Generated TypeScript API Adapter");
  lines.push(`// Plan ID: ${plan.planId}`);
  lines.push(`// Compiled At: ${plan.compiledAt}`);
  lines.push(`// Source Contract: ${plan.sourceSpecId}`);
  lines.push(`// Target Contract: ${plan.targetSpecId}`);
  lines.push("// -------------------------------------------------------------");
  lines.push("");
  lines.push("/* eslint-disable */");
  lines.push("");

  // Add path helper functions
  lines.push(`function getValueByPath(obj: any, path: string): any {
  if (path === "$") return obj;
  if (!path) return undefined;
  const segments: Array<string | number> = [];
  const regex = /\\[(?:"((?:\\\\.|[^"\\\\])*)"|(\\d+))\\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(path)) !== null) {
    if (match[1] !== undefined) {
      segments.push(match[1].replace(/\\\\"/g, '"').replace(/\\\\\\\\/g, "\\\\"));
    } else if (match[2] !== undefined) {
      segments.push(parseInt(match[2], 10));
    }
  }
  let current = obj;
  for (const seg of segments) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = current[seg];
  }
  return current;
}`);
  lines.push("");

  lines.push(`function setValueByPath(target: any, path: string, value: any): void {
  const segments: Array<string | number> = [];
  const regex = /\\[(?:"((?:\\\\.|[^"\\\\])*)"|(\\d+))\\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(path)) !== null) {
    if (match[1] !== undefined) {
      segments.push(match[1].replace(/\\\\"/g, '"').replace(/\\\\\\\\/g, "\\\\"));
    } else if (match[2] !== undefined) {
      segments.push(parseInt(match[2], 10));
    }
  }
  if (segments.length === 0) return;
  let current = target;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const nextSeg = segments[i + 1];
    if (typeof seg === "string") {
      if (seg === "__proto__" || seg === "constructor" || seg === "prototype") return;
      if (!current[seg] || typeof current[seg] !== "object") {
        current[seg] = typeof nextSeg === "number" ? [] : {};
      }
      current = current[seg];
    } else if (typeof seg === "number") {
      if (!current[seg] || typeof current[seg] !== "object") {
        current[seg] = typeof nextSeg === "number" ? [] : {};
      }
      current = current[seg];
    }
  }
  const lastSeg = segments[segments.length - 1];
  if (lastSeg === "__proto__" || lastSeg === "constructor" || lastSeg === "prototype") return;
  current[lastSeg] = value;
}`);
  lines.push("");

  // Add lookup tables if any
  const lookupSteps = plan.steps.filter((s) => s.operation === "lookup" && s.lookupTable);
  const usedLookupVars = new Set<string>();
  const lookupVarByStepId = new Map<string, string>();
  if (lookupSteps.length > 0) {
    lines.push(`function lookupEnumValue(
  table: Record<string, string>,
  rawValue: unknown,
  policyOnMissing: "fail" | "useDefault" | "omit",
  fallback?: unknown
): unknown {
  const key = String(rawValue);
  if (Object.prototype.hasOwnProperty.call(table, key)) return table[key];
  const lower = key.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(table, lower)) return table[lower];
  const upper = key.toUpperCase();
  if (Object.prototype.hasOwnProperty.call(table, upper)) return table[upper];
  if (policyOnMissing === "fail") {
    throw new Error("Unmapped enum value: " + key);
  }
  return fallback !== undefined ? fallback : key;
}`);
    lines.push("");

    for (const step of lookupSteps) {
      let varName = `LOOKUP_${sanitizeVarName(step.targetPath)}`;
      if (usedLookupVars.has(varName)) {
        varName = `${varName}_${usedLookupVars.size + 1}`;
      }
      usedLookupVars.add(varName);
      lookupVarByStepId.set(step.stepId, varName);
      lines.push(`const ${varName}: Record<string, string> = ${JSON.stringify(step.lookupTable, null, 2)};`);
      lines.push("");
    }
  }

  // Adapter function
  lines.push("/**");
  lines.push(" * Transforms source payload into target contract compliant payload.");
  lines.push(" */");
  lines.push("export function adapt(source: Record<string, unknown>): Record<string, unknown> {");
  lines.push("  const target: Record<string, unknown> = {};");
  lines.push("");

  const usedVars = new Set<string>();
  for (const step of plan.steps) {
    lines.push(`  // Step ${step.stepId}: ${step.operation} -> ${step.targetPath}`);
    generateStepCode(step, lines, usedVars, lookupVarByStepId.get(step.stepId));
    lines.push("");
  }

  lines.push("  return target;");
  lines.push("}");
  lines.push("");
  lines.push("export const transform = adapt;");
  lines.push("");

  return lines.join("\n");
}

function getUniqueValVar(stepId: string, usedVars: Set<string>): string {
  const base = `val_${sanitizeVarName(stepId) || "step"}`;
  if (!usedVars.has(base)) {
    usedVars.add(base);
    return base;
  }
  let suffix = 2;
  while (usedVars.has(`${base}_${suffix}`)) {
    suffix++;
  }
  const unique = `${base}_${suffix}`;
  usedVars.add(unique);
  return unique;
}

function generateStepCode(
  step: TransformationStep,
  lines: string[],
  usedVars: Set<string>,
  lookupVarName?: string
): void {
  const targetPathLiteral = JSON.stringify(step.targetPath);

  if (step.operation === "default") {
    const defaultValLiteral = JSON.stringify(step.defaultValue ?? null);
    if (!step.sourcePath) {
      lines.push(`  setValueByPath(target, ${targetPathLiteral}, ${defaultValLiteral});`);
      return;
    }
    const valVar = getUniqueValVar(step.stepId, usedVars);
    lines.push(`  const ${valVar} = getValueByPath(source, ${JSON.stringify(step.sourcePath)});`);
    lines.push(
      `  setValueByPath(target, ${targetPathLiteral}, ${valVar} !== undefined && ${valVar} !== null ? ${valVar} : ${defaultValLiteral});`
    );
    return;
  }

  if (!step.sourcePath) {
    if (step.operation === "constructObject") {
      lines.push(`  setValueByPath(target, ${targetPathLiteral}, ${JSON.stringify(step.defaultValue ?? {})});`);
    } else if (step.policyOnMissing === "useDefault") {
      lines.push(`  setValueByPath(target, ${targetPathLiteral}, ${JSON.stringify(step.defaultValue ?? null)});`);
    } else if (step.policyOnMissing === "fail") {
      const missingMsgLiteral = JSON.stringify(`Missing required field for ${step.targetPath}`);
      lines.push(`  throw new Error(${missingMsgLiteral});`);
    } else {
      lines.push("  // omit optional unmatched target field");
    }
    return;
  }

  const sourcePathLiteral = JSON.stringify(step.sourcePath);
  const valVar = getUniqueValVar(step.stepId, usedVars);
  lines.push(`  const ${valVar} = getValueByPath(source, ${sourcePathLiteral});`);

  lines.push(`  if (${valVar} === undefined || ${valVar} === null) {`);
  if (step.policyOnMissing === "fail") {
    const missingMsgLiteral = JSON.stringify(`Missing required field for ${step.targetPath}`);
    lines.push(`    throw new Error(${missingMsgLiteral});`);
  } else if (step.policyOnMissing === "useDefault") {
    lines.push(`    setValueByPath(target, ${targetPathLiteral}, ${JSON.stringify(step.defaultValue ?? null)});`);
  } else {
    lines.push("    // omit optional");
  }
  lines.push("  } else {");

  switch (step.operation) {
    case "copy":
    case "rename":
    case "readNested":
    case "constructObject":
      lines.push(`    setValueByPath(target, ${targetPathLiteral}, ${valVar});`);
      break;

    case "typeConversion":
      lines.push(
        `    setValueByPath(target, ${targetPathLiteral}, ${generateConversionExpression(
          valVar,
          step.conversionType
        )});`
      );
      break;

    case "lookup": {
      const varName = lookupVarName || `LOOKUP_${sanitizeVarName(step.targetPath)}`;
      const fallbackArg =
        step.defaultValue !== undefined ? `, ${JSON.stringify(step.defaultValue)}` : "";
      lines.push(
        `    const mapped = lookupEnumValue(${varName}, ${valVar}, ${JSON.stringify(
          step.policyOnMissing
        )}${fallbackArg});`
      );
      lines.push(`    setValueByPath(target, ${targetPathLiteral}, mapped);`);
      break;
    }

    case "reject": {
      const rejectMsgLiteral = JSON.stringify(
        `Step configured to reject transformation for path '${step.targetPath}'.`
      );
      lines.push(`    throw new Error(${rejectMsgLiteral});`);
      break;
    }

    default:
      lines.push(`    setValueByPath(target, ${targetPathLiteral}, ${valVar});`);
  }

  lines.push("  }");
}

function generateConversionExpression(valVar: string, conv?: string): string {
  switch (conv) {
    case "integer-to-string":
      return `String(Math.trunc(Number(${valVar})))`;
    case "string-to-integer":
      return `parseInt(String(${valVar}), 10)`;
    case "number-to-string":
      return `String(Number(${valVar}))`;
    case "string-to-number":
      return `parseFloat(String(${valVar}))`;
    case "boolean-to-string":
      return `Boolean(${valVar}) ? "true" : "false"`;
    case "string-to-boolean":
      return `String(${valVar}).toLowerCase() === "true" || String(${valVar}) === "1"`;
    case "isoDate-to-timestamp":
      return `new Date(String(${valVar})).getTime()`;
    case "date-to-string":
    case "string-to-date":
      return `new Date(String(${valVar})).toISOString()`;
    default:
      return valVar;
  }
}

function sanitizeVarName(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}
