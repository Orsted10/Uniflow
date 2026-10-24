import { Project, Spec, MappingSet } from "../supabase/models";
import { CandidateMapping } from "../mapping/types";
import { TransformationPlan } from "../transformation/ir";
import { NormalizedSchema, StructuralDiff } from "../specs/types";
import { EquivalenceTestSuiteResult } from "../transformation/equivalence";
import { CompatibilityReportData } from "../reports/assemble";

export type ProjectState = {
  project: Project;
  specs: {
    source?: {
      spec: Spec;
      normalized: NormalizedSchema;
    };
    target?: {
      spec: Spec;
      normalized: NormalizedSchema;
    };
  };
  diff?: StructuralDiff;
  mappingSet?: MappingSet;
  mappings: CandidateMapping[];
  plan?: TransformationPlan;
  adapter?: {
    code: string;
    language: "ts";
    generatedAt: string;
  };
  testSuiteResult?: EquivalenceTestSuiteResult;
  report?: {
    data: CompatibilityReportData;
    markdown: string;
  };
};

class InMemoryProjectStore {
  private projects = new Map<string, ProjectState>();

  createProject(ownerId: string, name: string, description?: string): Project {
    const id = `proj-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const project: Project = {
      id,
      owner_id: ownerId,
      name,
      description: description || null,
      created_at: now,
      updated_at: now,
    };

    this.projects.set(id, {
      project,
      specs: {},
      mappings: [],
    });

    return project;
  }

  listProjects(ownerId: string): Project[] {
    const list: Project[] = [];
    for (const state of this.projects.values()) {
      if (state.project.owner_id === ownerId) {
        list.push(state.project);
      }
    }
    return list;
  }

  getProjectState(projectId: string, ownerId: string): ProjectState | null {
    const state = this.projects.get(projectId);
    if (!state) return null;
    if (state.project.owner_id !== ownerId) {
      throw new Error("FORBIDDEN: User does not own this project.");
    }
    return state;
  }

  renameProject(
    projectId: string,
    ownerId: string,
    name: string,
    description?: string
  ): Project {
    const state = this.getProjectState(projectId, ownerId);
    if (!state) throw new Error("Project not found");

    state.project.name = name.trim();
    if (description !== undefined) {
      state.project.description = description.trim() || null;
    }
    state.project.updated_at = new Date().toISOString();
    return state.project;
  }

  deleteProject(
    projectId: string,
    ownerId: string
  ): { success: boolean; cleanedUpChildCount: number } {
    const state = this.getProjectState(projectId, ownerId);
    if (!state) throw new Error("Project not found");

    // Safe deletion: verify no orphaned external blob artifacts
    const hasExternalBlobs = Object.values(state.specs).some(
      (s) => s?.spec.artifact_ref || s?.spec.blob_reference
    );
    if (hasExternalBlobs) {
      // In live cloud deployment, blob objects would be queued for Azure Blob deletion here
    }

    const cleanedUpChildCount =
      (state.specs.source ? 1 : 0) +
      (state.specs.target ? 1 : 0) +
      state.mappings.length +
      (state.plan ? 1 : 0) +
      (state.report ? 1 : 0);

    this.projects.delete(projectId);
    return { success: true, cleanedUpChildCount };
  }

  setSpec(
    projectId: string,
    ownerId: string,
    side: "source" | "target",
    name: string,
    contentType: "openapi+json" | "json-schema" | "sample+json",
    normalized: NormalizedSchema,
    fileSizeBytes: number,
    rawContent?: string,
    contentHash?: string
  ): { spec: Spec; replaced: boolean; invalidatedDownstream: boolean } {
    const state = this.getProjectState(projectId, ownerId);
    if (!state) throw new Error("Project not found");

    const existingSpec = state.specs[side]?.spec;
    const computedHash = contentHash || `sha256-${Date.now()}`;
    const replaced = Boolean(existingSpec);
    const hashChanged = !existingSpec || existingSpec.content_hash !== computedHash;

    const specId = existingSpec ? existingSpec.id : `spec-${side}-${Date.now()}`;
    const now = new Date().toISOString();

    const spec: Spec = {
      id: specId,
      project_id: projectId,
      side,
      name,
      content_type: contentType,
      content_hash: computedHash,
      raw_content: rawContent || null,
      normalized,
      spec_version: normalized.version,
      artifact_ref: null,
      file_size_bytes: fileSizeBytes,
      created_at: existingSpec ? existingSpec.created_at : now,
    };

    if (side === "source") {
      state.specs.source = { spec, normalized };
    } else {
      state.specs.target = { spec, normalized };
    }

    // Invalidate dependent mapping state if contract changed
    let invalidatedDownstream = false;
    if (replaced && hashChanged) {
      invalidatedDownstream = true;
      state.plan = undefined;
      state.adapter = undefined;
      state.testSuiteResult = undefined;
      state.report = undefined;

      // Invalidate any previously accepted/edited mappings to require re-confirmation
      if (state.mappings && state.mappings.length > 0) {
        state.mappings = state.mappings.map((m) => ({
          ...m,
          status: "needs_confirmation",
          semantic_status: "needs_confirmation",
          decisionHistory: [
            ...m.decisionHistory,
            {
              action: "needs_confirmation",
              timestamp: now,
              actor: ownerId,
              note: `Contract '${side}' replaced with new hash ${computedHash.slice(0, 10)}. Re-confirmation required.`,
            },
          ],
        }));
      }
    }

    state.project.updated_at = now;
    return { spec, replaced, invalidatedDownstream };
  }

  setDiff(projectId: string, ownerId: string, diff: StructuralDiff): void {
    const state = this.getProjectState(projectId, ownerId);
    if (!state) throw new Error("Project not found");
    state.diff = diff;
  }

  setMappings(projectId: string, ownerId: string, mappings: CandidateMapping[]): void {
    const state = this.getProjectState(projectId, ownerId);
    if (!state) throw new Error("Project not found");
    state.mappings = mappings;
  }

  addMapping(
    projectId: string,
    ownerId: string,
    mapping: CandidateMapping
  ): CandidateMapping {
    const state = this.getProjectState(projectId, ownerId);
    if (!state) throw new Error("Project not found");
    const idx = state.mappings.findIndex((m) => m.targetPath === mapping.targetPath);
    if (idx !== -1) {
      state.mappings[idx] = mapping;
    } else {
      state.mappings.push(mapping);
    }
    return mapping;
  }

  updateMapping(
    projectId: string,
    ownerId: string,
    mappingId: string,
    update: Partial<CandidateMapping>
  ): CandidateMapping {
    const state = this.getProjectState(projectId, ownerId);
    if (!state) throw new Error("Project not found");

    const idx = state.mappings.findIndex((m) => m.id === mappingId);
    if (idx === -1) throw new Error(`Mapping '${mappingId}' not found.`);

    const existing = state.mappings[idx];
    const updated: CandidateMapping = {
      ...existing,
      ...update,
      decisionHistory: [
        ...existing.decisionHistory,
        {
          action: update.status || existing.status,
          timestamp: new Date().toISOString(),
          actor: ownerId,
          note: `Status updated to ${update.status || existing.status}`,
        },
      ],
    };

    state.mappings[idx] = updated;
    return updated;
  }

  setPlan(projectId: string, ownerId: string, plan: TransformationPlan): void {
    const state = this.getProjectState(projectId, ownerId);
    if (!state) throw new Error("Project not found");
    state.plan = plan;
  }

  setAdapter(projectId: string, ownerId: string, code: string): void {
    const state = this.getProjectState(projectId, ownerId);
    if (!state) throw new Error("Project not found");
    state.adapter = {
      code,
      language: "ts",
      generatedAt: new Date().toISOString(),
    };
  }

  setExecutionResults(
    projectId: string,
    ownerId: string,
    testSuiteResult: EquivalenceTestSuiteResult
  ): void {
    const state = this.getProjectState(projectId, ownerId);
    if (!state) throw new Error("Project not found");
    state.testSuiteResult = testSuiteResult;
  }

  setReport(
    projectId: string,
    ownerId: string,
    data: CompatibilityReportData,
    markdown: string
  ): void {
    const state = this.getProjectState(projectId, ownerId);
    if (!state) throw new Error("Project not found");
    state.report = { data, markdown };
  }
}

// Global singleton across hot reloads in Next.js development
const globalForStore = globalThis as unknown as {
  projectStore?: InMemoryProjectStore;
};

export const projectStore = globalForStore.projectStore ?? new InMemoryProjectStore();

if (process.env.NODE_ENV !== "production") {
  globalForStore.projectStore = projectStore;
}
