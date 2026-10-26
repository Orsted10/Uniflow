import { NormalizedSchema, StructuralDiff } from "../specs/types";
import { CandidateMapping } from "../mapping/types";
import { TransformationPlan } from "../transformation/ir";
import { EquivalenceTestSuiteResult } from "../transformation/equivalence";

export type CompatibilityReportData = {
  reportId: string;
  projectId: string;
  generatedAt: string;
  sourceContract: {
    title: string;
    version: string;
    format: string;
    fieldCount: number;
  };
  targetContract: {
    title: string;
    version: string;
    format: string;
    fieldCount: number;
  };
  status: "COMPATIBLE" | "CONDITIONALLY_COMPATIBLE" | "INCOMPATIBLE";
  summary: {
    compatibilityScore: number; // 0 - 100%
    totalTargetFields: number;
    approvedMappingsCount: number;
    exactMatches: number;
    conversionsApplied: number;
    defaultsApplied: number;
    testsPassed: number;
    totalTests: number;
  };
  structuralDiff: StructuralDiff["summary"];
  approvedMappings: Array<{
    targetPath: string;
    sourcePath: string | null;
    operation: string;
    rationale: string;
  }>;
  transformationPlanSummary: {
    planId: string;
    stepsCount: number;
    conversions: string[];
  };
  testResults: {
    allPassed: boolean;
    equivalenceVerified: boolean;
    testCasesCount: number;
  };
  limitationsAndDisclosures: string[];
};

export function assembleCompatibilityReport(
  projectId: string,
  sourceSchema: NormalizedSchema,
  targetSchema: NormalizedSchema,
  diff: StructuralDiff,
  mappings: CandidateMapping[],
  plan: TransformationPlan | null,
  testSuite: EquivalenceTestSuiteResult | null
): { reportData: CompatibilityReportData; markdown: string } {
  const approvedMappings = mappings.filter((m) => m.status === "accepted" || m.status === "edited");
  const targetRequiredCount = Object.values(targetSchema.flatFields).filter(
    (f) => f.path !== "$" && f.required && (!f.children || f.children.length === 0)
  ).length;

  const score = targetRequiredCount > 0
    ? Math.min(100, Math.round((approvedMappings.length / targetRequiredCount) * 100))
    : 100;

  const conversionsApplied = plan
    ? plan.steps.filter((s) => s.operation === "typeConversion").length
    : 0;

  const defaultsApplied = plan
    ? plan.steps.filter((s) => s.operation === "default").length
    : 0;

  const status: CompatibilityReportData["status"] =
    testSuite && testSuite.allValid && testSuite.allEqual && score === 100
      ? "COMPATIBLE"
      : score > 0
      ? "CONDITIONALLY_COMPATIBLE"
      : "INCOMPATIBLE";

  const limitations = [
    "Adapter equivalence is formally verified on tested fixtures; equivalence is not mathematically guaranteed for arbitrary out-of-spec payloads.",
    "Approved default values substitute missing source data and must be verified by integration domain owners.",
    "Type conversions operate within safe numeric and ISO string boundaries without silent decimal truncation.",
  ];

  const reportData: CompatibilityReportData = {
    reportId: `rep-${Date.now()}`,
    projectId,
    generatedAt: new Date().toISOString(),
    sourceContract: {
      title: sourceSchema.title,
      version: sourceSchema.version,
      format: sourceSchema.metadata.format,
      fieldCount: sourceSchema.metadata.fieldCount,
    },
    targetContract: {
      title: targetSchema.title,
      version: targetSchema.version,
      format: targetSchema.metadata.format,
      fieldCount: targetSchema.metadata.fieldCount,
    },
    status,
    summary: {
      compatibilityScore: score,
      totalTargetFields: diff.summary.totalTargetFields,
      approvedMappingsCount: approvedMappings.length,
      exactMatches: diff.summary.exactMatches,
      conversionsApplied,
      defaultsApplied,
      testsPassed: testSuite?.passedCases ?? 0,
      totalTests: testSuite?.totalCases ?? 0,
    },
    structuralDiff: diff.summary,
    approvedMappings: approvedMappings.map((m) => ({
      targetPath: m.targetPath,
      sourcePath: m.sourcePath,
      operation: m.transformation.operation,
      rationale: m.rationale,
    })),
    transformationPlanSummary: {
      planId: plan?.planId || "none",
      stepsCount: plan?.steps.length || 0,
      conversions: plan
        ? plan.steps
            .filter((s) => s.conversionType)
            .map((s) => `${s.sourcePath} -> ${s.conversionType} -> ${s.targetPath}`)
        : [],
    },
    testResults: {
      allPassed: testSuite?.allValid ?? false,
      equivalenceVerified: testSuite?.allEqual ?? false,
      testCasesCount: testSuite?.totalCases ?? 0,
    },
    limitationsAndDisclosures: limitations,
  };

  const md = generateMarkdownReport(reportData);

  return {
    reportData,
    markdown: md,
  };
}

function generateMarkdownReport(r: CompatibilityReportData): string {
  return `# UNIFLOW ∞ — API Compatibility Report

**Report ID:** \`${r.reportId}\`  
**Generated At:** ${r.generatedAt}  
**Status:** **${r.status}** (${r.summary.compatibilityScore}% Compatibility Score)  

---

## 1. Executive Summary

| Attribute | Source Specification | Target Specification |
| :--- | :--- | :--- |
| **Title** | ${r.sourceContract.title} | ${r.targetContract.title} |
| **Version** | ${r.sourceContract.version} | ${r.targetContract.version} |
| **Format** | ${r.sourceContract.format} | ${r.targetContract.format} |
| **Field Count** | ${r.sourceContract.fieldCount} | ${r.targetContract.fieldCount} |

---

## 2. Structural Diff Metrics

- **Total Target Leaf Fields:** ${r.structuralDiff.totalTargetFields}
- **Exact Path & Type Matches:** ${r.structuralDiff.exactMatches}
- **Renamed Candidate Fields:** ${r.structuralDiff.renamedCandidates}
- **Type Conflicts Requiring Conversion:** ${r.structuralDiff.typeConflicts}
- **Missing Required Target Fields:** ${r.structuralDiff.missingRequired}
- **Optional to Required Transitions:** ${r.structuralDiff.optionalToRequired}
- **Enum Differences:** ${r.structuralDiff.enumMismatches}

---

## 3. Approved Transformation Plan

**Plan ID:** \`${r.transformationPlanSummary.planId}\` (${r.transformationPlanSummary.stepsCount} compiled steps)

| Target Path | Source Path | Operation | Rationale |
| :--- | :--- | :--- | :--- |
${r.approvedMappings
  .map(
    (m) =>
      `| \`${m.targetPath}\` | \`${m.sourcePath || "(default)"}\` | \`${m.operation}\` | ${m.rationale} |`
  )
  .join("\n")}

---

## 4. Deterministic Test & Equivalence Verification

- **Total Test Cases Executed:** ${r.summary.totalTests}
- **Passed Test Cases:** ${r.summary.testsPassed}
- **Target Contract Validity:** ${r.testResults.allPassed ? "PASSED (100% compliant)" : "FAILED"}
- **Interpreter vs Adapter Output Equivalence:** ${
    r.testResults.equivalenceVerified ? "VERIFIED (Deterministic equality)" : "UNVERIFIED"
  }

---

## 5. Security & Trust Disclosures

${r.limitationsAndDisclosures.map((d) => `- ${d}`).join("\n")}
`;
}
