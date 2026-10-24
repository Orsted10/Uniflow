import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/store/project-store";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const projects = projectStore.listProjects(user.id);
    return NextResponse.json({ projects, user });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Untitled Project";
    const description = typeof body.description === "string" ? body.description.trim() : "";

    const project = projectStore.createProject(user.id, name, description);
    return NextResponse.json({ project }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
