import * as crypto from "crypto";
import { createSupabaseServerClient } from "../supabase/server";
import { AuthUser } from "../auth/session";
import { Project, Spec } from "../supabase/models";
import { projectStore, ProjectState } from "./project-store";
import { computeStructuralDiff } from "../specs/diff";
import { NormalizedSchema } from "../specs/types";
import { CandidateMapping } from "../mapping/types";
import { generateTypeScriptAdapter } from "../transformation/generator";
import { CANONICAL_TEST_FIXTURES } from "../specs/fixtures";
import { verifyAdapterEquivalence } from "../transformation/equivalence";
import { assembleCompatibilityReport } from "../reports/assemble";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function canUseSupabaseDb(user: AuthUser): boolean {
  return Boolean(
    !user.isDemo &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      UUID_REGEX.test(user.id)
  );
}

/**
 * Lists projects for an authenticated user, merging local cache and Supabase PostgreSQL (RLS-enforced).
 */
export async function listProjectsWithDb(user: AuthUser): Promise<Project[]> {
  const local = projectStore.listProjects(user.id);
  if (!canUseSupabaseDb(user)) return local;

  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return local;

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false });

    if (error || !data) return local;

    const byId = new Map<string, Project>();
    for (const row of data as Project[]) {
      byId.set(row.id, row);
      const existing = projectStore.getProjectState(row.id, user.id);
      if (!existing) {
        projectStore.hydrateState({
          project: row,
          specs: {},
          mappings: [],
        });
      }
    }
    for (const p of local) {
      if (!byId.has(p.id)) {
        byId.set(p.id, p);
      }
    }
    return Array.from(byId.values()).sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  } catch {
    return local;
  }
}

/**
 * Resolves a project's full state from memory/disk first, falling back to Supabase PostgreSQL
 * across cold serverless containers. Enforces strict tenant ownership.
 */
export async function hydrateProjectState(
  projectId: string,
  user: AuthUser
): Promise<ProjectState | null> {
  const local = projectStore.getProjectState(projectId, user.id);
  if (local && (local.specs.source || local.specs.target || !canUseSupabaseDb(user))) {
    return local;
  }

  if (!canUseSupabaseDb(user) || !UUID_REGEX.test(projectId)) {
    return local;
  }

  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return local;

    const { data: projRow, error: projErr } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle();

    if (projErr || !projRow) return local;
    const project = projRow as Project;

    if (project.owner_id !== user.id) {
      throw new Error("FORBIDDEN: User does not own this project.");
    }

    const hydrated: ProjectState = {
      project,
      specs: {},
      mappings: [],
    };

    // Hydrate specs
    const { data: specRows } = await supabase
      .from("specs")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    if (Array.isArray(specRows)) {
      for (const s of specRows as Spec[]) {
        const normalized = s.normalized as NormalizedSchema;
        if (s.side === "source") {
          hydrated.specs.source = { spec: s, normalized };
        } else if (s.side === "target") {
          hydrated.specs.target = { spec: s, normalized };
        }
      }
    }

    if (hydrated.specs.source && hydrated.specs.target) {
      hydrated.diff = computeStructuralDiff(
        hydrated.specs.source.normalized,
        hydrated.specs.target.normalized
      );
    }

    // Hydrate mapping set & mappings
    const { data: mappingSetRow } = await supabase
      .from("mapping_sets")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (mappingSetRow) {
      hydrated.mappingSet = mappingSetRow;
      const { data: mappingRows } = await supabase
        .from("mappings")
        .select("*")
        .eq("mapping_set_id", mappingSetRow.id);

      if (Array.isArray(mappingRows) && mappingRows.length > 0) {
        hydrated.mappings = mappingRows.map((row) => {
          const ev = (row.evidence || {}) as Record<string, unknown>;
          return {
            id: typeof ev.appId === "string" ? ev.appId : row.id,
            mappingSetId: mappingSetRow.id,
            sourcePath:
              row.source_path === "(none)" || row.source_path === ""
                ? null
                : row.source_path,
            targetPath: row.target_path,
            status: row.status,
            semanticStatus:
              (ev.semanticStatus as CandidateMapping["semanticStatus"]) ||
              (row.status === "accepted" || row.status === "edited"
                ? "verified"
                : "needs_confirmation"),
            transformation: row.transformation,
            rationale:
              typeof ev.rationale === "string"
                ? ev.rationale
                : `Persisted mapping for ${row.target_path}`,
            uncertaintyScore:
              (row.ai_confidence as CandidateMapping["uncertaintyScore"]) || "MEDIUM",
            uncertaintyExplanation:
              typeof ev.uncertaintyExplanation === "string"
                ? ev.uncertaintyExplanation
                : undefined,
            unresolvedQuestions: Array.isArray(ev.unresolvedQuestions)
              ? (ev.unresolvedQuestions as string[])
              : [],
            provider: (ev.provider as CandidateMapping["provider"]) || "groq",
            modelUsed:
              typeof ev.modelUsed === "string" ? ev.modelUsed : undefined,
            informationLoss: Array.isArray(row.information_loss)
              ? row.information_loss
              : [],
            decisionHistory: Array.isArray(ev.decisionHistory)
              ? (ev.decisionHistory as CandidateMapping["decisionHistory"])
              : [],
          } as CandidateMapping;
        });
      }

      // Hydrate latest transformation plan
      const { data: planRow } = await supabase
        .from("transformation_plans")
        .select("*")
        .eq("mapping_set_id", mappingSetRow.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const planPayload = planRow?.plan_json ?? planRow?.plan;
      if (planPayload) {
        hydrated.plan = planPayload;
        const code = generateTypeScriptAdapter(planPayload);
        hydrated.adapter = {
          code,
          language: "ts",
          generatedAt: planRow.created_at || new Date().toISOString(),
        };
        if (hydrated.specs.target && hydrated.diff) {
          hydrated.testSuiteResult = verifyAdapterEquivalence(
            planPayload,
            hydrated.specs.target.normalized,
            CANONICAL_TEST_FIXTURES
          );
          if (hydrated.specs.source) {
            // Restore persisted compatibility report + Azure cloudEvidence if saved
            const { data: repRow } = await supabase
              .from("compatibility_reports")
              .select("*")
              .eq("mapping_set_id", mappingSetRow.id)
              .order("exported_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (repRow?.summary && repRow?.report_text_markdown) {
              hydrated.report = {
                data: repRow.summary as ProjectState["report"] extends { data: infer D } ? D : never,
                markdown: repRow.report_text_markdown as string,
              };
            } else {
              const assembled = assembleCompatibilityReport(
                projectId,
                hydrated.specs.source.normalized,
                hydrated.specs.target.normalized,
                hydrated.diff,
                hydrated.mappings,
                hydrated.plan || null,
                hydrated.testSuiteResult || null,
                code
              );
              hydrated.report = {
                data: assembled.reportData,
                markdown: assembled.markdown,
              };
            }
          }
        }
      }
    }

    return projectStore.hydrateState(hydrated);
  } catch (err) {
    if (err instanceof Error && err.message.includes("FORBIDDEN")) throw err;
    return local;
  }
}

export async function persistProjectCreate(project: Project, user: AuthUser) {
  if (!canUseSupabaseDb(user) || !UUID_REGEX.test(project.id)) return;
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return;
    await supabase.from("projects").upsert({
      id: project.id,
      owner_id: user.id,
      name: project.name,
      description: project.description,
      created_at: project.created_at,
      updated_at: project.updated_at,
    });
  } catch {
    // Non-blocking fallback
  }
}

export async function persistProjectUpdate(project: Project, user: AuthUser) {
  if (!canUseSupabaseDb(user) || !UUID_REGEX.test(project.id)) return;
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return;
    await supabase
      .from("projects")
      .update({
        name: project.name,
        description: project.description,
        updated_at: project.updated_at,
      })
      .eq("id", project.id)
      .eq("owner_id", user.id);
  } catch {
    // Non-blocking
  }
}

export async function persistProjectDelete(projectId: string, user: AuthUser) {
  if (!canUseSupabaseDb(user) || !UUID_REGEX.test(projectId)) return;
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return;
    await supabase
      .from("projects")
      .delete()
      .eq("id", projectId)
      .eq("owner_id", user.id);
  } catch {
    // Non-blocking
  }
}

export async function persistProjectSpec(
  state: ProjectState,
  side: "source" | "target",
  user: AuthUser
) {
  if (!canUseSupabaseDb(user) || !UUID_REGEX.test(state.project.id)) return;
  const specEntry = state.specs[side];
  if (!specEntry) return;
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return;

    await supabase
      .from("specs")
      .delete()
      .eq("project_id", state.project.id)
      .eq("side", side);

    await supabase.from("specs").insert({
      id: UUID_REGEX.test(specEntry.spec.id)
        ? specEntry.spec.id
        : crypto.randomUUID(),
      project_id: state.project.id,
      side,
      name: specEntry.spec.name,
      content_type: specEntry.spec.content_type,
      content_hash: specEntry.spec.content_hash,
      raw_content: specEntry.spec.raw_content,
      normalized: specEntry.spec.normalized,
      spec_version: specEntry.spec.spec_version,
      file_size_bytes: specEntry.spec.file_size_bytes,
    });
  } catch {
    // Non-blocking
  }
}

export async function persistProjectMappings(
  state: ProjectState,
  user: AuthUser
) {
  if (
    !canUseSupabaseDb(user) ||
    !UUID_REGEX.test(state.project.id) ||
    !state.specs.source ||
    !state.specs.target
  ) {
    return;
  }
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return;

    let mappingSetId = state.mappingSet?.id;
    if (!mappingSetId || !UUID_REGEX.test(mappingSetId)) {
      const { data: existingSet } = await supabase
        .from("mapping_sets")
        .select("id")
        .eq("project_id", state.project.id)
        .limit(1)
        .maybeSingle();
      mappingSetId = existingSet?.id;
    }

    if (!mappingSetId) {
      const newSetId = crypto.randomUUID();
      const { error: setErr } = await supabase.from("mapping_sets").insert({
        id: newSetId,
        project_id: state.project.id,
        source_spec_id: state.specs.source.spec.id,
        target_spec_id: state.specs.target.spec.id,
        status: "draft",
      });
      if (!setErr) mappingSetId = newSetId;
    }

    if (!mappingSetId) return;

    await supabase.from("mappings").delete().eq("mapping_set_id", mappingSetId);

    if (state.mappings.length > 0) {
      await supabase.from("mappings").insert(
        state.mappings.map((m) => ({
          mapping_set_id: mappingSetId,
          source_path: m.sourcePath || "(none)",
          target_path: m.targetPath,
          status: m.status,
          transformation: m.transformation,
          information_loss: m.informationLoss || [],
          ai_confidence: m.uncertaintyScore,
          evidence: {
            appId: m.id,
            rationale: m.rationale,
            semanticStatus: m.semanticStatus,
            uncertaintyScore: m.uncertaintyScore,
            uncertaintyExplanation: m.uncertaintyExplanation,
            unresolvedQuestions: m.unresolvedQuestions,
            provider: m.provider,
            modelUsed: m.modelUsed,
            decisionHistory: m.decisionHistory,
          },
        }))
      );
    }
  } catch {
    // Non-blocking
  }
}

export async function persistProjectPlan(
  state: ProjectState,
  user: AuthUser
) {
  if (
    !canUseSupabaseDb(user) ||
    !UUID_REGEX.test(state.project.id) ||
    !state.plan
  ) {
    return;
  }
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return;

    const { data: setRow } = await supabase
      .from("mapping_sets")
      .select("id")
      .eq("project_id", state.project.id)
      .limit(1)
      .maybeSingle();

    if (!setRow?.id) return;

    const planHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(state.plan))
      .digest("hex");

    await supabase.from("transformation_plans").insert({
      project_id: state.project.id,
      mapping_set_id: setRow.id,
      plan_json: state.plan,
      plan_hash: planHash,
      status: "compiled",
    });
  } catch {
    // Non-blocking
  }
}

export async function persistProjectReport(
  state: ProjectState,
  user: AuthUser
) {
  if (
    !canUseSupabaseDb(user) ||
    !UUID_REGEX.test(state.project.id) ||
    !state.report
  ) {
    return;
  }
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return;

    const { data: setRow } = await supabase
      .from("mapping_sets")
      .select("id")
      .eq("project_id", state.project.id)
      .limit(1)
      .maybeSingle();

    if (!setRow?.id) return;

    await supabase.from("compatibility_reports").insert({
      mapping_set_id: setRow.id,
      summary: state.report.data,
      report_text_markdown: state.report.markdown,
      artifact_ref:
        state.report.data.cloudEvidence?.azureSqlRunId ||
        state.report.data.cloudEvidence?.azureBlobReportJsonUrl ||
        null,
    });
  } catch {
    // Non-blocking
  }
}
