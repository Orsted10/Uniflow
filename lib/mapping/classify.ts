import { StructuralDiff, NormalizedSchema } from "../specs/types";
import { CandidateMapping, ProposedTransformation } from "./types";

/**
 * Generate candidate mappings deterministically from structural differences.
 */
export function generateBaselineMappings(
  diff: StructuralDiff,
  sourceSchema: NormalizedSchema,
  targetSchema: NormalizedSchema,
  mappingSetId = "set-default"
): CandidateMapping[] {
  const mappings: CandidateMapping[] = [];
  const now = new Date().toISOString();

  for (const item of diff.items) {
    let transformation: ProposedTransformation;
    let rationale = "";
    let uncertaintyScore: "LOW" | "MEDIUM" | "HIGH" = "LOW";
    let uncertaintyExplanation = "";
    let semanticStatus: "verified" | "ambiguous" | "unverified" | "needs_confirmation" = "unverified";
    const informationLoss: CandidateMapping["informationLoss"] = [];

    const targetField = targetSchema.flatFields[item.targetPath];
    const _sourceField = item.sourcePath ? sourceSchema.flatFields[item.sourcePath] : null;

    switch (item.category) {
      case "exact_match":
        transformation = {
          operation: "copy",
          sourceType: item.sourceType ?? undefined,
          targetType: item.targetType,
          policyOnMissing: item.targetRequired ? "fail" : "omit",
        };
        rationale = `Direct path and type match (${item.targetType}). Standard 1-to-1 copy.`;
        uncertaintyScore = "LOW";
        uncertaintyExplanation = "Exact path and schema types match without transformation.";
        semanticStatus = "verified";
        break;

      case "renamed": {
        const isTypeMatch = item.sourceType === item.targetType;
        if (targetField?.enum && targetField.enum.length > 0) {
          const lookupTable: Record<string, string> = {};
          for (const val of targetField.enum) {
            lookupTable[val.toUpperCase()] = val;
            lookupTable[val.toLowerCase()] = val;
            lookupTable[val] = val;
          }
          transformation = {
            operation: "lookup",
            sourceType: "string",
            targetType: "string",
            lookupTable,
            policyOnMissing: item.targetRequired ? "fail" : "omit",
          };
          rationale = `Rename with enum lookup: Map source '${item.sourcePath}' to target '${item.targetPath}' through verified enum dictionary.`;
          uncertaintyScore = "MEDIUM";
          uncertaintyExplanation = "Field rename with enum value normalization.";
          semanticStatus = "needs_confirmation";
        } else if (isTypeMatch) {
          transformation = {
            operation: "rename",
            sourceType: item.sourceType ?? undefined,
            targetType: item.targetType,
            policyOnMissing: item.targetRequired ? "fail" : "omit",
          };
          rationale = `Field rename: Map source '${item.sourcePath}' to target '${item.targetPath}'. Types are compatible (${item.targetType}).`;
          uncertaintyScore = "MEDIUM";
          uncertaintyExplanation = "Field names differ structurally. Semantic intent requires human confirmation.";
          semanticStatus = "needs_confirmation";
        } else {
          const conv = `${item.sourceType}-to-${item.targetType}`;
          transformation = {
            operation: "typeConversion",
            sourceType: item.sourceType ?? undefined,
            targetType: item.targetType,
            conversionType: conv,
            policyOnMissing: item.targetRequired ? "fail" : "omit",
          };
          rationale = `Rename with type conversion: Map '${item.sourcePath}' to '${item.targetPath}' using explicit '${conv}'.`;
          uncertaintyScore = "MEDIUM";
          uncertaintyExplanation = `Type conversion required from ${item.sourceType} to ${item.targetType}. Human verification required.`;
          semanticStatus = "needs_confirmation";
        }
        break;
      }

      case "type_conflict": {
        const conv = `${item.sourceType}-to-${item.targetType}`;
        transformation = {
          operation: "typeConversion",
          sourceType: item.sourceType ?? undefined,
          targetType: item.targetType,
          conversionType: conv,
          policyOnMissing: item.targetRequired ? "fail" : "omit",
        };
        rationale = `Type conversion: Same path, but convert source ${item.sourceType} to target ${item.targetType}.`;
        uncertaintyScore = "MEDIUM";
        uncertaintyExplanation = `Automatic type conversion may fail if input is out of range or malformed.`;
        semanticStatus = "needs_confirmation";
        break;
      }

      case "optional_to_required":
        transformation = {
          operation: "default",
          sourceType: item.sourceType ?? undefined,
          targetType: item.targetType,
          defaultValue: targetField?.defaultValue ?? (item.targetType === "string" ? "unspecified" : 0),
          policyOnMissing: "useDefault",
        };
        rationale = `Source is optional while Target is required. Provide default fallback if source is missing or null.`;
        uncertaintyScore = "MEDIUM";
        uncertaintyExplanation = "Default value selection requires explicit human sign-off.";
        semanticStatus = "needs_confirmation";
        informationLoss.push({
          kind: "null_default",
          description: "Missing or null values will be replaced with configured default.",
          approved: false,
        });
        break;

      case "enum_mismatch": {
        // Construct basic lookup table
        const lookupTable: Record<string, string> = {};
        if (targetField?.enum) {
          for (const val of targetField.enum) {
            lookupTable[val.toLowerCase()] = val;
            lookupTable[val.toUpperCase()] = val;
          }
        }
        transformation = {
          operation: "lookup",
          sourceType: "string",
          targetType: "string",
          lookupTable,
          policyOnMissing: "fail",
        };
        rationale = `Enum conversion: Map source value through verified lookup dictionary.`;
        uncertaintyScore = "HIGH";
        uncertaintyExplanation = "Values outside the lookup table will cause execution rejection.";
        semanticStatus = "needs_confirmation";
        break;
      }

      case "missing_required":
        transformation = {
          operation: "default",
          targetType: item.targetType,
          defaultValue: item.targetType === "string" ? "unspecified" : 0,
          policyOnMissing: "useDefault",
        };
        rationale = `Target field '${item.targetPath}' is required but absent from source. Fallback default required.`;
        uncertaintyScore = "HIGH";
        uncertaintyExplanation = "Target field has no source equivalent. Must have an approved default value.";
        semanticStatus = "needs_confirmation";
        break;

      default:
        continue;
    }

    const candidateMapping: CandidateMapping = {
      id: `map-${item.id}`,
      mappingSetId,
      sourcePath: item.sourcePath || null,
      targetPath: item.targetPath,
      status: "proposed",
      semanticStatus,
      transformation,
      rationale,
      uncertaintyScore,
      uncertaintyExplanation,
      informationLoss,
      decisionHistory: [
        {
          action: "proposed",
          timestamp: now,
          actor: "deterministic-engine",
          note: "Generated from structural difference analysis",
        },
      ],
    };

    const existingIndex = mappings.findIndex((m) => m.targetPath === item.targetPath);
    if (existingIndex !== -1) {
      if (
        transformation.operation === "lookup" ||
        transformation.operation === "typeConversion"
      ) {
        mappings[existingIndex] = candidateMapping;
      }
    } else {
      mappings.push(candidateMapping);
    }
  }

  return mappings;
}
