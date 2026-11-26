import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
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

const SNAPSHOT_FILE = path.join(os.tmpdir(), "uniflow-project-store-v1.json");

class InMemoryProjectStore {
  private projects = new Map<string, ProjectState>();
  private loadedFromDisk = false;

  private ensureDiskLoaded() {
    if (this.loadedFromDisk) return;
    this.loadedFromDisk = true;
    try {
      if (fs.existsSync(SNAPSHOT_FILE)) {
        const raw = fs.readFileSync(SNAPSHOT_FILE, "utf8");
        const entries = JSON.parse(raw) as Array<[string, ProjectState]>;
        if (Array.isArray(entries)) {
          for (const [id, st] of entries) {
            if (st?.project?.id && !this.projects.has(id)) {
              this.projects.set(id, st);
            }
          }
        }
      }
    } catch {
      // Non-fatal in read-only or test environments
    }
  }

  private saveDiskSnapshot() {
    try {
      const entries = Array.from(this.projects.entries());
      fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(entries), "utf8");
    } catch {
      // Non-fatal on read-only file systems
    }
  }

  createProject(ownerId: string, name: string, description?: string): Project {
    this.ensureDiskLoaded();
    const id = crypto.randomUUID();
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
    this.saveDiskSnapshot();

    return project;
  }

  hydrateState(state: ProjectState): ProjectState {
    this.ensureDiskLoaded();
    this.projects.set(state.project.id, state);
    this.saveDiskSnapshot();
    return state;
  }

  listProjects(ownerId: string): Project[] {
    this.ensureDiskLoaded();
    const list: Project[] = [];
    for (const state of this.projects.values()) {
      if (state.project.owner_id === ownerId) {
        list.push(state.project);
      }
    }
    return list;
  }

  getProjectState(projectId: string, ownerId: string): ProjectState | null {
    this.ensureDiskLoaded();
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
    this.saveDiskSnapshot();
    return state.project;
  }

  deleteProject(
    projectId: string,
    ownerId: string
  ): { success: boolean; cleanedUpChildCount: number } {
    const state = this.getProjectState(projectId, ownerId);
    if (!state) throw new Error("Project not found");

    const cleanedUpChildCount =
      (state.specs.source ? 1 : 0) +
      (state.specs.target ? 1 : 0) +
      state.mappings.length +
      (state.plan ? 1 : 0) +
      (state.report ? 1 : 0);

    this.projects.delete(projectId);
    this.saveDiskSnapshot();
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

    const specId = existingSpec ? existingSpec.id : crypto.randomUUID();
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

    let invalidatedDownstream = false;
    if (replaced && hashChanged) {
      invalidatedDownstream = true;
      state.plan = undefined;
      state.adapter = undefined;
      state.testSuiteResult = undefined;
      state.report = undefined;

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
    this.saveDiskSnapshot();
    return { spec, replaced, invalidatedDownstream };
  }

  setDiff(projectId: string, ownerId: string, diff: StructuralDiff): void {
    const state = this.getProjectState(projectId, ownerId);
    if (!state) throw new Error("Project not found");
    state.diff = diff;
    this.saveDiskSnapshot();
  }

  setMappings(projectId: string, ownerId: string, mappings: CandidateMapping[]): void {
    const state = this.getProjectState(projectId, ownerId);
    if (!state) throw new Error("Project not found");
    state.mappings = mappings;
    this.saveDiskSnapshot();
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
    this.saveDiskSnapshot();
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
      decisionHistory: update.decisionHistory ?? [
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
    this.saveDiskSnapshot();
    return updated;
  }

  setPlan(projectId: string, ownerId: string, plan: TransformationPlan): void {
    const state = this.getProjectState(projectId, ownerId);
    if (!state) throw new Error("Project not found");
    state.plan = plan;
    this.saveDiskSnapshot();
  }

  setAdapter(projectId: string, ownerId: string, code: string): void {
    const state = this.getProjectState(projectId, ownerId);
    if (!state) throw new Error("Project not found");
    state.adapter = {
      code,
      language: "ts",
      generatedAt: new Date().toISOString(),
    };
    this.saveDiskSnapshot();
  }

  setExecutionResults(
    projectId: string,
    ownerId: string,
    testSuiteResult: EquivalenceTestSuiteResult
  ): void {
    const state = this.getProjectState(projectId, ownerId);
    if (!state) throw new Error("Project not found");
    state.testSuiteResult = testSuiteResult;
    this.saveDiskSnapshot();
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
    this.saveDiskSnapshot();
  }
}

const globalForStore = globalThis as unknown as {
  projectStore?: InMemoryProjectStore;
};

export const projectStore = globalForStore.projectStore ?? new InMemoryProjectStore();
globalForStore.projectStore = projectStore;
