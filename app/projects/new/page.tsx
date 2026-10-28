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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 w-full flex-1">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Projects", href: "/projects" },
            { label: "New Project", current: true },
          ]}
          className="mb-4"
        />

        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs">
          <div className="border-b border-slate-100 pb-4 mb-5">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Create API Compatibility Project</h1>
            <p className="text-xs text-slate-500 mt-1">
              Set up a new comparison workspace for source and target API contracts.
            </p>
          </div>

          {errorMsg && <ErrorPanel message={errorMsg} onDismiss={() => setErrorMsg(null)} className="mb-4" />}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label htmlFor="projectName" className="block font-medium text-slate-700 mb-1">
                Project Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="projectName"
                type="text"
                required
                placeholder="e.g. Order Service v1 to v2 Migration"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs shadow-2xs"
              />
            </div>

            <div>
              <label htmlFor="projectDesc" className="block font-medium text-slate-700 mb-1">
                Description (Optional)
              </label>
              <textarea
                id="projectDesc"
                rows={3}
                placeholder="Briefly describe the systems being integrated and business intent..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs shadow-2xs resize-none"
              />
            </div>

            <div className="pt-2">
              <label className="flex items-start space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preloadCanonical}
                  onChange={(e) => setPreloadCanonical(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-500 mt-0.5"
                />
                <div>
                  <span className="font-semibold text-slate-800 block">
                    Pre-populate with Canonical E-Commerce Pair
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    Automatically loads the canonical BillingOrderSourceAPI and InvoiceFulfillmentTargetAPI for instant diffing and testing.
                  </span>
                </div>
              </label>
            </div>

            <div className="pt-5 border-t border-slate-100 flex items-center justify-end space-x-2">
              <Link
                href="/projects"
                className="px-3.5 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium transition"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-white font-medium transition shadow-xs disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create & Open Workspace →"}
              </button>
            </div>
          </form>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-3 text-center text-xs text-slate-400">
        UNIFLOW ∞ — API Compatibility Compiler
      </footer>
    </div>
  );
}
