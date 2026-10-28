import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/store/project-store";
import { assembleCompatibilityReport } from "@/lib/reports/assemble";

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
      state.testSuiteResult || null
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
