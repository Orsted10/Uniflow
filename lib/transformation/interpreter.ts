import { TransformationPlan } from "./ir";

export type StepExecutionResult = {
  stepId: string;
  operation: string;
  targetPath: string;
  sourcePath?: string | null;
  inputValue: unknown;
  outputValue: unknown;
  success: boolean;
  error?: string;
};

export type ExecutionResult = {
  success: boolean;
  outputPayload: Record<string, unknown>;
  stepResults: StepExecutionResult[];
  error?: string;
  failedStepId?: string;
};

/**
 * Trusted, deterministic transformation interpreter.
 * Executes approved TransformationPlan steps on an input payload without eval.
 */
export function executeTransformationPlan(
  plan: TransformationPlan,
  inputPayload: Record<string, unknown>
): ExecutionResult {
  const outputPayload: Record<string, unknown> = {};
  const stepResults: StepExecutionResult[] = [];

  for (const step of plan.steps) {
    let sourceVal: unknown = undefined;
    if (step.sourcePath) {
      sourceVal = getValueByPath(inputPayload, step.sourcePath);
    }

    // Handle missing or null values
    if (sourceVal === undefined || sourceVal === null) {
      if (step.policyOnMissing === "fail") {
        const err = `Execution failed at step '${step.stepId}': Required source path '${step.sourcePath}' is missing or null.`;
        stepResults.push({
          stepId: step.stepId,
          operation: step.operation,
          targetPath: step.targetPath,
          sourcePath: step.sourcePath,
          inputValue: sourceVal,
          outputValue: undefined,
          success: false,
          error: err,
        });
        return {
          success: false,
          outputPayload,
          stepResults,
          error: err,
          failedStepId: step.stepId,
        };
      }

      if (step.policyOnMissing === "useDefault" || step.operation === "default") {
        const defVal = step.defaultValue;
        setValueByPath(outputPayload, step.targetPath, defVal);
        stepResults.push({
          stepId: step.stepId,
          operation: step.operation,
          targetPath: step.targetPath,
          sourcePath: step.sourcePath,
          inputValue: sourceVal,
          outputValue: defVal,
          success: true,
        });
        continue;
      }

      // Omit
      stepResults.push({
        stepId: step.stepId,
        operation: step.operation,
        targetPath: step.targetPath,
        sourcePath: step.sourcePath,
        inputValue: sourceVal,
        outputValue: undefined,
        success: true,
      });
      continue;
    }

    // Execute operation
    try {
      let finalVal: unknown;

      switch (step.operation) {
        case "copy":
        case "rename":
        case "readNested":
          finalVal = sourceVal;
          break;

        case "typeConversion":
          finalVal = applyTypeConversion(sourceVal, step.conversionType);
          break;

        case "lookup": {
          const keyStr = String(sourceVal);
          const table = step.lookupTable || {};
          if (keyStr in table) {
            finalVal = table[keyStr];
          } else if (keyStr.toLowerCase() in table) {
            finalVal = table[keyStr.toLowerCase()];
          } else if (keyStr.toUpperCase() in table) {
            finalVal = table[keyStr.toUpperCase()];
          } else {
            if (step.policyOnMissing === "fail") {
              throw new Error(
                `Lookup value '${keyStr}' for path '${step.targetPath}' not found in lookup table.`
              );
            }
            finalVal = step.defaultValue ?? keyStr;
          }
          break;
        }

        case "default":
          finalVal = step.defaultValue;
          break;

        case "reject":
          throw new Error(`Step configured to reject transformation for path '${step.targetPath}'.`);

        default:
          finalVal = sourceVal;
      }

      setValueByPath(outputPayload, step.targetPath, finalVal);

      stepResults.push({
        stepId: step.stepId,
        operation: step.operation,
        targetPath: step.targetPath,
        sourcePath: step.sourcePath,
        inputValue: sourceVal,
        outputValue: finalVal,
        success: true,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      stepResults.push({
        stepId: step.stepId,
        operation: step.operation,
        targetPath: step.targetPath,
        sourcePath: step.sourcePath,
        inputValue: sourceVal,
        outputValue: undefined,
        success: false,
        error: errMsg,
      });

      return {
        success: false,
        outputPayload,
        stepResults,
        error: errMsg,
        failedStepId: step.stepId,
      };
    }
  }

  return {
    success: true,
    outputPayload,
    stepResults,
  };
}

function applyTypeConversion(val: unknown, conversionType?: string): unknown {
  if (!conversionType || conversionType === "string-to-string") {
    return String(val);
  }

  switch (conversionType) {
    case "integer-to-string": {
      const n = Number(val);
      if (isNaN(n)) throw new Error(`Cannot convert '${val}' to integer.`);
      return String(Math.trunc(n));
    }
    case "string-to-integer": {
      const parsed = parseInt(String(val), 10);
      if (isNaN(parsed)) throw new Error(`Cannot parse '${val}' as integer.`);
      return parsed;
    }
    case "number-to-string": {
      const n = Number(val);
      if (isNaN(n)) throw new Error(`Cannot convert '${val}' to number.`);
      return String(n);
    }
    case "string-to-number": {
      const parsed = parseFloat(String(val));
      if (isNaN(parsed)) throw new Error(`Cannot parse '${val}' as number.`);
      return parsed;
    }
    case "boolean-to-string":
      return val ? "true" : "false";
    case "string-to-boolean": {
      const s = String(val).toLowerCase().trim();
      return s === "true" || s === "1" || s === "yes";
    }
    case "date-to-string": {
      const d = new Date(String(val));
      if (isNaN(d.getTime())) throw new Error(`Invalid date value '${val}'.`);
      return d.toISOString();
    }
    case "string-to-date": {
      const d = new Date(String(val));
      if (isNaN(d.getTime())) throw new Error(`Invalid date format '${val}'.`);
      return d.toISOString();
    }
    default:
      return val;
  }
}

/**
 * Parse path segments:
 * '$["order"]["items"][0]["price"]' -> ['order', 'items', 0, 'price']
 */
export function parsePathSegments(path: string): Array<string | number> {
  if (path === "$" || !path) return [];
  const segments: Array<string | number> = [];
  const regex = /\[(?:"((?:\\.|[^"\\])*)"|(\d+))\]/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(path)) !== null) {
    if (match[1] !== undefined) {
      // Unescape string property
      segments.push(match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
    } else if (match[2] !== undefined) {
      // Array index
      segments.push(parseInt(match[2], 10));
    }
  }

  return segments;
}

export function getValueByPath(obj: unknown, path: string): unknown {
  if (path === "$") return obj;
  const segments = parsePathSegments(path);
  let current: unknown = obj;

  for (const seg of segments) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

export function setValueByPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const segments = parsePathSegments(path);
  if (segments.length === 0) return;

  let current: Record<string, unknown> | unknown[] = target;

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const nextSeg = segments[i + 1];

    if (typeof seg === "string") {
      const objCurrent = current as Record<string, unknown>;
      if (!objCurrent[seg] || typeof objCurrent[seg] !== "object") {
        objCurrent[seg] = typeof nextSeg === "number" ? [] : {};
      }
      current = objCurrent[seg] as Record<string, unknown> | unknown[];
    } else if (typeof seg === "number") {
      const arrCurrent = current as unknown[];
      if (!arrCurrent[seg] || typeof arrCurrent[seg] !== "object") {
        arrCurrent[seg] = typeof nextSeg === "number" ? [] : {};
      }
      current = arrCurrent[seg] as Record<string, unknown> | unknown[];
    }
  }

  const lastSeg = segments[segments.length - 1];
  if (typeof lastSeg === "string") {
    (current as Record<string, unknown>)[lastSeg] = value;
  } else if (typeof lastSeg === "number") {
    (current as unknown[])[lastSeg] = value;
  }
}
