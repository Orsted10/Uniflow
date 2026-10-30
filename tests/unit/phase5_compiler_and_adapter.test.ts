import test from "node:test";
import assert from "node:assert/strict";
import { parseSpecificationText } from "../../lib/specs/parser";
import { normalizeSpecification } from "../../lib/specs/normalizer";
import { computeStructuralDiff } from "../../lib/specs/diff";
import { generateBaselineMappings } from "../../lib/mapping/classify";
import { compileTransformationPlan } from "../../lib/transformation/compiler";
import {
  executeTransformationPlan,
  parsePathSegments,
  getValueByPath,
  setValueByPath,
} from "../../lib/transformation/interpreter";
import { validateAgainstTargetSchema } from "../../lib/transformation/validate";
import { generateTypeScriptAdapter } from "../../lib/transformation/generator";
import { verifyAdapterEquivalence } from "../../lib/transformation/equivalence";
import {
  CANONICAL_SOURCE_SPEC,
  CANONICAL_TARGET_SPEC,
  CANONICAL_TEST_FIXTURES,
} from "../../lib/specs/fixtures";
import { CandidateMapping } from "../../lib/mapping/types";
import { TransformationPlan } from "../../lib/transformation/ir";

test("Phase 5 — Transformation Plan Compiler, Trusted Interpreter & TypeScript Adapter Generation", async (t) => {
  const normSource = normalizeSpecification(parseSpecificationText(CANONICAL_SOURCE_SPEC), "source");
  const normTarget = normalizeSpecification(parseSpecificationText(CANONICAL_TARGET_SPEC), "target");
  const diff = computeStructuralDiff(normSource, normTarget);

  await t.test("1. Path Parsing and Dynamic Traversal Helpers", () => {
    // 1a. Root path
    assert.deepEqual(parsePathSegments("$"), []);

    // 1b. Bracketed string properties and numbers
    const segments = parsePathSegments('$["order"]["items"][0]["price"]');
    assert.deepEqual(segments, ["order", "items", 0, "price"]);

    // 1c. Escaped quotes and special characters in property names
    const escapedSegments = parsePathSegments('$["customer"]["display.name"]["\\"quote\\""]');
    assert.deepEqual(escapedSegments, ["customer", "display.name", '"quote"']);

    // 1d. getValueByPath
    const sampleObj = {
      order: {
        items: [{ price: 99.5, sku: "SKU-1" }],
      },
    };
    assert.equal(getValueByPath(sampleObj, '$["order"]["items"][0]["price"]'), 99.5);
    assert.equal(getValueByPath(sampleObj, '$["order"]["items"][0]["sku"]'), "SKU-1");
    assert.equal(getValueByPath(sampleObj, '$["order"]["nonexistent"]'), undefined);

    // 1e. setValueByPath
    const targetObj: Record<string, unknown> = {};
    setValueByPath(targetObj, '$["invoice"]["items"][0]["id"]', 555);
    assert.equal(
      ((targetObj.invoice as Record<string, unknown>).items as Array<Record<string, unknown>>)[0].id,
      555
    );
  });

  await t.test("2. Plan Compilation Guardrails and Validations", () => {
    // 2a. Reject empty plan
    const emptyResult = compileTransformationPlan([], normSource, normTarget);
    assert.equal(emptyResult.success, false);
    assert.match(emptyResult.errors[0], /No mappings have been approved/);

    // 2b. Reject plan when required target fields have NO approved mapping
    const baseMappings = generateBaselineMappings(diff, normSource, normTarget);
    // Approve only 1 mapping, leaving other required target fields unmapped
    const singleMapping: CandidateMapping[] = [
      {
        ...baseMappings[0],
        status: "accepted",
      },
    ];
    const missingReqResult = compileTransformationPlan(singleMapping, normSource, normTarget);
    assert.equal(missingReqResult.success, false);
    assert.ok(missingReqResult.errors.some((e) => e.includes("has no approved mapping")));

    // 2c. Reject unsupported type conversion
    const invalidConvMapping: CandidateMapping[] = baseMappings.map((m) => {
      if (m.targetPath === '$["order_id"]') {
        return {
          ...m,
          status: "accepted" as const,
          transformation: {
            operation: "typeConversion" as const,
            conversionType: "unsupported-conversion-type",
          },
        };
      }
      return { ...m, status: "accepted" as const };
    });
    const convResult = compileTransformationPlan(invalidConvMapping, normSource, normTarget);
    assert.equal(convResult.success, false);
    assert.ok(convResult.errors.some((e) => e.includes("unsupported type conversion")));

    // 2d. Successful compilation when all required fields have approved mappings
    const validApprovedMappings = baseMappings.map((m) => {
      if (m.targetPath === '$["region"]') {
        return {
          ...m,
          status: "accepted" as const,
          transformation: {
            operation: "default" as const,
            defaultValue: "US-EAST",
            targetType: "string" as const,
          },
        };
      }
      return { ...m, status: "accepted" as const };
    });
    const validPlanResult = compileTransformationPlan(validApprovedMappings, normSource, normTarget);
    assert.equal(validPlanResult.success, true);
    assert.ok(validPlanResult.plan);
    assert.ok(validPlanResult.plan.steps.length >= 5);
  });

  await t.test("3. Trusted Interpreter Execution (All 7 Operations & Zero Eval)", () => {
    const testPlan: TransformationPlan = {
      planId: "plan_test_ops",
      version: "1.0.0",
      mappingSetId: "set-1",
      sourceSpecId: "source",
      targetSpecId: "target",
      compiledAt: new Date().toISOString(),
      approvedMappingCount: 7,
      steps: [
        // 1. copy
        {
          stepId: "step-1",
          operation: "copy",
          sourcePath: '$["source_title"]',
          targetPath: '$["dest_title"]',
          targetType: "string",
          policyOnMissing: "fail",
        },
        // 2. rename
        {
          stepId: "step-2",
          operation: "rename",
          sourcePath: '$["source_amount"]',
          targetPath: '$["dest_price"]',
          targetType: "number",
          policyOnMissing: "fail",
        },
        // 3. readNested
        {
          stepId: "step-3",
          operation: "readNested",
          sourcePath: '$["deep"]["nested"]["code"]',
          targetPath: '$["extracted_code"]',
          targetType: "string",
          policyOnMissing: "fail",
        },
        // 4. constructObject
        {
          stepId: "step-4",
          operation: "constructObject",
          sourcePath: null,
          targetPath: '$["metadata"]',
          defaultValue: { environment: "production", version: 1 },
          targetType: "object",
          policyOnMissing: "useDefault",
        },
        // 5. typeConversion (integer-to-string & string-to-number & isoDate-to-timestamp)
        {
          stepId: "step-5a",
          operation: "typeConversion",
          sourcePath: '$["raw_int"]',
          targetPath: '$["int_as_str"]',
          conversionType: "integer-to-string",
          targetType: "string",
          policyOnMissing: "fail",
        },
        {
          stepId: "step-5b",
          operation: "typeConversion",
          sourcePath: '$["raw_str_num"]',
          targetPath: '$["str_as_num"]',
          conversionType: "string-to-number",
          targetType: "number",
          policyOnMissing: "fail",
        },
        {
          stepId: "step-5c",
          operation: "typeConversion",
          sourcePath: '$["raw_iso_date"]',
          targetPath: '$["timestamp_ms"]',
          conversionType: "isoDate-to-timestamp",
          targetType: "integer",
          policyOnMissing: "fail",
        },
        // 6. default
        {
          stepId: "step-6",
          operation: "default",
          sourcePath: null,
          targetPath: '$["default_currency"]',
          defaultValue: "USD",
          targetType: "string",
          policyOnMissing: "useDefault",
        },
        // 7. lookup
        {
          stepId: "step-7",
          operation: "lookup",
          sourcePath: '$["status_code"]',
          targetPath: '$["status_label"]',
          lookupTable: {
            OPEN: "In Progress",
            SETTLED: "Completed",
            VOID: "Cancelled",
          },
          targetType: "string",
          policyOnMissing: "fail",
        },
      ],
    };

    const inputData = {
      source_title: "Widget A",
      source_amount: 19.99,
      deep: { nested: { code: "XYZ-123" } },
      raw_int: 404,
      raw_str_num: "88.5",
      raw_iso_date: "2026-03-14T10:00:00Z",
      status_code: "SETTLED",
    };

    const execResult = executeTransformationPlan(testPlan, inputData);
    assert.equal(execResult.success, true);
    const out = execResult.outputPayload;

    // Verify operations
    assert.equal(out.dest_title, "Widget A");
    assert.equal(out.dest_price, 19.99);
    assert.equal(out.extracted_code, "XYZ-123");
    assert.deepEqual(out.metadata, { environment: "production", version: 1 });
    assert.equal(out.int_as_str, "404");
    assert.equal(out.str_as_num, 88.5);
    assert.equal(typeof out.timestamp_ms, "number");
    assert.equal(out.default_currency, "USD");
    assert.equal(out.status_label, "Completed");
  });

  await t.test("4. Missing Value Policies (fail vs useDefault vs omit)", () => {
    const failPlan: TransformationPlan = {
      planId: "plan_fail",
      version: "1.0.0",
      mappingSetId: "s",
      sourceSpecId: "s",
      targetSpecId: "t",
      compiledAt: new Date().toISOString(),
      approvedMappingCount: 1,
      steps: [
        {
          stepId: "step-must-fail",
          operation: "copy",
          sourcePath: '$["missing_key"]',
          targetPath: '$["dest"]',
          targetType: "string",
          policyOnMissing: "fail",
        },
      ],
    };

    // 4a. policyOnMissing: "fail"
    const failExec = executeTransformationPlan(failPlan, {});
    assert.equal(failExec.success, false);
    assert.match(failExec.error || "", /Required source path '.*' is missing or null/);

    // 4b. policyOnMissing: "useDefault"
    const defaultPlan: TransformationPlan = {
      ...failPlan,
      steps: [
        {
          stepId: "step-default",
          operation: "copy",
          sourcePath: '$["missing_key"]',
          targetPath: '$["dest"]',
          defaultValue: "fallback-value",
          targetType: "string",
          policyOnMissing: "useDefault",
        },
      ],
    };
    const defaultExec = executeTransformationPlan(defaultPlan, {});
    assert.equal(defaultExec.success, true);
    assert.equal(defaultExec.outputPayload.dest, "fallback-value");

    // 4c. policyOnMissing: "omit"
    const omitPlan: TransformationPlan = {
      ...failPlan,
      steps: [
        {
          stepId: "step-omit",
          operation: "copy",
          sourcePath: '$["missing_key"]',
          targetPath: '$["dest"]',
          targetType: "string",
          policyOnMissing: "omit",
        },
      ],
    };
    const omitExec = executeTransformationPlan(omitPlan, {});
    assert.equal(omitExec.success, true);
    assert.equal(omitExec.outputPayload.dest, undefined);
  });

  await t.test("5. Target Contract Validation Negative Cases (Explainable Diagnostics)", () => {
    // 5a. Missing required field
    const missingPayload = {
      order_id: "ORD-1",
      total: "100.0",
      currency_code: "usd",
      timestamp: "2026-03-14T10:00:00Z",
      // Missing 'region' which is required in CANONICAL_TARGET_SPEC
    };
    const resMissing = validateAgainstTargetSchema(missingPayload, normTarget);
    assert.equal(resMissing.valid, false);
    assert.ok(resMissing.errors.some((e) => e.rule === "required" && e.path === '$["region"]'));

    // 5b. Nullability violation
    const nullPayload = {
      order_id: null, // order_id is not nullable in target
      total: "100.0",
      currency_code: "usd",
      timestamp: "2026-03-14T10:00:00Z",
      region: "US-WEST",
    };
    const resNull = validateAgainstTargetSchema(nullPayload, normTarget);
    assert.equal(resNull.valid, false);
    assert.ok(resNull.errors.some((e) => e.rule === "nullable" && e.path === '$["order_id"]'));

    // 5c. Type conflict (expected string, received integer/number)
    const typePayload = {
      order_id: 12345, // should be string
      total: "100.0",
      currency_code: "usd",
      timestamp: "2026-03-14T10:00:00Z",
      region: "US-WEST",
    };
    const resType = validateAgainstTargetSchema(typePayload, normTarget);
    assert.equal(resType.valid, false);
    assert.ok(resType.errors.some((e) => e.rule === "type" && e.path === '$["order_id"]'));

    // 5d. Enum violation
    const enumPayload = {
      order_id: "ORD-1",
      total: "100.0",
      currency_code: "INVALID_CURRENCY", // must be usd, eur, or gbp
      timestamp: "2026-03-14T10:00:00Z",
      region: "US-WEST",
    };
    const resEnum = validateAgainstTargetSchema(enumPayload, normTarget);
    assert.equal(resEnum.valid, false);
    assert.ok(resEnum.errors.some((e) => e.rule === "enum" && e.path === '$["currency_code"]'));

    // 5e. Format violation (invalid date-time)
    const formatPayload = {
      order_id: "ORD-1",
      total: "100.0",
      currency_code: "usd",
      timestamp: "not-a-valid-date-time-string",
      region: "US-WEST",
    };
    const resFormat = validateAgainstTargetSchema(formatPayload, normTarget);
    assert.equal(resFormat.valid, false);
    assert.ok(resFormat.errors.some((e) => e.path === '$["timestamp"]'));
  });

  await t.test("6. Standalone TypeScript Adapter Code Generation", () => {
    const baseMappings = generateBaselineMappings(diff, normSource, normTarget);
    const approvedMappings = baseMappings.map((m) => {
      if (m.targetPath === '$["region"]') {
        return {
          ...m,
          status: "accepted" as const,
          transformation: {
            operation: "default" as const,
            defaultValue: "US-EAST",
            targetType: "string" as const,
          },
        };
      }
      return { ...m, status: "accepted" as const };
    });

    const compileResult = compileTransformationPlan(approvedMappings, normSource, normTarget);
    assert.ok(compileResult.success && compileResult.plan);

    const adapterCode = generateTypeScriptAdapter(compileResult.plan);

    // Verify key structures in emitted code
    assert.ok(adapterCode.includes("UNIFLOW ∞ — Generated TypeScript API Adapter"));
    assert.ok(adapterCode.includes("function getValueByPath"));
    assert.ok(adapterCode.includes("function setValueByPath"));
    assert.ok(adapterCode.includes("export function adapt"));
    assert.ok(adapterCode.includes("export const transform = adapt"));
    assert.ok(adapterCode.includes("LOOKUP_currency_code"));
    // Prohibit arbitrary eval or dangerous strings
    assert.equal(adapterCode.includes("eval("), false);
    assert.equal(adapterCode.includes("new Function("), false);
  });

  await t.test("7. Equivalence Verification Suite (Interpreter vs Adapter on Fixtures)", () => {
    const baseMappings = generateBaselineMappings(diff, normSource, normTarget);
    const approvedMappings = baseMappings.map((m) => {
      if (m.targetPath === '$["region"]') {
        return {
          ...m,
          status: "accepted" as const,
          transformation: {
            ...m.transformation,
            defaultValue: "unspecified",
          },
        };
      }
      return { ...m, status: "accepted" as const };
    });

    const compileResult = compileTransformationPlan(approvedMappings, normSource, normTarget);
    assert.ok(compileResult.success && compileResult.plan);

    const testSuiteResult = verifyAdapterEquivalence(
      compileResult.plan,
      normTarget,
      CANONICAL_TEST_FIXTURES
    );

    // 3 canonical fixtures: 2 valid cases, 1 expected invalid negative case
    assert.equal(testSuiteResult.totalCases, 3);
    assert.equal(testSuiteResult.passedCases, 3);
    assert.equal(testSuiteResult.allValid, true);
    assert.equal(testSuiteResult.allEqual, true);

    // Case 0: standard valid order
    assert.equal(testSuiteResult.cases[0].outputsEqual, true);
    assert.equal(testSuiteResult.cases[0].targetValidation.valid, true);

    // Case 1: EUR order
    assert.equal(testSuiteResult.cases[1].outputsEqual, true);
    assert.equal(testSuiteResult.cases[1].targetValidation.valid, true);

    // Case 2: negative case (missing amount in source)
    assert.equal(testSuiteResult.cases[2].interpreterResult.success, false);
    assert.equal(testSuiteResult.cases[2].outputsEqual, true);
  });
});
