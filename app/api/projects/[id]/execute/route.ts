import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/store/project-store";
import { executeTransformationPlan } from "@/lib/transformation/interpreter";
import { validateAgainstTargetSchema } from "@/lib/transformation/validate";
import { generateTypeScriptAdapter } from "@/lib/transformation/generator";
import { verifyAdapterEquivalence } from "@/lib/transformation/equivalence";
import { CANONICAL_TEST_FIXTURES } from "@/lib/specs/fixtures";

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

    if (!state.plan) {
      return NextResponse.json(
        { error: "No compiled transformation plan found. Please compile the plan first." },
        { status: 400 }
      );
    }

    if (!state.specs.target) {
      return NextResponse.json(
        { error: "Target specification is missing." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const samplePayload = body.payload || CANONICAL_TEST_FIXTURES[0].payload;

    // 1. Run interpreter on primary sample
    const execResult = executeTransformationPlan(state.plan, samplePayload);

    // 2. Validate output against target contract
    const validationResult = execResult.success
      ? validateAgainstTargetSchema(execResult.outputPayload, state.specs.target.normalized)
      : { valid: false, errors: [], checkedFieldCount: 0 };

    // 3. Generate TypeScript adapter code from the same validated plan
    const adapterCode = generateTypeScriptAdapter(state.plan);
    projectStore.setAdapter(id, user.id, adapterCode);

    // 4. Run test suite & verify adapter equivalence on agreed fixtures
    const fixtures = body.customFixtures || CANONICAL_TEST_FIXTURES;
    const testSuiteResult = verifyAdapterEquivalence(
      state.plan,
      state.specs.target.normalized,
      fixtures
    );
    projectStore.setExecutionResults(id, user.id, testSuiteResult);

    return NextResponse.json({
      success: execResult.success,
      execution: execResult,
      validation: validationResult,
      testSuite: testSuiteResult,
      adapterCode,
      equivalenceVerified: testSuiteResult.allEqual,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
