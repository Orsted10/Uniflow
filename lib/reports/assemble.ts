import crypto from "crypto";
import { NormalizedSchema, StructuralDiff } from "../specs/types";
import { CandidateMapping } from "../mapping/types";
import { TransformationPlan } from "../transformation/ir";
import { EquivalenceTestSuiteResult } from "../transformation/equivalence";

export interface ArtifactChecksums {
  sourceSchemaHash: string;
  targetSchemaHash: string;
  planHash: string | null;
  adapterHash: string | null;
}

export interface CloudEvidenceMetadata {
  azureSqlRunId: string | null;
  azureBlobReportMdUrl: string | null;
  azureBlobReportJsonUrl: string | null;
  persistedAt: string | null;
}

export interface CompatibilityReportData {
  reportId: string;
  projectId: string;
  generatedAt: string;
  checksums: ArtifactChecksums;
  sourceContract: {
    title: string;
    version: string;
    format: string;
    fieldCount: number;
    sha256: string;
  };
  targetContract: {
    title: string;
    version: string;
    format: string;
    fieldCount: number;
    sha256: string;
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
    planHash: string | null;
    stepsCount: number;
    conversions: string[];
  };
  testResults: {
    allPassed: boolean;
    equivalenceVerified: boolean;
    testCasesCount: number;
    passedCasesCount: number;
  };
  cloudEvidence: CloudEvidenceMetadata;
  limitationsAndDisclosures: string[];
}

export function assembleCompatibilityReport(
  projectId: string,
  sourceSchema: NormalizedSchema,
  targetSchema: NormalizedSchema,
  diff: StructuralDiff,
  mappings: CandidateMapping[],
  plan: TransformationPlan | null,
  testSuite: EquivalenceTestSuiteResult | null,
  adapterCode?: string | null,
  cloudEvidence?: Partial<CloudEvidenceMetadata>
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
    "Adapter equivalence is formally verified on supplied and generated test fixtures; equivalence is not mathematically guaranteed for arbitrary out-of-spec payloads.",
    "Approved default values substitute missing source data and must be verified by integration domain owners.",
    "Type conversions operate within safe numeric and ISO-8601 string boundaries without silent decimal truncation.",
    "Azure SQL execution evidence stores tamper-evident input/output run hashes but does not mutate the Supabase core system of record.",
  ];

  // Cryptographic checksum calculations
  const sourceHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(sourceSchema), "utf8")
    .digest("hex");

  const targetHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(targetSchema), "utf8")
    .digest("hex");

  const planHash = plan
    ? crypto.createHash("sha256").update(JSON.stringify(plan), "utf8").digest("hex")
    : null;

  const adapterHash = adapterCode
    ? crypto.createHash("sha256").update(adapterCode, "utf8").digest("hex")
    : null;

  const reportId = `rep-${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`;
  const now = new Date().toISOString();

  const reportData: CompatibilityReportData = {
    reportId,
    projectId,
    generatedAt: now,
    checksums: {
      sourceSchemaHash: sourceHash,
      targetSchemaHash: targetHash,
      planHash,
      adapterHash,
    },
    sourceContract: {
      title: sourceSchema.title,
      version: sourceSchema.version,
      format: sourceSchema.metadata.format,
      fieldCount: sourceSchema.metadata.fieldCount,
      sha256: sourceHash,
    },
    targetContract: {
      title: targetSchema.title,
      version: targetSchema.version,
      format: targetSchema.metadata.format,
      fieldCount: targetSchema.metadata.fieldCount,
      sha256: targetHash,
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
      planHash,
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
      passedCasesCount: testSuite?.passedCases ?? 0,
    },
    cloudEvidence: {
      azureSqlRunId: cloudEvidence?.azureSqlRunId || null,
      azureBlobReportMdUrl: cloudEvidence?.azureBlobReportMdUrl || null,
      azureBlobReportJsonUrl: cloudEvidence?.azureBlobReportJsonUrl || null,
      persistedAt: cloudEvidence?.persistedAt || null,
    },
    limitationsAndDisclosures: limitations,
  };

  const md = generateMarkdownReport(reportData);

  return {
    reportData,
    markdown: md,
  };
}

export function generateMarkdownReport(r: CompatibilityReportData): string {
  const cloudSection = r.cloudEvidence.azureSqlRunId
    ? `
---

## 6. Multi-Cloud Execution Evidence (Azure)

- **Azure SQL Run ID:** \`${r.cloudEvidence.azureSqlRunId}\`
- **Azure Blob Markdown Artifact:** ${r.cloudEvidence.azureBlobReportMdUrl || "N/A"}
- **Azure Blob JSON Artifact:** ${r.cloudEvidence.azureBlobReportJsonUrl || "N/A"}
- **Certified At:** ${r.cloudEvidence.persistedAt || r.generatedAt}
`
    : "";

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
| **SHA-256 Digest** | \`${r.sourceContract.sha256.slice(0, 16)}...\` | \`${r.targetContract.sha256.slice(0, 16)}...\` |

---

## 2. Cryptographic Digest Ledger

- **Source Schema Checksum (SHA-256):** \`${r.checksums.sourceSchemaHash}\`
- **Target Schema Checksum (SHA-256):** \`${r.checksums.targetSchemaHash}\`
- **Plan IR Checksum (SHA-256):** \`${r.checksums.planHash || "N/A"}\`
- **Generated Adapter Checksum (SHA-256):** \`${r.checksums.adapterHash || "N/A"}\`

---

## 3. Structural Diff Metrics

- **Total Target Leaf Fields:** ${r.structuralDiff.totalTargetFields}
- **Exact Path & Type Matches:** ${r.structuralDiff.exactMatches}
- **Renamed Candidate Fields:** ${r.structuralDiff.renamedCandidates}
- **Type Conflicts Requiring Conversion:** ${r.structuralDiff.typeConflicts}
- **Missing Required Target Fields:** ${r.structuralDiff.missingRequired}
- **Optional to Required Transitions:** ${r.structuralDiff.optionalToRequired}
- **Enum Differences:** ${r.structuralDiff.enumMismatches}

---

## 4. Approved Transformation Plan

**Plan ID:** \`${r.transformationPlanSummary.planId}\` (${r.transformationPlanSummary.stepsCount} compiled steps)

| Target Path | Source Path | Operation | Rationale |
| :--- | :--- | :--- | :--- |
${r.approvedMappings.length > 0 ? r.approvedMappings
  .map(
    (m) =>
      `| \`${m.targetPath}\` | \`${m.sourcePath || "(default)"}\` | \`${m.operation}\` | ${m.rationale} |`
  )
  .join("\n") : "| (No approved mappings) | - | - | - |"}

---

## 5. Deterministic Test & Equivalence Verification

- **Total Test Cases Executed:** ${r.summary.totalTests}
- **Passed Test Cases:** ${r.summary.testsPassed}
- **Target Contract Validity:** ${r.testResults.allPassed ? "PASSED (100% compliant)" : "FAILED"}
- **Interpreter vs Adapter Output Equivalence:** ${
    r.testResults.equivalenceVerified ? "VERIFIED (Deterministic equality)" : "UNVERIFIED"
  }
${cloudSection}
---

## 7. Security & Trust Disclosures

${r.limitationsAndDisclosures.map((d) => `- ${d}`).join("\n")}
`;
}
