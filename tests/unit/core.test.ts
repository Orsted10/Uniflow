import test from "node:test";
import assert from "node:assert/strict";
import { parseSpecificationText } from "../../lib/specs/parser";
import { normalizeSpecification } from "../../lib/specs/normalizer";
import { computeStructuralDiff } from "../../lib/specs/diff";
import { generateBaselineMappings } from "../../lib/mapping/classify";
import { compileTransformationPlan } from "../../lib/transformation/compiler";
import { executeTransformationPlan } from "../../lib/transformation/interpreter";
import { validateAgainstTargetSchema } from "../../lib/transformation/validate";
import { generateTypeScriptAdapter } from "../../lib/transformation/generator";
import { verifyAdapterEquivalence } from "../../lib/transformation/equivalence";
import { assembleCompatibilityReport } from "../../lib/reports/assemble";
import {
  CANONICAL_SOURCE_SPEC,
  CANONICAL_TARGET_SPEC,
  CANONICAL_TEST_FIXTURES,
} from "../../lib/specs/fixtures";

test("Uniflow Core Engine — Full Vertical Slice", async (t) => {
  await t.test("1. Specification Parsing and Safe Limits", () => {
    const parsedSource = parseSpecificationText(CANONICAL_SOURCE_SPEC, "source.json");
    assert.equal(parsedSource.format, "json-schema");
    assert.equal(parsedSource.title, "BillingOrderSourceAPI");

    const parsedTarget = parseSpecificationText(CANONICAL_TARGET_SPEC, "target.json");
    assert.equal(parsedTarget.format, "json-schema");
    assert.equal(parsedTarget.title, "InvoiceFulfillmentTargetAPI");

    // Rejects empty content
    assert.throws(() => parseSpecificationText("   "), /empty/);

    // Rejects malformed JSON
    assert.throws(() => parseSpecificationText("{ bad json "), /Malformed JSON/);
  });

  await t.test("2. Schema Normalization and Path Consistency", () => {
    const parsedSource = parseSpecificationText(CANONICAL_SOURCE_SPEC);
    const normSource = normalizeSpecification(parsedSource, "source-spec");

    assert.ok(normSource.flatFields['$["id"]']);
    assert.equal(normSource.flatFields['$["id"]'].type, "integer");
    assert.equal(normSource.flatFields['$["amount"]'].type, "number");
    assert.equal(normSource.flatFields['$["currency"]'].type, "string");

    const parsedTarget = parseSpecificationText(CANONICAL_TARGET_SPEC);
    const normTarget = normalizeSpecification(parsedTarget, "target-spec");

    assert.ok(normTarget.flatFields['$["order_id"]']);
    assert.equal(normTarget.flatFields['$["order_id"]'].type, "string");
    assert.ok(normTarget.flatFields['$["region"]']);
    assert.equal(normTarget.flatFields['$["region"]'].required, true);
  });

  await t.test("3. Deterministic Structural Difference Engine", () => {
    const normSource = normalizeSpecification(parseSpecificationText(CANONICAL_SOURCE_SPEC));
    const normTarget = normalizeSpecification(parseSpecificationText(CANONICAL_TARGET_SPEC));

    const diff = computeStructuralDiff(normSource, normTarget);

    assert.ok(diff.summary.totalTargetFields >= 5);
    // order_id is renamed from id
    const orderIdDiff = diff.items.find((i) => i.targetPath === '$["order_id"]');
    assert.ok(orderIdDiff);
    assert.equal(orderIdDiff?.category, "renamed");

    // region is missing from source
    const regionDiff = diff.items.find((i) => i.targetPath === '$["region"]');
    assert.ok(regionDiff);
    assert.equal(regionDiff?.category, "missing_required");
  });

  await t.test("4. Mapping Proposal and Human Review Gate", () => {
    const normSource = normalizeSpecification(parseSpecificationText(CANONICAL_SOURCE_SPEC));
    const normTarget = normalizeSpecification(parseSpecificationText(CANONICAL_TARGET_SPEC));
    const diff = computeStructuralDiff(normSource, normTarget);

    const mappings = generateBaselineMappings(diff, normSource, normTarget);
    assert.ok(mappings.length > 0);

    // Initial status must be proposed; not approved
    assert.ok(mappings.every((m) => m.status === "proposed"));

    // Attempting to compile without human approval must fail
    const unapprovedCompile = compileTransformationPlan(mappings, normSource, normTarget);
    assert.equal(unapprovedCompile.success, false);
    assert.ok(unapprovedCompile.errors?.[0].includes("No mappings have been approved"));
  });

  await t.test("5. Approved Plan Compilation and IR Validation", () => {
    const normSource = normalizeSpecification(parseSpecificationText(CANONICAL_SOURCE_SPEC));
    const normTarget = normalizeSpecification(parseSpecificationText(CANONICAL_TARGET_SPEC));
    const diff = computeStructuralDiff(normSource, normTarget);
    const mappings = generateBaselineMappings(diff, normSource, normTarget);

    // Simulate human review approval
    const approvedMappings = mappings.map((m) => {
      // Configure default for missing 'region'
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
      return {
        ...m,
        status: "accepted" as const,
      };
    });

    const compileResult = compileTransformationPlan(approvedMappings, normSource, normTarget);
    assert.equal(compileResult.success, true);
    assert.ok(compileResult.plan);
    assert.equal(compileResult.plan?.steps.length, approvedMappings.length);
  });

  await t.test("6. Trusted Interpreter Execution and Target Schema Validation", () => {
    const normSource = normalizeSpecification(parseSpecificationText(CANONICAL_SOURCE_SPEC));
    const normTarget = normalizeSpecification(parseSpecificationText(CANONICAL_TARGET_SPEC));
    const diff = computeStructuralDiff(normSource, normTarget);
    const mappings = generateBaselineMappings(diff, normSource, normTarget);

    const approvedMappings = mappings.map((m) => {
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

    // Run interpreter on canonical sample
    const sampleInput = CANONICAL_TEST_FIXTURES[0].payload;
    const execResult = executeTransformationPlan(compileResult.plan, sampleInput);

    assert.equal(execResult.success, true);
    const output = execResult.outputPayload;

    // Validate expected transformations:
    // id: 101 (int) -> order_id: "101" (string)
    assert.equal(output.order_id, "101");
    // amount: 42.5 (number) -> total: "42.5" (string)
    assert.equal(output.total, "42.5");
    // currency: "USD" -> currency_code: "usd"
    assert.equal(output.currency_code, "usd");
    // created_at -> timestamp
    assert.equal(output.timestamp, "2026-03-14T10:00:00Z");
    // note -> memo
    assert.equal(output.memo, "sample order note");
    // region default
    assert.equal(output.region, "unspecified");

    // Validate target schema conformance
    const validation = validateAgainstTargetSchema(output, normTarget);
    assert.equal(validation.valid, true);
    assert.equal(validation.errors.length, 0);
  });

  await t.test("7. Target Schema Validation Negative Case (Explainable Failure)", () => {
    const normTarget = normalizeSpecification(parseSpecificationText(CANONICAL_TARGET_SPEC));

    // Malformed output missing 'total' and with invalid enum 'yen'
    const malformedOutput = {
      order_id: "101",
      currency_code: "yen", // invalid enum
      timestamp: "2026-03-14T10:00:00Z",
      region: "unspecified",
    };

    const validation = validateAgainstTargetSchema(malformedOutput, normTarget);
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.length >= 2);

    const missingTotal = validation.errors.find((e) => e.path === '$["total"]');
    assert.ok(missingTotal);
    assert.equal(missingTotal?.rule, "required");

    const badCurrency = validation.errors.find((e) => e.path === '$["currency_code"]');
    assert.ok(badCurrency);
    assert.equal(badCurrency?.rule, "enum");
  });

  await t.test("8. TypeScript Adapter Generation and Equivalence Verification", () => {
    const normSource = normalizeSpecification(parseSpecificationText(CANONICAL_SOURCE_SPEC));
    const normTarget = normalizeSpecification(parseSpecificationText(CANONICAL_TARGET_SPEC));
    const diff = computeStructuralDiff(normSource, normTarget);
    const mappings = generateBaselineMappings(diff, normSource, normTarget).map((m) => ({
      ...m,
      status: "accepted" as const,
      transformation: {
        ...m.transformation,
        defaultValue: m.targetPath === '$["region"]' ? "unspecified" : m.transformation.defaultValue,
      },
    }));

    const compileResult = compileTransformationPlan(mappings, normSource, normTarget);
    assert.ok(compileResult.success && compileResult.plan);

    // Generate TypeScript adapter code
    const adapterCode = generateTypeScriptAdapter(compileResult.plan);
    assert.ok(adapterCode.includes("export function adapt("));
    assert.ok(adapterCode.includes("LOOKUP_currency_code"));;

    // Verify adapter equivalence on fixtures
    const equivalenceSuite = verifyAdapterEquivalence(
      compileResult.plan,
      normTarget,
      CANONICAL_TEST_FIXTURES
    );

    assert.equal(equivalenceSuite.allEqual, true);
    assert.equal(equivalenceSuite.totalCases, 3);
    assert.equal(equivalenceSuite.passedCases, 3); // 2 valid cases pass, 1 negative case correctly fails
  });

  await t.test("9. Compatibility Report Assembly", () => {
    const normSource = normalizeSpecification(parseSpecificationText(CANONICAL_SOURCE_SPEC));
    const normTarget = normalizeSpecification(parseSpecificationText(CANONICAL_TARGET_SPEC));
    const diff = computeStructuralDiff(normSource, normTarget);
    const mappings = generateBaselineMappings(diff, normSource, normTarget).map((m) => ({
      ...m,
      status: "accepted" as const,
      transformation: {
        ...m.transformation,
        defaultValue: m.targetPath === '$["region"]' ? "unspecified" : m.transformation.defaultValue,
      },
    }));

    const compileResult = compileTransformationPlan(mappings, normSource, normTarget);
    assert.ok(compileResult.success && compileResult.plan);

    const equivalenceSuite = verifyAdapterEquivalence(
      compileResult.plan,
      normTarget,
      CANONICAL_TEST_FIXTURES
    );

    const { reportData, markdown } = assembleCompatibilityReport(
      "test-proj-1",
      normSource,
      normTarget,
      diff,
      mappings,
      compileResult.plan,
      equivalenceSuite
    );

    assert.equal(reportData.status, "COMPATIBLE");
    assert.equal(reportData.summary.compatibilityScore, 100);
    assert.ok(markdown.includes("# UNIFLOW ∞ — API Compatibility Report"));
    assert.ok(markdown.includes("BillingOrderSourceAPI"));
    assert.ok(markdown.includes("InvoiceFulfillmentTargetAPI"));
  });
});
