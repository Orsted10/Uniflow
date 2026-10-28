import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/store/project-store";
import { compileTransformationPlan } from "@/lib/transformation/compiler";

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

    if (!state.specs.source || !state.specs.target) {
      return NextResponse.json(
        { error: "Both source and target specs must be imported before compiling a plan." },
        { status: 400 }
      );
    }

    const result = compileTransformationPlan(
      state.mappings,
      state.specs.source.normalized,
      state.specs.target.normalized,
      `set-${id}`
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, errors: result.errors },
        { status: 422 }
      );
    }

    projectStore.setPlan(id, user.id, result.plan);

    return NextResponse.json({
      success: true,
      plan: result.plan,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
