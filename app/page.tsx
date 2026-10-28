"use client";

import * as React from "react";
import Link from "next/link";
import { TopBar } from "@/components/shell/topbar";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { Project } from "@/lib/supabase/models";
import { DEMO_PROJECTS } from "@/lib/fixtures/mock-projects";

export default function DashboardPage() {
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isFixtureData, setIsFixtureData] = React.useState(false);

  React.useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch("/api/projects");
        const data = await res.json();
        if (data.projects && Array.isArray(data.projects) && data.projects.length > 0) {
          setProjects(data.projects);
          setIsFixtureData(false);
        } else {
          // Explicitly fallback to named demo fixtures for Phase 1 UI showcase
          setProjects(DEMO_PROJECTS);
          setIsFixtureData(true);
        }
      } catch {
        setProjects(DEMO_PROJECTS);
        setIsFixtureData(true);
      } finally {
        setLoading(false);
      }
    }

    loadProjects();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <TopBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 space-y-8">
        {/* Header / Workflow Overview */}
        <section aria-labelledby="dashboard-overview-heading" className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
            <div className="space-y-2 max-w-3xl">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">
                  UNIFLOW ∞
                </span>
                <span className="text-xs text-slate-500">API Compatibility Compiler</span>
              </div>
              <h1 id="dashboard-overview-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Deterministic API contract compatibility, validation, and adapter generation.
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Compare OpenAPI 3.x and JSON Schema specifications, inspect structural differences, review AI-assisted mapping proposals with mandatory human approvals, compile verified Transformation IR plans, and export standalone TypeScript adapters with full evidence reports.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <Link
                href="/projects/new"
                className="inline-flex items-center justify-center text-xs font-semibold px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                + Create Project
              </Link>
              <Link
                href="/projects"
                className="inline-flex items-center justify-center text-xs font-medium px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                Browse Projects
              </Link>
            </div>
          </div>

          {/* Core Workflow Stages Grid */}
          <div className="pt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
              Compiler Pipeline Architecture
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="border border-slate-200 rounded p-4 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[11px] font-bold text-slate-700">01. Ingestion</span>
                  <StatusChip variant="info" label="Safe Limits" />
                </div>
                <h3 className="text-xs font-semibold text-slate-900 mb-1">Contract Ingestion & Safety</h3>
                <p className="text-[11px] text-slate-600 leading-normal">
                  Ingests OpenAPI 3.x and JSON Schema specs under strict guardrails: 1 MiB payload ceiling, max recursion depth of 64, and circular reference protection.
                </p>
              </div>

              <div className="border border-slate-200 rounded p-4 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[11px] font-bold text-slate-700">02. Diff</span>
                  <StatusChip variant="neutral" label="Deterministic" />
                </div>
                <h3 className="text-xs font-semibold text-slate-900 mb-1">Structural Difference Engine</h3>
                <p className="text-[11px] text-slate-600 leading-normal">
                  Flattens contracts into standardized path property trees (`$[&quot;field&quot;]`), detecting identical matches, renamed fields, type conflicts, and enum mismatches.
                </p>
              </div>

              <div className="border border-slate-200 rounded p-4 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[11px] font-bold text-slate-700">03. Review</span>
                  <StatusChip variant="needs_confirmation" label="Human Gate" />
                </div>
                <h3 className="text-xs font-semibold text-slate-900 mb-1">Human-in-the-Loop Mapping</h3>
                <p className="text-[11px] text-slate-600 leading-normal">
                  AI proposes candidates; deterministic rules classify confidence. High-risk, ambiguous, or enum transforms strictly require developer acceptance before compilation.
                </p>
              </div>

              <div className="border border-slate-200 rounded p-4 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[11px] font-bold text-slate-700">04. Compiler</span>
                  <StatusChip variant="compiled" label="Zero Eval" />
                </div>
                <h3 className="text-xs font-semibold text-slate-900 mb-1">Transformation IR Compiler</h3>
                <p className="text-[11px] text-slate-600 leading-normal">
                  Compiles approved mappings into a constrained JSON Transformation IR plan. Zero dynamic eval or code injection—only allowlisted primitives.
                </p>
              </div>

              <div className="border border-slate-200 rounded p-4 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[11px] font-bold text-slate-700">05. Verify</span>
                  <StatusChip variant="neutral" label="Runtime & TS" />
                </div>
                <h3 className="text-xs font-semibold text-slate-900 mb-1">Interpreter & Adapter Code</h3>
                <p className="text-[11px] text-slate-600 leading-normal">
                  Executes the IR plan deterministically, verifies output against target schema constraints, and emits a pure TypeScript adapter function with equivalence testing.
                </p>
              </div>

              <div className="border border-slate-200 rounded p-4 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[11px] font-bold text-slate-700">06. Audit</span>
                  <StatusChip variant="executed" label="Audit Trail" />
                </div>
                <h3 className="text-xs font-semibold text-slate-900 mb-1">Evidence-Backed Report</h3>
                <p className="text-[11px] text-slate-600 leading-normal">
                  Generates an exportable Markdown and JSON compatibility report containing diff matrices, equivalence test results, target validation diagnostics, and audit logs.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Projects Section */}
        <section aria-labelledby="workspace-projects-heading" className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h2 id="workspace-projects-heading" className="text-base font-bold text-slate-900 tracking-tight">
                  Workspace Projects
                </h2>
                {isFixtureData && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                    Phase 1 Demo Fixtures
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage your contract compatibility workspaces or launch a new compiler run.
              </p>
            </div>

            <Link
              href="/projects/new"
              className="inline-flex items-center self-start sm:self-auto text-xs font-medium px-3.5 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-800 transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              + Create Project
            </Link>
          </div>

          <div className="pt-4">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full rounded" />
                <Skeleton className="h-14 w-full rounded" />
              </div>
            ) : projects.length === 0 ? (
              <EmptyState
                title="No projects in this workspace"
                description="Get started by creating your first project to compare source and target contracts, or preload the canonical e-commerce contract pair."
                action={{
                  label: "+ Create First Project",
                  href: "/projects/new",
                }}
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {projects.map((proj) => (
                  <div
                    key={proj.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 -mx-2 px-2 rounded transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/projects/${proj.id}`}
                          className="font-medium text-xs sm:text-sm text-slate-900 hover:text-teal-700 hover:underline transition"
                        >
                          {proj.name}
                        </Link>
                        <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                          {proj.id}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1">
                        {proj.description || "No description provided."}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500 shrink-0">
                      <span className="text-[11px] text-slate-400">
                        Updated {new Date(proj.updated_at).toLocaleDateString()}
                      </span>
                      <Link
                        href={`/projects/${proj.id}`}
                        className="inline-flex items-center font-medium text-slate-700 hover:text-slate-900 text-xs px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 transition shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                      >
                        Open Workspace →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* System & Architecture Boundaries (Honest Transparency) */}
        <section aria-labelledby="architecture-boundaries-heading" className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs">
          <h2 id="architecture-boundaries-heading" className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Service Boundaries & Security Controls
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-3.5 border border-slate-200 rounded bg-slate-50/50">
              <span className="font-bold text-slate-800 block mb-1">Supabase PostgreSQL</span>
              <p className="text-[11px] text-slate-600 leading-normal">
                Single system of record for user ownership, project records, normalized schema ASTs, approved mappings, and report metadata.
              </p>
            </div>

            <div className="p-3.5 border border-slate-200 rounded bg-slate-50/50">
              <span className="font-bold text-slate-800 block mb-1">Azure SQL Database</span>
              <p className="text-[11px] text-slate-600 leading-normal">
                Dedicated append-only execution evidence store (`compatibility_runs`, `run_results`, `audit_records`). Not a secondary source of truth.
              </p>
            </div>

            <div className="p-3.5 border border-slate-200 rounded bg-slate-50/50">
              <span className="font-bold text-slate-800 block mb-1">Azure Blob Storage</span>
              <p className="text-[11px] text-slate-600 leading-normal">
                Private, isolated storage container for raw imported contract files and generated compatibility report artifacts.
              </p>
            </div>

            <div className="p-3.5 border border-slate-200 rounded bg-slate-50/50">
              <span className="font-bold text-slate-800 block mb-1">Groq LLM Engine</span>
              <p className="text-[11px] text-slate-600 leading-normal">
                Advisory candidate mapping generator only. Does not compile executable code or bypass human approval gates.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        UNIFLOW ∞ — API Compatibility Compiler &bull; Phase 1 Foundation
      </footer>
    </div>
  );
}
