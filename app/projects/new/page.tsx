"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shell/topbar";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ErrorPanel } from "@/components/ui/error-panel";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [preloadCanonical, setPreloadCanonical] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Project name is required.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create project.");

      const newId = data.project.id;

      if (preloadCanonical) {
        // Pre-load canonical fixtures into new project
        const { CANONICAL_SOURCE_SPEC, CANONICAL_TARGET_SPEC } = await import("@/lib/specs/fixtures");

        await fetch(`/api/projects/${newId}/specs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            side: "source",
            name: "billing-source-spec.json",
            rawContent: CANONICAL_SOURCE_SPEC,
          }),
        });

        await fetch(`/api/projects/${newId}/specs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            side: "target",
            name: "invoice-target-spec.json",
            rawContent: CANONICAL_TARGET_SPEC,
          }),
        });
      }

      router.push(`/projects/${newId}`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-white">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 w-full flex-1">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Projects", href: "/projects" },
            { label: "New Project", current: true },
          ]}
          className="mb-6 text-slate-400"
        />

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 sm:p-8 shadow-sm">
          <div className="border-b border-slate-800 pb-4 mb-6">
            <h1 className="text-xl font-bold text-white tracking-tight">Create API Compatibility Workspace</h1>
            <p className="text-xs text-slate-400 mt-1">
              Initialize a new comparison workspace for source and target API contracts.
            </p>
          </div>

          {errorMsg && <ErrorPanel message={errorMsg} onDismiss={() => setErrorMsg(null)} className="mb-4" />}

          <form onSubmit={handleSubmit} className="space-y-5 text-xs">
            <div>
              <label htmlFor="projectName" className="block font-medium text-slate-300 mb-1.5">
                Workspace Name <span className="text-rose-400">*</span>
              </label>
              <input
                id="projectName"
                type="text"
                placeholder="e.g. Order Service v1 to v2 Migration"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-slate-700 bg-slate-950 rounded-lg px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs shadow-inner"
                disabled={loading}
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="projectDesc" className="block font-medium text-slate-300 mb-1.5">
                Description (Optional)
              </label>
              <textarea
                id="projectDesc"
                rows={3}
                placeholder="Describe the contract migration scope, upstream consumer services, or breaking changes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-slate-700 bg-slate-950 rounded-lg px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs shadow-inner resize-none"
                disabled={loading}
              />
            </div>

            <div className="p-3.5 border border-slate-800 bg-slate-950/60 rounded-lg flex items-start space-x-3">
              <input
                id="preloadCanonical"
                type="checkbox"
                checked={preloadCanonical}
                onChange={(e) => setPreloadCanonical(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 text-teal-500 focus:ring-teal-500 bg-slate-900"
                disabled={loading}
              />
              <label htmlFor="preloadCanonical" className="text-xs text-slate-300 cursor-pointer select-none">
                <span className="font-semibold text-white block mb-0.5">
                  Preload Canonical E-Commerce Contract Pair (Recommended)
                </span>
                <span className="text-[11px] text-slate-400 block leading-normal">
                  Initializes the workspace with the canonical OpenAPI 3.x order billing spec (source) and modern invoice target schema (target) to immediately test diffing, Groq AI proposal synthesis, and TypeScript adapter generation.
                </span>
              </label>
            </div>

            <div className="pt-2 flex items-center justify-end space-x-3">
              <Link
                href="/projects"
                className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 transition"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center text-xs font-mono font-semibold px-4 py-2 rounded-lg bg-teal-500 text-slate-950 hover:bg-teal-400 disabled:opacity-50 transition shadow-sm"
              >
                {loading ? "Initializing..." : "Create Workspace →"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
