import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/store/project-store";
import {
  MappingStatus,
  ProposedTransformation,
  CandidateMapping,
  ALLOWED_OPERATIONS,
  SUPPORTED_CONVERSIONS,
  AllowedOperation,
} from "@/lib/mapping/types";

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
    return NextResponse.json({ mappings: state.mappings });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * Creates or manually adds a mapping for a target field.
 */
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
        { error: "Both source and target specifications must be imported before creating mappings." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      targetPath,
      sourcePath,
      operation,
      conversionType,
      defaultValue,
      lookupTable,
      rationale,
    } = body;

    // 1. Validate targetPath exists in target schema
    if (!targetPath || typeof targetPath !== "string") {
      return NextResponse.json({ error: "targetPath is required" }, { status: 400 });
    }
    const targetField = state.specs.target.normalized.flatFields[targetPath];
    if (!targetField) {
      return NextResponse.json(
        { error: `Target path '${targetPath}' does not exist in target schema.` },
        { status: 400 }
      );
    }

    // 2. Validate sourcePath exists in source schema (if supplied)
    let sourceField = null;
    if (sourcePath && typeof sourcePath === "string") {
      sourceField = state.specs.source.normalized.flatFields[sourcePath];
      if (!sourceField) {
        return NextResponse.json(
          { error: `Source path '${sourcePath}' does not exist in source schema.` },
          { status: 400 }
        );
      }
    }

    // 3. Validate operation
    if (!operation || !ALLOWED_OPERATIONS.includes(operation as AllowedOperation)) {
      return NextResponse.json(
        {
          error: `Invalid operation '${operation}'. Must be one of: [${ALLOWED_OPERATIONS.join(", ")}]`,
        },
        { status: 400 }
      );
    }

    // 4. Validate conversionType if operation is typeConversion
    if (operation === "typeConversion") {
      if (!conversionType || !SUPPORTED_CONVERSIONS.includes(conversionType)) {
        return NextResponse.json(
          {
            error: `Invalid conversionType '${conversionType}'. Supported conversions: [${SUPPORTED_CONVERSIONS.join(", ")}]`,
          },
          { status: 400 }
        );
      }
    }

    const now = new Date().toISOString();
    const transformation: ProposedTransformation = {
      operation: operation as AllowedOperation,
      sourceType: sourceField?.type,
      targetType: targetField.type,
      conversionType: operation === "typeConversion" ? conversionType : undefined,
      defaultValue: operation === "default" ? defaultValue : undefined,
      lookupTable: operation === "lookup" ? lookupTable : undefined,
      policyOnMissing: targetField.required ? "fail" : "omit",
    };

    const newMapping: CandidateMapping = {
      id: `map-manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      mappingSetId: `set-${id}`,
      sourcePath: sourcePath || null,
      targetPath,
      status: "accepted",
      semanticStatus: "verified",
      transformation,
      rationale: rationale?.trim() || `Manual human mapping defined by reviewer (${user.email || user.id}).`,
      uncertaintyScore: "LOW",
      uncertaintyExplanation: "Manually specified and verified by human engineer.",
      provider: "manual",
      informationLoss: [],
      decisionHistory: [
        {
          action: "accepted",
          timestamp: now,
          actor: user.id,
          note: "Manually created and approved mapping",
        },
      ],
    };

    const saved = projectStore.addMapping(id, user.id, newMapping);
    return NextResponse.json({ mapping: saved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("FORBIDDEN") ? 403 : 400;
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
    const state = projectStore.getProjectState(id, user.id);
    if (!state) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { mappingId, status, transformation, sourcePath, note, acceptAll } = body;

    if (acceptAll === true) {
      // Convenience batch action: accept all valid proposed mappings
      const updatedList = state.mappings.map((m) => {
        if (m.status === "proposed" || m.status === "needs_confirmation") {
          return {
            ...m,
            status: "accepted" as MappingStatus,
            semanticStatus: "verified" as const,
            decisionHistory: [
              ...m.decisionHistory,
              {
                action: "accepted" as const,
                timestamp: new Date().toISOString(),
                actor: user.id,
                note: "Human batch approval",
              },
            ],
          };
        }
        return m;
      });
      projectStore.setMappings(id, user.id, updatedList);
      return NextResponse.json({ mappings: updatedList });
    }

    if (!mappingId || typeof mappingId !== "string") {
      return NextResponse.json({ error: "mappingId is required" }, { status: 400 });
    }

    const existingMapping = state.mappings.find((m) => m.id === mappingId);
    if (!existingMapping) {
      return NextResponse.json({ error: `Mapping '${mappingId}' not found` }, { status: 404 });
    }

    const update: Partial<CandidateMapping> = {};

    // Validate updated sourcePath if specified
    if (sourcePath !== undefined) {
      if (sourcePath === null || sourcePath === "") {
        update.sourcePath = null;
      } else {
        const sourceField = state.specs.source?.normalized.flatFields[sourcePath];
        if (!sourceField) {
          return NextResponse.json(
            { error: `Source path '${sourcePath}' does not exist in source schema.` },
            { status: 400 }
          );
        }
        update.sourcePath = sourcePath;
      }
    }

    // Validate updated transformation if specified
    if (transformation) {
      if (!ALLOWED_OPERATIONS.includes(transformation.operation)) {
        return NextResponse.json(
          {
            error: `Invalid operation '${transformation.operation}'. Must be one of: [${ALLOWED_OPERATIONS.join(", ")}]`,
          },
          { status: 400 }
        );
      }
      if (transformation.operation === "typeConversion") {
        if (
          !transformation.conversionType ||
          !SUPPORTED_CONVERSIONS.includes(transformation.conversionType)
        ) {
          return NextResponse.json(
            {
              error: `Invalid conversionType '${transformation.conversionType}'. Supported conversions: [${SUPPORTED_CONVERSIONS.join(", ")}]`,
            },
            { status: 400 }
          );
        }
      }
      update.transformation = transformation;
      update.status = "edited";
      update.semanticStatus = "verified";
    }

    if (status) {
      update.status = status;
      if (status === "accepted" || status === "edited") {
        update.semanticStatus = "verified";
      } else if (status === "rejected") {
        update.semanticStatus = "ambiguous";
      }
    }

    const updated = projectStore.updateMapping(id, user.id, mappingId, {
      ...update,
      decisionHistory: [
        ...existingMapping.decisionHistory,
        {
          action: update.status || existingMapping.status,
          timestamp: new Date().toISOString(),
          actor: user.id,
          note: note || `Review action: ${update.status || "updated"}`,
        },
      ],
    });

    return NextResponse.json({ mapping: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("FORBIDDEN") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
