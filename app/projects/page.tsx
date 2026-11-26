"use client";

import * as React from "react";
import Link from "next/link";
import { TopBar } from "@/components/shell/topbar";
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
    <div className="min-h-screen bg-[#050507] text-[#f5f5f7] flex flex-col font-sans">
      <TopBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Workspaces", current: true }]} className="mb-5" />

        {errorMsg && (
          <ErrorPanel message={errorMsg} onDismiss={() => setErrorMsg(null)} className="mb-5" />
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7 pb-5 border-b border-white/[0.07]">
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-[-0.025em]">Workspaces</h1>
            <p className="text-xs text-zinc-400 mt-1">
              PostgreSQL system of record with tenant isolation and cryptographic verification.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search workspaces..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs border border-white/[0.1] rounded-full px-4 py-1.5 w-48 sm:w-64 bg-white/[0.04] text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-white/30"
            />
            <Link
              href="/projects/new"
              className="inline-flex items-center text-xs font-semibold px-4 py-2 rounded-full bg-white text-black hover:bg-zinc-200 transition"
            >
              New Workspace
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="apple-glass rounded-2xl p-10 text-center text-xs text-zinc-400">
            Loading workspaces...
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No workspaces found"
            description={
              search
                ? `No workspaces matching "${search}". Try adjusting your search query.`
                : "No API compatibility workspaces created yet. Start by creating a workspace."
            }
            action={{
              label: "Create First Workspace",
              href: "/projects/new",
            }}
          />
        ) : (
          <div className="apple-glass rounded-2xl overflow-hidden divide-y divide-white/[0.06]">
            {filtered.map((proj) => (
              <div
                key={proj.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.025] transition"
              >
                <div className="space-y-1 max-w-xl">
                  {renamingId === proj.id ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="text-xs border border-white/30 rounded-lg px-2.5 py-1 bg-black/50 text-white font-medium focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleRename(proj.id)}
                        className="text-xs bg-white text-black px-3 py-1 rounded-full font-semibold hover:bg-zinc-200"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingId(null)}
                        className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2.5">
                      <Link
                        href={`/projects/${proj.id}`}
                        className="text-sm font-medium text-white hover:text-zinc-300 transition tracking-tight"
                      >
                        {proj.name}
                      </Link>
                      <span className="font-mono text-[10px] text-zinc-500 bg-white/[0.04] px-2 py-0.5 rounded-full border border-white/[0.07]">
                        {proj.id}
                      </span>
                    </div>
                  )}

                  <p className="text-xs text-zinc-400 line-clamp-1">
                    {proj.description || "API Compatibility Verification Workspace"}
                  </p>
                </div>

                <div className="flex items-center space-x-3 text-xs shrink-0">
                  <span className="font-mono text-[11px] text-zinc-500">
                    {new Date(proj.updated_at).toLocaleDateString()}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(proj.id);
                      setRenameValue(proj.name);
                    }}
                    className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded transition"
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
                    className="inline-flex items-center text-xs font-medium text-zinc-100 hover:text-white border border-white/[0.12] bg-white/[0.06] hover:bg-white/[0.12] px-3.5 py-1.5 rounded-full transition"
                  >
                    Open →
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
