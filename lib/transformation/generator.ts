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
  if (path === "$" || !path) return obj;
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
  let current = target;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const nextSeg = segments[i + 1];
    if (typeof seg === "string") {
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
  current[lastSeg] = value;
}`);
  lines.push("");

  // Add lookup tables if any
  const lookupSteps = plan.steps.filter((s) => s.operation === "lookup" && s.lookupTable);
  for (const step of lookupSteps) {
    const varName = `LOOKUP_${sanitizeVarName(step.targetPath)}`;
    lines.push(`const ${varName}: Record<string, string> = ${JSON.stringify(step.lookupTable, null, 2)};`);
    lines.push("");
  }

  // Adapter function
  lines.push("/**");
  lines.push(" * Transforms source payload into target contract compliant payload.");
  lines.push(" */");
  lines.push("export function adapt(source: Record<string, unknown>): Record<string, unknown> {");
  lines.push("  const target: Record<string, unknown> = {};");
  lines.push("");

  for (const step of plan.steps) {
    lines.push(`  // Step ${step.stepId}: ${step.operation} -> ${step.targetPath}`);
    generateStepCode(step, lines);
    lines.push("");
  }

  lines.push("  return target;");
  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

function generateStepCode(step: TransformationStep, lines: string[]): void {
  const targetPathLiteral = JSON.stringify(step.targetPath);

  if (step.operation === "default") {
    const defaultValLiteral = JSON.stringify(step.defaultValue);
    lines.push(`  setValueByPath(target, ${targetPathLiteral}, ${defaultValLiteral});`);
    return;
  }

  const sourcePathLiteral = JSON.stringify(step.sourcePath);
  lines.push(`  const val_${sanitizeVarName(step.stepId)} = getValueByPath(source, ${sourcePathLiteral});`);

  const valVar = `val_${sanitizeVarName(step.stepId)}`;

  lines.push(`  if (${valVar} === undefined || ${valVar} === null) {`);
  if (step.policyOnMissing === "fail") {
    lines.push(`    throw new Error("Missing required field for ${step.targetPath}");`);
  } else if (step.policyOnMissing === "useDefault") {
    lines.push(`    setValueByPath(target, ${targetPathLiteral}, ${JSON.stringify(step.defaultValue)});`);
  } else {
    lines.push("    // omit optional");
  }
  lines.push("  } else {");

  switch (step.operation) {
    case "copy":
    case "rename":
    case "readNested":
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
      const varName = `LOOKUP_${sanitizeVarName(step.targetPath)}`;
      lines.push(
        `    const mapped = ${varName}[String(${valVar})] || ${varName}[String(${valVar}).toLowerCase()] || ${JSON.stringify(
          step.defaultValue ?? null
        )};`
      );
      if (step.policyOnMissing === "fail") {
        lines.push(`    if (mapped === null) throw new Error("Unmapped enum value: " + ${valVar});`);
      }
      lines.push(`    setValueByPath(target, ${targetPathLiteral}, mapped);`);
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
