import { CandidateMapping } from "../mapping/types";
import { NormalizedSchema } from "../specs/types";
import {
  ALLOWED_CONVERSIONS,
  AllowedConversion,
  IROperation,
  TransformationPlan,
  TransformationStep,
} from "./ir";

export type CompilationResult =
  | { success: true; plan: TransformationPlan; errors?: never }
  | { success: false; errors: string[]; plan?: never };

export function compileTransformationPlan(
  mappings: CandidateMapping[],
  sourceSchema: NormalizedSchema,
  targetSchema: NormalizedSchema,
  mappingSetId = "set-default"
): CompilationResult {
  const errors: string[] = [];
  const steps: TransformationStep[] = [];

  // Filter approved mappings only
  const approvedMappings = mappings.filter(
    (m) => m.status === "accepted" || m.status === "edited"
  );

  if (approvedMappings.length === 0) {
    return {
      success: false,
      errors: [
        "Cannot compile an empty plan. No mappings have been approved by a human reviewer.",
      ],
    };
  }

  // Check unapproved ambiguous mappings
  const pendingAmbiguous = mappings.filter(
    (m) => m.semanticStatus === "needs_confirmation" && m.status === "proposed"
  );
  if (pendingAmbiguous.length > 0) {
    // Note: Pending ambiguous mappings remain unapproved and are omitted from compilation
  }

  // Track target paths satisfied by approved mappings
  const coveredTargetPaths = new Set<string>();

  for (const m of approvedMappings) {
    const targetField = targetSchema.flatFields[m.targetPath];
    if (!targetField) {
      errors.push(`Target path '${m.targetPath}' does not exist in target schema.`);
      continue;
    }

    if (m.sourcePath && !sourceSchema.flatFields[m.sourcePath]) {
      errors.push(`Source path '${m.sourcePath}' does not exist in source schema.`);
      continue;
    }

    const op = m.transformation.operation as IROperation;
    let conversionType: AllowedConversion | undefined;

    if (op === "typeConversion") {
      const conv = m.transformation.conversionType as AllowedConversion;
      if (!conv || !ALLOWED_CONVERSIONS.includes(conv)) {
        errors.push(
          `Operation for '${m.targetPath}' requested unsupported type conversion '${m.transformation.conversionType}'. Allowed: ${ALLOWED_CONVERSIONS.join(
            ", "
          )}`
        );
        continue;
      }
      conversionType = conv;
    }

    if (op === "lookup" && (!m.transformation.lookupTable || Object.keys(m.transformation.lookupTable).length === 0)) {
      errors.push(`Lookup operation for '${m.targetPath}' requires a non-empty lookup table.`);
      continue;
    }

    if (op === "default" && m.transformation.defaultValue === undefined) {
      errors.push(`Default operation for '${m.targetPath}' requires an approved defaultValue.`);
      continue;
    }

    steps.push({
      stepId: `step-${m.id}`,
      operation: op,
      sourcePath: m.sourcePath,
      targetPath: m.targetPath,
      sourceType: m.transformation.sourceType,
      targetType: targetField.type,
      conversionType,
      defaultValue: m.transformation.defaultValue,
      lookupTable: m.transformation.lookupTable,
      policyOnMissing: m.transformation.policyOnMissing || (targetField.required ? "fail" : "omit"),
      rationale: m.rationale,
    });

    coveredTargetPaths.add(m.targetPath);
  }

  // Check required target fields that have NO approved step
  const targetRequiredLeaves = Object.values(targetSchema.flatFields).filter(
    (f) => f.path !== "$" && f.required && (!f.children || f.children.length === 0)
  );

  for (const reqField of targetRequiredLeaves) {
    if (!coveredTargetPaths.has(reqField.path)) {
      errors.push(
        `Required target field '${reqField.path}' (${reqField.type}) has no approved mapping in the transformation plan.`
      );
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
    };
  }

  const plan: TransformationPlan = {
    planId: `plan-${Date.now()}`,
    version: "1.0.0",
    mappingSetId,
    sourceSpecId: sourceSchema.specId || "source",
    targetSpecId: targetSchema.specId || "target",
    compiledAt: new Date().toISOString(),
    approvedMappingCount: steps.length,
    steps,
  };

  return {
    success: true,
    plan,
  };
}
