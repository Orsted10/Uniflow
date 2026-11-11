"use client";

import * as React from "react";
import Link from "next/link";
import { TopBar } from "@/components/shell/topbar";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorPanel } from "@/components/ui/error-panel";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Project } from "@/lib/supabase/models";
import { DEMO_PROJECTS } from "@/lib/fixtures/mock-projects";

export default function ProjectsListPage() {
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Rename state
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState("");

  // Delete dialog state
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
      if (data.projects && Array.isArray(data.projects) && data.projects.length > 0) {
        setProjects(data.projects);
      } else {
        setProjects(DEMO_PROJECTS);
      }
    } catch {
      setProjects(DEMO_PROJECTS);
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
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-white">
      <TopBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Projects", current: true }]} className="mb-4 text-slate-400" />

        {errorMsg && (
          <ErrorPanel message={errorMsg} onDismiss={() => setErrorMsg(null)} className="mb-4" />
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">API Compatibility Workspaces</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              PostgreSQL system of record with tenant isolation and cryptographic verification.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="text"
              placeholder="Search workspaces..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs border border-slate-700 rounded px-3 py-1.5 w-48 sm:w-60 bg-slate-900/80 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500 shadow-sm"
            />
            <Link
              href="/projects/new"
              className="inline-flex items-center text-xs font-semibold font-mono px-3.5 py-1.5 rounded bg-teal-500 text-slate-950 hover:bg-teal-400 transition shadow-sm"
            >
              + Create Workspace
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="border border-slate-800 rounded-md p-8 text-center text-xs text-slate-400 bg-slate-900/40">
            Loading workspace projects...
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No projects found"
            description={
              search
                ? `No projects matching "${search}". Try adjusting your search query.`
                : "No API compatibility projects created yet. Start by creating a project or importing a contract pair."
            }
            action={{
              label: "+ Create First Workspace",
              href: "/projects/new",
            }}
          />
        ) : (
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/80">
            {filtered.map((proj) => (
              <div
                key={proj.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/30 transition"
              >
                <div className="space-y-1 max-w-xl">
                  {renamingId === proj.id ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="text-xs border border-teal-500 rounded px-2 py-1 bg-slate-900 text-white font-medium focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleRename(proj.id)}
                        className="text-xs bg-teal-500 text-slate-950 px-2.5 py-1 rounded font-medium hover:bg-teal-400"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingId(null)}
                        className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Link
                        href={`/projects/${proj.id}`}
                        className="text-sm font-semibold text-white hover:text-teal-400 transition tracking-tight"
                      >
                        {proj.name}
                      </Link>
                      <span className="font-mono text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.2 rounded border border-slate-700/60">
                        {proj.id}
                      </span>
                    </div>
                  )}

                  <p className="text-xs text-slate-400 line-clamp-1">
                    {proj.description || "API Compatibility Verification Workspace"}
                  </p>
                </div>

                <div className="flex items-center space-x-3 text-xs shrink-0">
                  <span className="font-mono text-[11px] text-slate-500">
                    {new Date(proj.updated_at).toLocaleDateString()}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(proj.id);
                      setRenameValue(proj.name);
                    }}
                    className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded transition"
                  >
                    Rename
                  </button>

                  <button
                    type="button"
                    onClick={() => setProjectToDelete(proj)}
                    className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1 rounded transition"
                  >
                    Delete
                  </button>

                  <Link
                    href={`/projects/${proj.id}`}
                    className="inline-flex items-center text-xs font-mono font-medium text-teal-400 hover:text-teal-300 border border-teal-500/30 bg-teal-500/10 px-3 py-1.5 rounded transition"
                  >
                    Open Workbench →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
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
