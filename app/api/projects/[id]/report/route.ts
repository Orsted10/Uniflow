import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/store/project-store";
import { assembleCompatibilityReport } from "@/lib/reports/assemble";
import { persistCompatibilityRunEvidence } from "@/lib/azure/sql";
import { uploadReportToBlob } from "@/lib/azure/storage";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getAuthenticatedUser(req);
    const state = projectStore.getProjectState(id, user.id);
    if (!state) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!state.specs.source || !state.specs.target || !state.diff) {
      return NextResponse.json(
        { error: "Specifications and comparison are required to generate a report." },
        { status: 400 }
      );
    }

    const report = assembleCompatibilityReport(
      id,
      state.specs.source.normalized,
      state.specs.target.normalized,
      state.diff,
      state.mappings,
      state.plan || null,
      state.testSuiteResult || null,
      state.adapter?.code || null
    );

    projectStore.setReport(id, user.id, report.reportData, report.markdown);

    return NextResponse.json({
      reportData: report.reportData,
      markdown: report.markdown,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getAuthenticatedUser(req);
    const state = projectStore.getProjectState(id, user.id);
    if (!state) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!state.specs.source || !state.specs.target || !state.diff) {
      return NextResponse.json(
        { error: "Specifications and diff required before certifying execution evidence." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const targetAction: "azure_sql" | "azure_blob" | "all" = body.action || "all";

    // 1. Initial report assembly
    const initialReport = assembleCompatibilityReport(
      id,
      state.specs.source.normalized,
      state.specs.target.normalized,
      state.diff,
      state.mappings,
      state.plan || null,
      state.testSuiteResult || null,
      state.adapter?.code || null
    );

    let azureSqlRunId: string | null = null;
    let azureBlobMdUrl: string | null = null;
    let azureBlobJsonUrl: string | null = null;
    let sqlResult: unknown = null;
    let blobResult: unknown = null;

    // 2. Persist execution evidence to Azure SQL
    if (targetAction === "azure_sql" || targetAction === "all") {
      const cases = (state.testSuiteResult?.cases || []).map((c, idx) => ({
        caseIndex: c.caseIndex ?? idx + 1,
        description: c.description,
        inputPayload: c.inputPayload,
        targetValid: c.targetValidation.valid,
        interpreterOutput: c.interpreterResult.outputPayload,
        adapterOutput: c.interpreterResult.outputPayload,
        outputsEqual: c.outputsEqual,
        failureReason: c.mismatchReason || c.targetValidation.errors.map((e) => e.message).join("; ") || undefined,
        resultDetail: { checkedFieldCount: c.targetValidation.checkedFieldCount },
      }));

      const planId = state.plan?.planId || `plan-${id}`;
      const status =
        state.testSuiteResult && state.testSuiteResult.allValid && state.testSuiteResult.allEqual
          ? "passed"
          : "invalid";

      const persistRes = await persistCompatibilityRunEvidence({
        supabaseProjectId: id,
        supabaseMappingSetId: `ms-${id}`,
        transformationPlanId: planId,
        planVersion: "1.0.0",
        adapterVersion: "1.0.0",
        status,
        actor: user.email || user.id,
        cases,
      });

      azureSqlRunId = persistRes.runId;
      sqlResult = persistRes;
    }

    // 3. Upload report artifacts to Azure Blob Storage
    if (targetAction === "azure_blob" || targetAction === "all") {
      const uploadRes = await uploadReportToBlob(
        id,
        initialReport.reportData.reportId,
        initialReport.markdown,
        initialReport.reportData
      );

      azureBlobMdUrl = uploadRes.markdownArtifact.blobUrl;
      azureBlobJsonUrl = uploadRes.jsonArtifact.blobUrl;
      blobResult = uploadRes;
    }

    // 4. Re-assemble report with Azure evidence references
    const finalReport = assembleCompatibilityReport(
      id,
      state.specs.source.normalized,
      state.specs.target.normalized,
      state.diff,
      state.mappings,
      state.plan || null,
      state.testSuiteResult || null,
      state.adapter?.code || null,
      {
        azureSqlRunId,
        azureBlobReportMdUrl: azureBlobMdUrl,
        azureBlobReportJsonUrl: azureBlobJsonUrl,
        persistedAt: new Date().toISOString(),
      }
    );

    projectStore.setReport(id, user.id, finalReport.reportData, finalReport.markdown);

    return NextResponse.json({
      success: true,
      reportData: finalReport.reportData,
      markdown: finalReport.markdown,
      evidence: {
        sql: sqlResult,
        blob: blobResult,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
