import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/store/project-store";
import { parseSpecificationText } from "@/lib/specs/parser";
import { normalizeSpecification } from "@/lib/specs/normalizer";
import { computeStructuralDiff } from "@/lib/specs/diff";
import { generateBaselineMappings } from "@/lib/mapping/classify";

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

    return NextResponse.json({
      specs: state.specs,
      diff: state.diff || null,
      mappingsCount: state.mappings.length,
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

    const body = await req.json().catch(() => ({}));
    const side = body.side as "source" | "target";
    if (side !== "source" && side !== "target") {
      return NextResponse.json(
        { error: "Invalid 'side' parameter. Must be 'source' or 'target'." },
        { status: 400 }
      );
    }

    const rawContent = typeof body.rawContent === "string" ? body.rawContent : "";
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : `${side}-spec.json`;
    const selectedSchemaName = typeof body.selectedSchema === "string" && body.selectedSchema.trim()
      ? body.selectedSchema.trim()
      : undefined;

    // 1. Parse untrusted specification text with safety checks
    const parsed = parseSpecificationText(rawContent, name, selectedSchemaName);
    const normalized = normalizeSpecification(parsed, `${id}-${side}`);
    const byteLength = new TextEncoder().encode(rawContent).length;

    // 2. Compute cryptographic SHA-256 hash of original raw content
    const contentHash = crypto.createHash("sha256").update(rawContent).digest("hex");
    normalized.metadata.schemaHash = contentHash;
    normalized.metadata.originalFilename = name;

    // 3. Store spec and handle replacement / downstream invalidation
    const { spec, replaced, invalidatedDownstream } = projectStore.setSpec(
      id,
      user.id,
      side,
      name,
      parsed.format,
      normalized,
      byteLength,
      rawContent,
      contentHash
    );

    // 4. Recompute structural diff and baseline mappings if both specs exist
    let diff = state.diff;
    let mappings = state.mappings;

    if (state.specs.source && state.specs.target) {
      diff = computeStructuralDiff(
        state.specs.source.normalized,
        state.specs.target.normalized
      );
      projectStore.setDiff(id, user.id, diff);

      mappings = generateBaselineMappings(
        diff,
        state.specs.source.normalized,
        state.specs.target.normalized,
        `set-${id}`
      );
      projectStore.setMappings(id, user.id, mappings);
    }

    return NextResponse.json({
      spec,
      normalized,
      diff,
      mappings,
      replaced,
      invalidatedDownstream,
      availableSchemas: parsed.availableSchemas || [],
      selectedSchema: parsed.selectedSchema,
      warnings: parsed.warnings || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("FORBIDDEN") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
