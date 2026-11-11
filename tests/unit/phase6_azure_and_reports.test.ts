import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
  getAzureBlobConfig,
  uploadSpecToBlob,
  uploadReportToBlob,
  getBlobContent,
} from "../../lib/azure/storage";
import {
  getAzureSqlConfig,
  persistCompatibilityRunEvidence,
  getCompatibilityRunEvidence,
  listRunsForProject,
} from "../../lib/azure/sql";
import { assembleCompatibilityReport } from "../../lib/reports/assemble";
import { parseSpecificationText } from "../../lib/specs/parser";
import { normalizeSpecification } from "../../lib/specs/normalizer";
import { computeStructuralDiff } from "../../lib/specs/diff";
import { CANONICAL_SOURCE_SPEC, CANONICAL_TARGET_SPEC } from "../../lib/specs/fixtures";
import { CandidateMapping } from "../../lib/mapping/types";
import { TransformationPlan } from "../../lib/transformation/ir";

describe("Phase 6: Azure Cloud Integrations & Compatibility Report Engine", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  describe("Azure Blob Storage Module", () => {
    it("reports safe unconfigured state when environment variable is missing", () => {
      delete process.env.AZURE_STORAGE_CONNECTION_STRING;
      const config = getAzureBlobConfig();
      assert.strictEqual(config.configured, false);
      assert.strictEqual(config.accountName, null);
      assert.strictEqual(config.containerName, "uniflow-specs");
    });

    it("parses account name safely from connection string without leaking keys", () => {
      process.env.AZURE_STORAGE_CONNECTION_STRING =
        "DefaultEndpointsProtocol=https;AccountName=uniflowstorage;AccountKey=SuperSecretKey123==;EndpointSuffix=core.windows.net";
      const config = getAzureBlobConfig();
      assert.strictEqual(config.configured, true);
      assert.strictEqual(config.accountName, "uniflowstorage");
      assert.ok(!JSON.stringify(config).includes("SuperSecretKey123"));
    });

    it("uploads specification with deterministic SHA-256 hash in offline fallback", async () => {
      delete process.env.AZURE_STORAGE_CONNECTION_STRING;
      const res = await uploadSpecToBlob(
        "proj-test-1",
        "source",
        "order-v1.json",
        JSON.stringify({ order_id: "ORD-123" })
      );

      assert.strictEqual(res.provider, "local_memory");
      assert.strictEqual(res.contentHash.length, 64);
      assert.ok(res.blobName.includes("proj-test-1"));
      assert.ok(res.blobName.includes("source"));
      assert.ok(res.sizeBytes > 0);

      // Verify content can be retrieved
      const content = await getBlobContent(res.blobName);
      assert.ok(content && content.includes("ORD-123"));
    });

    it("uploads compatibility report artifacts (md and json) idempotently", async () => {
      delete process.env.AZURE_STORAGE_CONNECTION_STRING;
      const mockMd = "# Compatibility Report\n\nStatus: COMPATIBLE";
      const mockJson = { reportId: "rep-001", status: "COMPATIBLE" };

      const res = await uploadReportToBlob("proj-test-1", "rep-001", mockMd, mockJson);
      assert.strictEqual(res.markdownArtifact.provider, "local_memory");
      assert.strictEqual(res.jsonArtifact.provider, "local_memory");

      const mdContent = await getBlobContent(res.markdownArtifact.blobName);
      assert.strictEqual(mdContent, mockMd);

      const jsonContent = await getBlobContent(res.jsonArtifact.blobName);
      assert.deepStrictEqual(JSON.parse(jsonContent!), mockJson);
    });
  });

  describe("Azure SQL Transactional Bridge Module", () => {
    it("reports unconfigured state when connection string is missing or empty", () => {
      delete process.env.AZURE_SQL_CONNECTION_STRING;
      const config = getAzureSqlConfig();
      assert.strictEqual(config.configured, false);
      assert.strictEqual(config.server, null);
    });

    it("parses server, port, database, and user without leaking password", () => {
      process.env.AZURE_SQL_CONNECTION_STRING =
        "Server=tcp:uniflow-sql.database.windows.net,1433;Initial Catalog=uniflow-db;Persist Security Info=False;User ID=sqladmin;Password=SecretP@ssword!;MultipleActiveResultSets=False;Encrypt=True;";
      const config = getAzureSqlConfig();
      assert.strictEqual(config.configured, true);
      assert.strictEqual(config.server, "tcp:uniflow-sql.database.windows.net");
      assert.strictEqual(config.port, 1433);
      assert.strictEqual(config.database, "uniflow-db");
      assert.strictEqual(config.user, "sqladmin");
      assert.ok(!JSON.stringify(config).includes("SecretP@ssword!"));
    });

    it("persists execution evidence atomically with inputs, results, and audits", async () => {
      const projectId = "proj-sql-test-1";
      const persistRes = await persistCompatibilityRunEvidence({
        supabaseProjectId: projectId,
        supabaseMappingSetId: "ms-test-1",
        transformationPlanId: "plan-test-1",
        planVersion: "1.0.0",
        adapterVersion: "1.0.0",
        status: "passed",
        actor: "tester@uniflow.internal",
        cases: [
          {
            caseIndex: 1,
            description: "canonical_valid_order",
            inputPayload: { order_id: "101", amount: "99.99" },
            targetValid: true,
            interpreterOutput: { orderId: 101, total: 99.99 },
            adapterOutput: { orderId: 101, total: 99.99 },
            outputsEqual: true,
          },
          {
            caseIndex: 2,
            description: "edge_null_notes",
            inputPayload: { order_id: "102", amount: "10.00", notes: null },
            targetValid: true,
            interpreterOutput: { orderId: 102, total: 10.0 },
            adapterOutput: { orderId: 102, total: 10.0 },
            outputsEqual: true,
          },
        ],
      });

      assert.ok(persistRes.runId);
      assert.strictEqual(persistRes.status, "passed");
      assert.strictEqual(persistRes.recordCounts.inputs, 2);
      assert.strictEqual(persistRes.recordCounts.results, 2);
      assert.strictEqual(persistRes.recordCounts.audits, 1);

      // Verify retrieval
      const evidence = await getCompatibilityRunEvidence(persistRes.runId);
      assert.ok(evidence.run);
      assert.strictEqual(evidence.run?.supabase_project_id, projectId);
      assert.strictEqual(evidence.inputs.length, 2);
      assert.strictEqual(evidence.results.length, 2);
      assert.strictEqual(evidence.results[0].outputs_equal, true);
      assert.strictEqual(evidence.audits.length, 1);
      assert.strictEqual(evidence.audits[0].event_type, "COMPATIBILITY_RUN_CERTIFIED");

      // Verify project list
      const projectRuns = await listRunsForProject(projectId);
      assert.ok(projectRuns.length >= 1);
      assert.strictEqual(projectRuns[0].run_id, persistRes.runId);
    });
  });

  describe("Compatibility Report Assembler Engine", () => {
    it("assembles report with SHA-256 digests, diff metrics, and cloud evidence", () => {
      const sourceNorm = normalizeSpecification(parseSpecificationText(CANONICAL_SOURCE_SPEC));
      const targetNorm = normalizeSpecification(parseSpecificationText(CANONICAL_TARGET_SPEC));
      const diff = computeStructuralDiff(sourceNorm, targetNorm);

      const approvedMappings: CandidateMapping[] = [
        {
          id: "m1",
          targetPath: "$.id",
          sourcePath: "$.order_id",
          transformation: {
            operation: "typeConversion",
            conversionType: "string-to-integer",
          },
          uncertaintyScore: "LOW",
          uncertaintyExplanation: "Standard string to integer",
          rationale: "Convert order_id string to integer",
          status: "accepted",
          semanticStatus: "verified",
          informationLoss: [],
          decisionHistory: [],
        },
      ];

      const plan: TransformationPlan = {
        planId: "plan-canonical-1",
        version: "1.0.0",
        mappingSetId: "ms-canonical-1",
        sourceSpecId: "spec-source-1",
        targetSpecId: "spec-target-1",
        compiledAt: new Date().toISOString(),
        approvedMappingCount: 1,
        steps: [
          {
            stepId: "step-1",
            targetPath: "$.id",
            targetType: "integer",
            operation: "typeConversion",
            sourcePath: "$.order_id",
            conversionType: "string-to-integer",
            policyOnMissing: "fail",
          },
        ],
      };

      const testSuiteResult = {
        allValid: true,
        allEqual: true,
        totalCases: 5,
        passedCases: 5,
        cases: [],
      };

      const adapterCode = `export function transform(source: any): any { return { id: Number(source.order_id) }; }`;

      const { reportData, markdown } = assembleCompatibilityReport(
        "proj-canonical",
        sourceNorm,
        targetNorm,
        diff,
        approvedMappings,
        plan,
        testSuiteResult,
        adapterCode,
        {
          azureSqlRunId: "run-sql-guid-12345",
          azureBlobReportMdUrl: "https://uniflow.blob.core.windows.net/uniflow-specs/report.md",
          azureBlobReportJsonUrl: "https://uniflow.blob.core.windows.net/uniflow-specs/report.json",
          persistedAt: new Date().toISOString(),
        }
      );

      // Checksums
      assert.strictEqual(reportData.checksums.sourceSchemaHash.length, 64);
      assert.strictEqual(reportData.checksums.targetSchemaHash.length, 64);
      assert.strictEqual(reportData.checksums.planHash?.length, 64);
      assert.strictEqual(reportData.checksums.adapterHash?.length, 64);

      // Report content
      assert.ok(reportData.reportId);
      assert.strictEqual(reportData.status, "CONDITIONALLY_COMPATIBLE");
      assert.ok(reportData.summary.compatibilityScore > 0);
      assert.strictEqual(reportData.cloudEvidence.azureSqlRunId, "run-sql-guid-12345");

      // Markdown verification
      assert.ok(markdown.includes("# UNIFLOW ∞ — API Compatibility Report"));
      assert.ok(markdown.includes("Cryptographic Digest Ledger"));
      assert.ok(markdown.includes("Multi-Cloud Execution Evidence (Azure)"));
      assert.ok(markdown.includes("run-sql-guid-12345"));
      assert.ok(markdown.includes("Security & Trust Disclosures"));
    });
  });
});
