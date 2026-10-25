import { DiffItem, NormalizedField, NormalizedSchema, StructuralDiff } from "./types";

/**
 * Pure deterministic structural comparison between source and target normalized schemas.
 * Strictly rule-based without LLM/AI dependency to guarantee reproducibility.
 */
export function computeStructuralDiff(
  source: NormalizedSchema,
  target: NormalizedSchema
): StructuralDiff {
  const items: DiffItem[] = [];

  const sourceFlat = source.flatFields;
  const targetFlat = target.flatFields;

  let exactMatches = 0;
  let renamedCandidates = 0;
  let typeConflicts = 0;
  let missingRequired = 0;
  let optionalToRequired = 0;
  let enumMismatches = 0;
  let shapeMismatches = 0;
  let unsupportedWarnings = 0;

  // Inspect target terminal fields as well as containers with mismatched shapes
  const targetFieldsToInspect = Object.values(targetFlat).filter((f) => {
    if (f.path === "$") return false;
    if (!f.children || f.children.length === 0) return true;
    const directSource = sourceFlat[f.path];
    if (directSource && directSource.type !== f.type) {
      return true;
    }
    return false;
  });

  for (const targetField of targetFieldsToInspect) {
    const directSourceMatch = sourceFlat[targetField.path];

    if (directSourceMatch) {
      // 1. Array vs Object vs Scalar Shape Mismatch Check
      const isSourceShapeMismatch =
        (directSourceMatch.type === "array" && targetField.type !== "array") ||
        (directSourceMatch.type !== "array" && targetField.type === "array") ||
        (directSourceMatch.type === "object" && targetField.type !== "object") ||
        (directSourceMatch.type !== "object" && targetField.type === "object");

      if (isSourceShapeMismatch && directSourceMatch.type !== "any" && targetField.type !== "any") {
        shapeMismatches++;
        items.push({
          id: `diff-${targetField.path}-shape`,
          category: "shape_mismatch",
          severity: "error",
          sourcePath: directSourceMatch.path,
          targetPath: targetField.path,
          sourceType: directSourceMatch.type,
          targetType: targetField.type,
          targetRequired: targetField.required,
          message: `Shape mismatch: Source '${directSourceMatch.path}' is ${directSourceMatch.type}, but Target expects ${targetField.type}. Array/object unnesting or restructuring required.`,
          suggestedAction: `Implement structural container transformation between ${directSourceMatch.type} and ${targetField.type}`,
          facts: {
            sourceNullable: directSourceMatch.nullable,
            targetNullable: targetField.nullable,
          },
        });
        continue;
      }

      // 2. Scalar Facet Evaluation
      let hasScalarDifference = false;
      const typeCompatible = checkTypeCompatibility(directSourceMatch.type, targetField.type);

      if (!typeCompatible) {
        hasScalarDifference = true;
        typeConflicts++;
        items.push({
          id: `diff-${targetField.path}-type`,
          category: "type_conflict",
          severity: "warning",
          sourcePath: directSourceMatch.path,
          targetPath: targetField.path,
          sourceType: directSourceMatch.type,
          targetType: targetField.type,
          targetRequired: targetField.required,
          message: `Type conflict: Source '${directSourceMatch.path}' is ${directSourceMatch.type}, but Target expects ${targetField.type}. Explicit type conversion required.`,
          suggestedAction: `Apply type conversion from ${directSourceMatch.type} to ${targetField.type}`,
          facts: {
            sourceNullable: directSourceMatch.nullable,
            targetNullable: targetField.nullable,
          },
        });
      }

      if (directSourceMatch.nullable && !targetField.nullable) {
        hasScalarDifference = true;
        items.push({
          id: `diff-${targetField.path}-null`,
          category: "nullability_conflict",
          severity: "warning",
          sourcePath: directSourceMatch.path,
          targetPath: targetField.path,
          sourceType: directSourceMatch.type,
          targetType: targetField.type,
          targetRequired: targetField.required,
          message: `Nullability mismatch: Source '${directSourceMatch.path}' can be null, but Target does not permit null. A fallback default is required.`,
          suggestedAction: "Specify an explicit fallback default or null coalescing policy",
          facts: {
            sourceNullable: true,
            targetNullable: false,
          },
        });
      }

      if (!directSourceMatch.required && targetField.required) {
        hasScalarDifference = true;
        optionalToRequired++;
        items.push({
          id: `diff-${targetField.path}-opt-req`,
          category: "optional_to_required",
          severity: "warning",
          sourcePath: directSourceMatch.path,
          targetPath: targetField.path,
          sourceType: directSourceMatch.type,
          targetType: targetField.type,
          targetRequired: true,
          message: `Optional to required: Source '${directSourceMatch.path}' is optional, but Target requires it. A default value must be approved.`,
          suggestedAction: "Configure approved default value",
          facts: {
            sourceNullable: directSourceMatch.nullable,
            targetNullable: targetField.nullable,
          },
        });
      }

      if (targetField.enum && targetField.enum.length > 0) {
        const sourceEnums = directSourceMatch.enum || [];
        const missingValues = sourceEnums.filter((val: string) => !targetField.enum?.includes(val));
        if (missingValues.length > 0 || sourceEnums.length === 0) {
          hasScalarDifference = true;
          enumMismatches++;
          items.push({
            id: `diff-${targetField.path}-enum`,
            category: "enum_mismatch",
            severity: "warning",
            sourcePath: directSourceMatch.path,
            targetPath: targetField.path,
            sourceType: directSourceMatch.type,
            targetType: targetField.type,
            targetRequired: targetField.required,
            message: `Enum difference: Target permits [${targetField.enum.join(
              ", "
            )}]. Explicit value lookup mapping required.`,
            suggestedAction: "Define explicit enum lookup table",
            facts: {
              sourceEnum: sourceEnums,
              targetEnum: targetField.enum,
              sourceNullable: directSourceMatch.nullable,
              targetNullable: targetField.nullable,
            },
          });
        }
      }

      if (!hasScalarDifference) {
        exactMatches++;
        items.push({
          id: `diff-${targetField.path}-exact`,
          category: "exact_match",
          severity: "info",
          sourcePath: directSourceMatch.path,
          targetPath: targetField.path,
          sourceType: directSourceMatch.type,
          targetType: targetField.type,
          targetRequired: targetField.required,
          message: `Exact match on path, type (${targetField.type}), and constraints.`,
          facts: {
            sourceEnum: directSourceMatch.enum || null,
            targetEnum: targetField.enum || null,
            sourceNullable: directSourceMatch.nullable,
            targetNullable: targetField.nullable,
          },
        });
      }
    } else {
      // Find candidate source fields with similar naming or semantics
      const candidate = findCandidateSourceField(targetField, Object.values(sourceFlat));

      if (candidate) {
        renamedCandidates++;
        const typeMatch = checkTypeCompatibility(candidate.type, targetField.type);
        items.push({
          id: `diff-${targetField.path}-renamed`,
          category: "renamed",
          severity: typeMatch ? "info" : "warning",
          sourcePath: candidate.path,
          candidateSourcePath: candidate.path,
          targetPath: targetField.path,
          sourceType: candidate.type,
          targetType: targetField.type,
          targetRequired: targetField.required,
          message: `Candidate match: Target '${targetField.name}' resembles Source '${candidate.name}' (${candidate.path}). ${
            typeMatch ? "Types match." : `Requires conversion from ${candidate.type} to ${targetField.type}.`
          }`,
          suggestedAction: `Review and approve rename mapping from '${candidate.path}'`,
          facts: {
            sourceNullable: candidate.nullable,
            targetNullable: targetField.nullable,
          },
        });
      } else if (targetField.required) {
        missingRequired++;
        items.push({
          id: `diff-${targetField.path}-missing`,
          category: "missing_required",
          severity: "error",
          targetPath: targetField.path,
          targetType: targetField.type,
          targetRequired: true,
          message: `Missing required target field: '${targetField.path}' (${targetField.type}) has no obvious match in the source schema.`,
          suggestedAction: "Provide an approved default value or mark as fatal omission",
          facts: {
            targetNullable: targetField.nullable,
          },
        });
      } else {
        items.push({
          id: `diff-${targetField.path}-unmatched-opt`,
          category: "missing_required",
          severity: "info",
          targetPath: targetField.path,
          targetType: targetField.type,
          targetRequired: false,
          message: `Optional target field '${targetField.path}' has no match in source payload.`,
          suggestedAction: "Omit or provide default",
          facts: {
            targetNullable: targetField.nullable,
          },
        });
      }
    }
  }

  // Surface schema-level warnings as diff items
  const allWarnings = [
    ...(source.warnings || []).map((w) => `Source schema: ${w}`),
    ...(target.warnings || []).map((w) => `Target schema: ${w}`),
  ];

  for (let i = 0; i < allWarnings.length; i++) {
    unsupportedWarnings++;
    items.push({
      id: `diff-warning-${i}`,
      category: "unsupported_keyword",
      severity: "warning",
      targetPath: "$",
      targetType: "any",
      targetRequired: false,
      message: allWarnings[i],
      suggestedAction: "Review contract construct compatibility before compiling adapter",
    });
  }

  // Sort deterministically for stable outputs across runs
  items.sort((a, b) => a.targetPath.localeCompare(b.targetPath) || a.category.localeCompare(b.category));

  return {
    summary: {
      totalTargetFields: targetFieldsToInspect.length,
      exactMatches,
      renamedCandidates,
      typeConflicts,
      missingRequired,
      optionalToRequired,
      enumMismatches,
      shapeMismatches,
      unsupportedWarnings,
    },
    items,
  };
}

function checkTypeCompatibility(sourceType: string, targetType: string): boolean {
  if (sourceType === targetType) return true;
  if (sourceType === "any" || targetType === "any") return true;
  // An integer can satisfy a number constraint
  if (sourceType === "integer" && targetType === "number") return true;
  return false;
}

function findCandidateSourceField(
  targetField: NormalizedField,
  sourceFields: NormalizedField[]
): NormalizedField | null {
  const targetNorm = normalizeFieldName(targetField.name);

  // Exclude root and non-leaf fields
  const candidates = sourceFields.filter(
    (f) => f.path !== "$" && (!f.children || f.children.length === 0)
  );

  // Exact normalized name match
  for (const src of candidates) {
    if (normalizeFieldName(src.name) === targetNorm) {
      return src;
    }
  }

  // Common synonym heuristics normalized without punctuation
  const synonyms: Record<string, string[]> = {
    id: ["orderid", "clientid", "identifier", "key", "code"],
    orderid: ["id", "ordernumber", "orderno"],
    amount: ["total", "price", "subtotal", "cost", "sum", "value"],
    total: ["amount", "price", "subtotal", "cost", "sum"],
    currency: ["currencycode", "curr"],
    currencycode: ["currency", "curr"],
    createdat: ["timestamp", "date", "created", "datetime", "creationdate"],
    timestamp: ["createdat", "date", "created", "datetime"],
    note: ["memo", "comment", "description", "remarks"],
    memo: ["note", "comment", "description", "remarks"],
    firstname: ["givenname", "fname"],
    lastname: ["familyname", "surname", "lname"],
  };

  const targetSynonyms = synonyms[targetNorm] || [];
  for (const src of candidates) {
    const srcNorm = normalizeFieldName(src.name);
    if (targetSynonyms.includes(srcNorm)) {
      return src;
    }
  }

  // Substring or prefix match
  for (const src of candidates) {
    const srcNorm = normalizeFieldName(src.name);
    if (
      (srcNorm.length > 3 && targetNorm.includes(srcNorm)) ||
      (targetNorm.length > 3 && srcNorm.includes(targetNorm))
    ) {
      return src;
    }
  }

  return null;
}

function normalizeFieldName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[_-]/g, "")
    .replace(/\[\d+\]/g, "");
}
