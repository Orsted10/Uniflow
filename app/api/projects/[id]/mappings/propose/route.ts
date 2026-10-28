import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/store/project-store";
import { computeStructuralDiff } from "@/lib/specs/diff";
import { generateBaselineMappings } from "@/lib/mapping/classify";
import {
  getGroqProviderConfig,
  requestGroqMappingProposals,
  GroqProviderError,
} from "@/lib/ai/groq";

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

    const config = getGroqProviderConfig();
    return NextResponse.json({
      configured: config.configured,
      model: config.model,
      fastModel: config.fastModel,
      timeoutMs: config.timeoutMs,
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

    if (!state.specs.source || !state.specs.target) {
      return NextResponse.json(
        { error: "Both source and target contract specifications must be imported before proposing mappings." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const fallbackToDeterministic = Boolean(body.fallbackToDeterministic);
    const preferredModel = typeof body.preferredModel === "string" ? body.preferredModel : undefined;

    // Ensure structural diff exists
    let diff = state.diff;
    if (!diff) {
      diff = computeStructuralDiff(
        state.specs.source.normalized,
        state.specs.target.normalized
      );
      projectStore.setDiff(id, user.id, diff);
    }

    const config = getGroqProviderConfig();

    // 1. If Groq is configured and deterministic fallback was not explicitly requested
    if (config.configured && !fallbackToDeterministic) {
      try {
        const aiMappings = await requestGroqMappingProposals(
          state.specs.source.normalized,
          state.specs.target.normalized,
          diff,
          { preferredModel }
        );

        projectStore.setMappings(id, user.id, aiMappings);

        return NextResponse.json({
          mappings: aiMappings,
          provider: "groq",
          model: preferredModel || config.model,
          count: aiMappings.length,
        });
      } catch (err: unknown) {
        // If Groq fails and client allows automatic fallback
        if (body.allowFallbackOnFailure) {
          const baselineMappings = generateBaselineMappings(
            diff,
            state.specs.source.normalized,
            state.specs.target.normalized,
            `set-${id}`
          );
          // Label explicitly as deterministic heuristic fallback
          const marked = baselineMappings.map((m) => ({
            ...m,
            provider: "deterministic" as const,
          }));
          projectStore.setMappings(id, user.id, marked);

          return NextResponse.json({
            mappings: marked,
            provider: "deterministic",
            notice: `Groq service error (${err instanceof Error ? err.message : String(err)}). Reverted to deterministic baseline proposals.`,
            count: marked.length,
          });
        }

        if (err instanceof GroqProviderError) {
          return NextResponse.json(
            {
              error: err.message,
              code: err.code,
              retryable: err.retryable,
              fallbackAvailable: true,
            },
            { status: err.status || 500 }
          );
        }

        throw err;
      }
    }

    // 2. Groq is not configured or deterministic fallback requested
    if (fallbackToDeterministic) {
      const baselineMappings = generateBaselineMappings(
        diff,
        state.specs.source.normalized,
        state.specs.target.normalized,
        `set-${id}`
      );
      const marked = baselineMappings.map((m) => ({
        ...m,
        provider: "deterministic" as const,
      }));
      projectStore.setMappings(id, user.id, marked);

      return NextResponse.json({
        mappings: marked,
        provider: "deterministic",
        notice: config.configured
          ? "Generated using deterministic structural diff heuristics."
          : "Generated using deterministic heuristics (GROQ_API_KEY is not configured in server environment).",
        count: marked.length,
      });
    }

    // 3. Groq not configured and fallback not explicitly selected
    return NextResponse.json(
      {
        error:
          "Groq API key is not configured in server environment (.env.local). You can map fields manually or select 'Generate Heuristic Baseline'.",
        code: "GROQ_NOT_CONFIGURED",
        retryable: true,
        fallbackAvailable: true,
      },
      { status: 503 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
