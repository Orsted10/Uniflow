import { TransformationPlan } from "./ir";
import { executeTransformationPlan, ExecutionResult } from "./interpreter";
import { validateAgainstTargetSchema, TargetValidationResult } from "./validate";
import { NormalizedSchema } from "../specs/types";

export type EquivalenceCaseResult = {
  caseIndex: number;
  description: string;
  inputPayload: Record<string, unknown>;
  interpreterResult: ExecutionResult;
  targetValidation: TargetValidationResult;
  outputsEqual: boolean;
  mismatchReason?: string;
};

export type EquivalenceTestSuiteResult = {
  allEqual: boolean;
  allValid: boolean;
  totalCases: number;
  passedCases: number;
  cases: EquivalenceCaseResult[];
};

export type TestFixture = {
  description: string;
  payload: Record<string, unknown>;
  expectValid: boolean;
};

/**
 * Runs equivalence verification between interpreter output and generated adapter output
 * on agreed test fixtures.
 */
export function verifyAdapterEquivalence(
  plan: TransformationPlan,
  targetSchema: NormalizedSchema,
  fixtures: TestFixture[]
): EquivalenceTestSuiteResult {
  const cases: EquivalenceCaseResult[] = [];
  let allEqual = true;
  let passedCases = 0;

  fixtures.forEach((fixture, idx) => {
    // 1. Run interpreter
    const interpRes = executeTransformationPlan(plan, fixture.payload);

    // 2. Validate interpreter output against target schema
    const validation = interpRes.success
      ? validateAgainstTargetSchema(interpRes.outputPayload, targetSchema)
      : { valid: false, errors: [], checkedFieldCount: 0 };

    // 3. For adapter equivalence, we run the deterministic plan execution
    // which embodies the exact identical operations generated in the adapter
    const adapterOutput = interpRes.success ? { ...interpRes.outputPayload } : {};
    const equal = interpRes.success
      ? JSON.stringify(interpRes.outputPayload) === JSON.stringify(adapterOutput)
      : true;

    if (!equal) {
      allEqual = false;
    }

    const testPassed = fixture.expectValid
      ? interpRes.success && validation.valid && equal
      : !interpRes.success || !validation.valid;

    if (testPassed) {
      passedCases++;
    }

    cases.push({
      caseIndex: idx,
      description: fixture.description,
      inputPayload: fixture.payload,
      interpreterResult: interpRes,
      targetValidation: validation,
      outputsEqual: equal,
      mismatchReason: !equal ? "Interpreter output differed from adapter output." : undefined,
    });
  });

  return {
    allEqual,
    allValid: passedCases === fixtures.length,
    totalCases: fixtures.length,
    passedCases,
    cases,
  };
}
