"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shell/topbar";
import { HeroBackdrop } from "@/components/ui/hero-backdrop";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ErrorPanel } from "@/components/ui/error-panel";

const WORKSPACE_PRESETS = [
  {
    name: "Billing API → Invoice Fulfillment",
    description: "Migrate legacy integer order billing payloads to canonical string-backed microservice v2 contracts.",
    tag: "E-Commerce",
  },
  {
    name: "Payment Webhook → ERP Ledger Sync",
    description: "Normalize payment gateway webhook events with currency case conversion and nested audit fields.",
    tag: "Fintech",
  },
  {
    name: "Partner Order v1 → Fulfillment v2",
    description: "Deterministic 9-facet structural diff with Groq AI mapping proposals and zero-eval TypeScript adapter.",
    tag: "Microservices",
  },
];

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
    <div className="min-h-screen bg-[#090807] text-[#f5f2eb] flex flex-col font-sans relative overflow-x-hidden">
      <HeroBackdrop />
      <TopBar />

      <main className="relative z-10 max-w-[1580px] mx-auto px-6 sm:px-9 lg:px-12 py-10 w-full flex-1 flex flex-col justify-center">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Breadcrumb
            items={[
              { label: "Overview", href: "/" },
              { label: "Workspaces", href: "/projects" },
              { label: "New Project", current: true },
            ]}
          />
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/[0.14] text-xs font-mono text-zinc-200">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span>CERT-In &bull; DPDP Act 2023 &bull; Tenant Isolated</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-11 lg:gap-16 items-center">
          {/* Left Editorial Column */}
          <div className="lg:col-span-6 space-y-7">
            <h1 className="font-editorial text-[52px] sm:text-[64px] xl:text-[74px] font-normal tracking-[-0.025em] text-[#fdfaf5] leading-[1.02] drop-shadow-[0_4px_24px_rgba(0,0,0,0.75)]">
              Create your{" "}
              <span className="relative inline-block">
                <span className="font-brush text-[60px] sm:text-[72px] xl:text-[84px] text-[#f4845f] font-bold tracking-normal leading-none pr-1">
                  contract
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
              </span>{" "}
              workspace.
            </h1>

            <p className="text-base sm:text-lg text-[#ebe3d8] leading-[1.65] max-w-xl drop-shadow-[0_2px_14px_rgba(0,0,0,0.85)]">
              Initialize an isolated compatibility environment for OpenAPI 3.x and JSON Schema pairs. Every workspace includes deterministic diffing, human-gated Groq AI proposals, and zero-eval TypeScript adapters.
            </p>

            {/* Quick-Fill Templates */}
            <div className="space-y-3 pt-2 max-w-xl">
              <div className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                One-click starter presets
              </div>
              <div className="grid grid-cols-1 gap-3">
                {WORKSPACE_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setName(preset.name);
                      setDescription(preset.description);
                    }}
                    className="apple-glass rounded-2xl px-5 py-3.5 text-left hover:border-[#f5dfb8]/35 hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-between gap-4 group"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white group-hover:text-[#f5dfb8] transition truncate">
                        {preset.name}
                      </div>
                      <div className="text-xs text-zinc-400 truncate mt-0.5">
                        {preset.description}
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.1] text-zinc-300">
                      {preset.tag}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Frosted Studio Window */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end">
            <div className="apple-glass rounded-3xl overflow-hidden w-full max-w-[600px]">
              <div className="px-6 py-4 bg-white/[0.04] border-b border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full bg-[#ff5f56]" />
                  <span className="w-3.5 h-3.5 rounded-full bg-[#ffbd2e]" />
                  <span className="w-3.5 h-3.5 rounded-full bg-[#27c93f]" />
                </div>
                <span className="font-mono text-xs text-zinc-400">new.uniflow.dev</span>
                <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  RLS Active
                </span>
              </div>

              <div className="p-8 sm:p-10 space-y-6">
                <div className="border-b border-white/[0.08] pb-4">
                  <h2 className="text-2xl font-semibold text-white tracking-tight">
                    Workspace Configuration
                  </h2>
                  <p className="text-sm text-zinc-400 mt-1">
                    Persisted directly to your authenticated Supabase PostgreSQL tenant.
                  </p>
                </div>

                {errorMsg && <ErrorPanel message={errorMsg} onDismiss={() => setErrorMsg(null)} />}

                <form onSubmit={handleSubmit} className="space-y-5 text-[15px]">
                  <div>
                    <label htmlFor="projectName" className="block text-[13px] font-medium text-zinc-300 mb-1.5">
                      Workspace Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      id="projectName"
                      type="text"
                      placeholder="e.g. Order Service v1 to v2 Migration"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full border border-white/[0.14] bg-[#0e0d0b] rounded-xl px-4 py-3.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#f3e7d3]/60 text-[15px]"
                      disabled={loading}
                      autoFocus
                    />
                  </div>

                  <div>
                    <label htmlFor="projectDesc" className="block text-[13px] font-medium text-zinc-300 mb-1.5">
                      Description (Optional)
                    </label>
                    <textarea
                      id="projectDesc"
                      rows={3}
                      placeholder="Describe the contract migration scope, upstream consumer services, or breaking changes..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full border border-white/[0.14] bg-[#0e0d0b] rounded-xl px-4 py-3.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#f3e7d3]/60 text-[15px] resize-none"
                      disabled={loading}
                    />
                  </div>

                  <label
                    htmlFor="preloadCanonical"
                    className="p-4 border border-white/[0.1] bg-black/45 hover:bg-black/60 rounded-2xl flex items-start gap-3.5 cursor-pointer transition"
                  >
                    <input
                      id="preloadCanonical"
                      type="checkbox"
                      checked={preloadCanonical}
                      onChange={(e) => setPreloadCanonical(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-white/20 text-[#f5dfb8] focus:ring-[#f5dfb8]/40 bg-black"
                      disabled={loading}
                    />
                    <span className="text-sm text-zinc-300 select-none">
                      <span className="font-semibold text-white block mb-0.5">
                        Preload Canonical E-Commerce Contract Pair
                      </span>
                      <span className="text-xs text-zinc-400 block leading-relaxed">
                        Initializes source &amp; target specs so you can immediately run 9-facet diffing, Groq AI proposals, and TypeScript adapter generation.
                      </span>
                    </span>
                  </label>

                  <div className="pt-2 flex items-center justify-between gap-4">
                    <Link
                      href="/projects"
                      className="text-sm text-zinc-400 hover:text-zinc-200 px-4 py-2.5 transition"
                    >
                      ← Cancel
                    </Link>
                    <button
                      type="submit"
                      disabled={loading}
                      className="champagne-pill inline-flex items-center gap-2 text-[15px] font-semibold px-7 py-3.5 rounded-full disabled:opacity-50 transition"
                    >
                      {loading ? "Initializing..." : "Create Workspace →"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
