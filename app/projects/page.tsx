"use client";

import * as React from "react";
import Link from "next/link";
import { TopBar } from "@/components/shell/topbar";
import { HeroBackdrop } from "@/components/ui/hero-backdrop";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorPanel } from "@/components/ui/error-panel";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Project } from "@/lib/supabase/models";

export default function ProjectsListPage() {
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState("");

  const [projectToDelete, setProjectToDelete] = React.useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (data.projects && Array.isArray(data.projects)) {
        setProjects(data.projects);
      } else {
        setProjects([]);
      }
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleRename(projectId: string) {
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }

    const previousProjects = [...projects];
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, name: renameValue.trim() } : p))
    );
    setRenamingId(null);

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to rename project.");
      }
    } catch (err: unknown) {
      setProjects(previousProjects);
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDelete() {
    if (!projectToDelete) return;

    const target = projectToDelete;
    const previousProjects = [...projects];

    setProjects((prev) => prev.filter((p) => p.id !== target.id));
    setProjectToDelete(null);
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/projects/${target.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete project.");
      }
    } catch (err: unknown) {
      setProjects(previousProjects);
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDeleting(false);
    }
  }

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#090807] text-[#f5f2eb] flex flex-col font-sans relative overflow-x-hidden">
      <HeroBackdrop />
      <TopBar />

      <main className="relative z-10 max-w-[1680px] mx-auto px-6 sm:px-10 lg:px-12 py-10 w-full flex-1 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Breadcrumb
            items={[
              { label: "Overview", href: "/" },
              { label: "Workspaces", current: true },
            ]}
          />
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/[0.14] text-xs font-mono text-zinc-200">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
            <span>CERT-In &bull; DPDP Act 2023 &bull; PostgreSQL RLS</span>
          </div>
        </div>

        {errorMsg && (
          <ErrorPanel message={errorMsg} onDismiss={() => setErrorMsg(null)} />
        )}

        {/* Editorial Hero Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-white/[0.1]">
          <div className="space-y-3">
            <h1 className="font-editorial text-[48px] sm:text-[58px] font-normal tracking-[-0.025em] text-[#fdfaf5] leading-[1.02] drop-shadow-[0_4px_24px_rgba(0,0,0,0.75)]">
              Your active{" "}
              <span className="relative inline-block">
                <span className="font-brush text-[56px] sm:text-[66px] text-[#f4845f] font-bold tracking-normal leading-none pr-1">
                  workspaces.
                </span>
                <svg
                  viewBox="0 0 180 14"
                  fill="none"
                  aria-hidden="true"
                  className="absolute -bottom-1 left-0 w-full h-3.5 text-[#f4845f]/90"
                >
                  <path
                    d="M3 10.5C45 4.2 118 2.8 176 7.5"
                    stroke="currentColor"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>
            <p className="text-base sm:text-lg text-[#ebe3d8] max-w-2xl leading-relaxed">
              PostgreSQL system of record with strict tenant isolation, SHA-256 contract digests, and zero-eval adapter compilation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3.5">
            <div className="relative">
              <input
                type="text"
                placeholder="Search workspaces..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-sm border border-white/[0.14] rounded-full px-5 py-3 w-64 sm:w-72 bg-black/55 backdrop-blur-md text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#f5dfb8]/60"
              />
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium px-5 py-3 rounded-full border border-white/[0.16] bg-black/45 hover:bg-white/[0.1] text-zinc-100 backdrop-blur-md transition"
            >
              ← Overview
            </Link>
            <Link
              href="/projects/new"
              className="champagne-pill inline-flex items-center gap-2 text-sm sm:text-[15px] font-semibold px-7 py-3 rounded-full transition"
            >
              + New Workspace
            </Link>
          </div>
        </div>

        {/* Telemetry & Security Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="apple-glass rounded-2xl px-5 py-4 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-300 text-lg shrink-0">
              ⚡
            </div>
            <div>
              <div className="text-sm font-semibold text-white">
                {projects.length} {projects.length === 1 ? "Workspace" : "Workspaces"} Active
              </div>
              <div className="text-xs text-zinc-400">Live Supabase PostgreSQL ledger</div>
            </div>
          </div>

          <div className="apple-glass rounded-2xl px-5 py-4 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-teal-500/15 border border-teal-400/30 flex items-center justify-center text-teal-300 text-lg shrink-0">
              ✓
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Zero-Eval Sandboxed IR</div>
              <div className="text-xs text-zinc-400">1 MiB limit &bull; SSRF remote-ref guard</div>
            </div>
          </div>

          <div className="apple-glass rounded-2xl px-5 py-4 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-violet-500/15 border border-violet-400/30 flex items-center justify-center text-violet-300 text-lg shrink-0">
              🛡
            </div>
            <div>
              <div className="text-sm font-semibold text-white">India Security Protocol</div>
              <div className="text-xs text-zinc-400">CERT-In &bull; DPDP Act 2023 &bull; HSTS + CSP</div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="apple-glass rounded-3xl p-12 space-y-4">
            <div className="h-14 bg-white/[0.05] rounded-2xl animate-pulse" />
            <div className="h-14 bg-white/[0.04] rounded-2xl animate-pulse" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No workspaces found"
            description={
              search
                ? `No workspaces matching "${search}". Try adjusting your search query.`
                : "No API compatibility workspaces created yet. Initialize one with a single click to start diffing specs, proposing Groq AI mappings, and compiling zero-eval TypeScript adapters."
            }
            action={{
              label: "Create First Workspace",
              href: "/projects/new",
            }}
          />
        ) : (
          <div className="apple-glass rounded-3xl overflow-hidden divide-y divide-white/[0.08]">
            {filtered.map((proj, idx) => (
              <div
                key={proj.id}
                className="p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-5 hover:bg-white/[0.03] transition group"
              >
                <div className="flex items-start sm:items-center gap-4 min-w-0 max-w-2xl">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-mono shrink-0 border transition-transform duration-200 group-hover:scale-105 ${
                      idx % 3 === 0
                        ? "bg-teal-500/15 border-teal-400/30 text-teal-300"
                        : idx % 3 === 1
                        ? "bg-violet-500/15 border-violet-400/30 text-violet-300"
                        : "bg-amber-500/15 border-amber-400/30 text-amber-300"
                    }`}
                  >
                    {idx % 3 === 0 ? "↗" : idx % 3 === 1 ? "⚡" : "∿"}
                  </div>

                  <div className="space-y-1.5 min-w-0">
                    {renamingId === proj.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename(proj.id);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          className="text-sm border border-[#f5dfb8]/40 rounded-xl px-3.5 py-1.5 bg-black/60 text-white font-medium focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleRename(proj.id)}
                          className="champagne-pill text-xs px-4 py-1.5 rounded-full font-semibold"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenamingId(null)}
                          className="text-xs text-zinc-400 hover:text-zinc-200 px-2.5 py-1.5"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        <Link
                          href={`/projects/${proj.id}`}
                          className="text-lg font-semibold text-white group-hover:text-[#f5dfb8] transition tracking-tight"
                        >
                          {proj.name}
                        </Link>
                        <span className="font-mono text-xs text-zinc-400 bg-white/[0.05] px-3 py-0.5 rounded-full border border-white/[0.1]">
                          {proj.id}
                        </span>
                      </div>
                    )}

                    <p className="text-sm text-zinc-300 line-clamp-1">
                      {proj.description || "API Compatibility Verification Workspace"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm shrink-0">
                  <span className="font-mono text-xs text-zinc-400 mr-2">
                    {new Date(proj.updated_at).toLocaleDateString()}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(proj.id);
                      setRenameValue(proj.name);
                    }}
                    className="text-xs font-medium text-zinc-300 hover:text-white px-3.5 py-2 rounded-full border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.1] transition"
                  >
                    Rename
                  </button>

                  <button
                    type="button"
                    onClick={() => setProjectToDelete(proj)}
                    className="text-xs font-medium text-rose-300 hover:text-rose-200 px-3.5 py-2 rounded-full border border-rose-500/25 bg-rose-500/10 hover:bg-rose-500/20 transition"
                  >
                    Delete
                  </button>

                  <Link
                    href={`/projects/${proj.id}`}
                    className="champagne-pill inline-flex items-center gap-2 text-sm font-semibold px-5 py-2 rounded-full transition"
                  >
                    Open Studio →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <ConfirmationDialog
        isOpen={Boolean(projectToDelete)}
        title={`Delete "${projectToDelete?.name}"?`}
        description="This will permanently delete the project, imported contract specifications, mapping decisions, compiled transformation plans, and test execution history from PostgreSQL."
        confirmLabel={isDeleting ? "Deleting..." : "Permanently Delete"}
        cancelLabel="Cancel"
        isDestructive
        onConfirm={handleDelete}
        onCancel={() => setProjectToDelete(null)}
      />
    </div>
  );
}
