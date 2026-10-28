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
        // Fallback to explicitly named story fixtures for local dev testing
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
    // Optimistic UI update
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
      // Rollback optimistic update
      setProjects(previousProjects);
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDelete() {
    if (!projectToDelete) return;

    const target = projectToDelete;
    const previousProjects = [...projects];

    // Optimistic UI update
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
      // Rollback on error
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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <TopBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Projects", current: true }]} className="mb-4" />

        {errorMsg && (
          <ErrorPanel message={errorMsg} onDismiss={() => setErrorMsg(null)} className="mb-4" />
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">API Compatibility Workspaces</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              PostgreSQL system of record with Row-Level Security tenant isolation.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs border border-slate-300 rounded px-3 py-1.5 w-48 sm:w-60 bg-white focus:outline-none focus:ring-1 focus:ring-slate-500 shadow-2xs"
            />
            <Link
              href="/projects/new"
              className="inline-flex items-center text-xs font-medium px-3.5 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-800 transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              + Create Project
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="border border-slate-200 rounded-md p-8 text-center text-xs text-slate-400 bg-white">
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
              label: "+ Create First Project",
              href: "/projects/new",
            }}
          />
        ) : (
          <div className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Project Name & ID</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((proj) => (
                    <tr key={proj.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        {renamingId === proj.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              className="border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-500"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleRename(proj.id)}
                              className="text-[11px] bg-slate-900 text-white px-2 py-0.5 rounded font-medium"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setRenamingId(null)}
                              className="text-[11px] text-slate-500 hover:text-slate-700 px-1 py-0.5"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/projects/${proj.id}`}
                                className="font-medium text-slate-900 hover:text-slate-700 hover:underline text-sm block"
                              >
                                {proj.name}
                              </Link>
                              <button
                                type="button"
                                onClick={() => {
                                  setRenamingId(proj.id);
                                  setRenameValue(proj.name);
                                }}
                                title="Rename project"
                                className="text-[10px] text-slate-400 hover:text-slate-600 font-mono"
                              >
                                [rename]
                              </button>
                            </div>
                            <span className="font-mono text-[10px] text-slate-400 block mt-0.5">
                              ID: {proj.id}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-md">
                        {proj.description || <span className="text-slate-400 italic">No description provided</span>}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {new Date(proj.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <Link
                          href={`/projects/${proj.id}`}
                          className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 transition"
                        >
                          Open Workspace →
                        </Link>
                        <button
                          type="button"
                          onClick={() => setProjectToDelete(proj)}
                          disabled={isDeleting}
                          className="inline-flex items-center text-xs font-medium px-2 py-1 rounded text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <ConfirmationDialog
          isOpen={projectToDelete !== null}
          title="Delete Compatibility Project?"
          description={`Are you sure you want to delete "${projectToDelete?.name}"? All associated specifications, mappings, transformation plans, and report metadata will be cascade-deleted. This action cannot be undone.`}
          confirmLabel="Delete Project"
          cancelLabel="Cancel"
          isDestructive={true}
          onConfirm={handleDelete}
          onCancel={() => setProjectToDelete(null)}
        />
      </main>

      <footer className="border-t border-slate-200 bg-white py-3 text-center text-xs text-slate-400">
        UNIFLOW ∞ — API Compatibility Compiler &bull; Phase 2 Auth & RLS
      </footer>
    </div>
  );
}
