import { NormalizedSchema } from "../specs/types";
import { getValueByPath } from "./interpreter";

export type ValidationError = {
  path: string;
  expectedType: string;
  actualType: string;
  message: string;
  rule: "required" | "type" | "nullable" | "enum";
};

export type TargetValidationResult = {
  valid: boolean;
  errors: ValidationError[];
  checkedFieldCount: number;
};

/**
 * Validates transformed payload against target normalized schema.
 */
export function validateAgainstTargetSchema(
  payload: Record<string, unknown>,
  targetSchema: NormalizedSchema
): TargetValidationResult {
  const errors: ValidationError[] = [];
  let checkedFieldCount = 0;

  // We validate all fields present in target schema flatFields
  for (const [path, field] of Object.entries(targetSchema.flatFields)) {
    if (path === "$") continue; // Skip root container
    checkedFieldCount++;

    const val = getValueByPath(payload, path);

    // Check required rule
    if (val === undefined) {
      if (field.required) {
        errors.push({
          path,
          expectedType: field.type,
          actualType: "undefined",
          rule: "required",
          message: `Target contract violation: Required field '${path}' (${field.type}) is missing from output.`,
        });
      }
      continue;
    }

    // Check nullability rule
    if (val === null) {
      if (!field.nullable && field.required) {
        errors.push({
          path,
          expectedType: field.type,
          actualType: "null",
          rule: "nullable",
          message: `Target contract violation: Field '${path}' cannot be null.`,
        });
      }
      continue;
    }

    // Check type rule
    const actualType = getActualType(val);
    if (!isTypeMatch(actualType, field.type)) {
      errors.push({
        path,
        expectedType: field.type,
        actualType,
        rule: "type",
        message: `Target contract violation: Field '${path}' expects type '${field.type}', but received '${actualType}'.`,
      });
      continue;
    }

    // Check enum rule
    if (field.enum && field.enum.length > 0) {
      const strVal = String(val);
      if (!field.enum.includes(strVal)) {
        errors.push({
          path,
          expectedType: `enum(${field.enum.join("|")})`,
          actualType: strVal,
          rule: "enum",
          message: `Target contract violation: Value '${strVal}' at '${path}' is not in allowed enum list [${field.enum.join(
            ", "
          )}].`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    checkedFieldCount,
  };
}

function getActualType(val: unknown): string {
  if (val === null) return "null";
  if (Array.isArray(val)) return "array";
  if (typeof val === "number") {
    return Number.isInteger(val) ? "integer" : "number";
  }
  return typeof val;
}

function isTypeMatch(actual: string, expected: string): boolean {
  if (expected === "any") return true;
  if (actual === expected) return true;
  if (actual === "integer" && expected === "number") return true;
  return false;
}
