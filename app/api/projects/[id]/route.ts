import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/store/project-store";
import {
  hydrateProjectState,
  persistProjectUpdate,
  persistProjectDelete,
} from "@/lib/store/supabase-persist";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getAuthenticatedUser(req);
    const state = await hydrateProjectState(id, user);

    if (!state) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ state });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getAuthenticatedUser(req);
    await hydrateProjectState(id, user);
    const body = await req.json().catch(() => ({}));

    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json(
        { error: "Field 'name' is required and cannot be empty." },
        { status: 400 }
      );
    }

    const updated = projectStore.renameProject(
      id,
      user.id,
      body.name.trim(),
      typeof body.description === "string" ? body.description.trim() : undefined
    );
    await persistProjectUpdate(updated, user);

    return NextResponse.json({ project: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getAuthenticatedUser(req);
    await hydrateProjectState(id, user);

    const result = projectStore.deleteProject(id, user.id);
    await persistProjectDelete(id, user);
    return NextResponse.json({
      success: true,
      message: `Project '${id}' and ${result.cleanedUpChildCount} child resources successfully deleted.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
