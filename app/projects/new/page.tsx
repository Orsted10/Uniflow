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
    <div className="min-h-screen bg-[#050507] text-[#f5f5f7] flex flex-col font-sans">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12 w-full flex-1">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Workspaces", href: "/projects" },
            { label: "New Project", current: true },
          ]}
          className="mb-6"
        />

        <div className="apple-glass rounded-2xl p-7 sm:p-8">
          <div className="border-b border-white/[0.07] pb-4 mb-6">
            <h1 className="text-xl font-semibold text-white tracking-[-0.025em]">Create Compatibility Workspace</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Initialize a new comparison workspace for source and target API contracts.
            </p>
          </div>

          {errorMsg && <ErrorPanel message={errorMsg} onDismiss={() => setErrorMsg(null)} className="mb-4" />}

          <form onSubmit={handleSubmit} className="space-y-5 text-xs">
            <div>
              <label htmlFor="projectName" className="block font-medium text-zinc-300 mb-1.5">
                Workspace Name <span className="text-rose-400">*</span>
              </label>
              <input
                id="projectName"
                type="text"
                placeholder="e.g. Order Service v1 to v2 Migration"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-white/[0.1] bg-black/50 rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-white/30 text-xs"
                disabled={loading}
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="projectDesc" className="block font-medium text-zinc-300 mb-1.5">
                Description (Optional)
              </label>
              <textarea
                id="projectDesc"
                rows={3}
                placeholder="Describe the contract migration scope, upstream consumer services, or breaking changes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-white/[0.1] bg-black/50 rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-white/30 text-xs resize-none"
                disabled={loading}
              />
            </div>

            <div className="p-4 border border-white/[0.08] bg-black/40 rounded-xl flex items-start space-x-3">
              <input
                id="preloadCanonical"
                type="checkbox"
                checked={preloadCanonical}
                onChange={(e) => setPreloadCanonical(e.target.checked)}
                className="mt-0.5 rounded border-white/20 text-white focus:ring-white/30 bg-black"
                disabled={loading}
              />
              <label htmlFor="preloadCanonical" className="text-xs text-zinc-300 cursor-pointer select-none">
                <span className="font-semibold text-white block mb-0.5">
                  Preload Canonical E-Commerce Contract Pair
                </span>
                <span className="text-[11px] text-zinc-400 block leading-normal">
                  Initializes the workspace with the canonical order billing spec (source) and invoice target schema (target) to immediately test diffing, Groq AI proposals, and TypeScript adapter generation.
                </span>
              </label>
            </div>

            <div className="pt-2 flex items-center justify-end space-x-3">
              <Link
                href="/projects"
                className="text-xs text-zinc-400 hover:text-zinc-200 px-3 py-1.5 transition"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center text-xs font-semibold px-5 py-2 rounded-full bg-white text-black hover:bg-zinc-200 disabled:opacity-50 transition"
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
