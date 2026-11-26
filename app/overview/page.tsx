"use client";

import * as React from "react";
import Link from "next/link";
import { TopBar } from "@/components/shell/topbar";
import { HeroBackdrop } from "@/components/ui/hero-backdrop";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Project } from "@/lib/supabase/models";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const PIPELINE_STAGES = [
  {
    step: "01",
    title: "Ingest & Normalize Specs",
    desc: "Parse OpenAPI 3.x, JSON Schema, or sample JSON into a canonical AST with SHA-256 digests and SSRF guards.",
    accent: "text-amber-300 bg-amber-500/15 border-amber-400/30",
  },
  {
    step: "02",
    title: "9-Facet Structural Diff",
    desc: "Deterministically classify breaking renames, type shifts, enum narrowing, and required field additions.",
    accent: "text-teal-300 bg-teal-500/15 border-teal-400/30",
  },
  {
    step: "03",
    title: "Groq AI Mapping Proposals",
    desc: "Generate schema-bounded transformation proposals with prompt-injection sanitization and zero key exposure.",
    accent: "text-violet-300 bg-violet-500/15 border-violet-400/30",
  },
  {
    step: "04",
    title: "Human-in-the-Loop Review",
    desc: "Approve, edit, or reject every mapping decision with explicit confidence scoring and audit attribution.",
    accent: "text-sky-300 bg-sky-500/15 border-sky-400/30",
  },
  {
    step: "05",
    title: "Compile IR & Zero-Eval Adapter",
    desc: "Compile approved mappings into validated IR, run the trusted interpreter, and emit standalone TypeScript.",
    accent: "text-[#f4845f] bg-[#f4845f]/15 border-[#f4845f]/30",
  },
  {
    step: "06",
    title: "Compatibility Report & Cloud",
    desc: "Assemble cryptographic compatibility reports and certify execution evidence in Azure SQL & Azure Blob.",
    accent: "text-emerald-300 bg-emerald-500/15 border-emerald-400/30",
  },
];

export default function OverviewDashboardPage() {
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        setUserEmail(user?.email || null);
      });
    }

    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.projects)) {
          setProjects(data.projects);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#090807] text-[#f5f2eb] flex flex-col font-sans relative overflow-x-hidden">
      <HeroBackdrop />
      <TopBar />

      <main className="relative z-10 max-w-[1680px] mx-auto px-6 sm:px-10 lg:px-12 py-10 w-full flex-1 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Breadcrumb items={[{ label: "Overview", current: true }]} />
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/[0.14] text-xs font-mono text-zinc-200">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
            <span>CERT-In &bull; DPDP Act 2023 &bull; PostgreSQL RLS</span>
          </div>
        </div>

        {/* Hero Command Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-white/[0.1]">
          <div className="space-y-3">
            <h1 className="font-editorial text-[48px] sm:text-[58px] font-normal tracking-[-0.025em] text-[#fdfaf5] leading-[1.02] drop-shadow-[0_4px_24px_rgba(0,0,0,0.75)]">
              Workspace{" "}
              <span className="relative inline-block">
                <span className="font-brush text-[56px] sm:text-[66px] text-[#f4845f] font-bold tracking-normal leading-none pr-1">
                  command
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
              overview.
            </h1>
            <p className="text-base sm:text-lg text-[#ebe3d8] max-w-2xl leading-relaxed">
              {userEmail ? (
                <>
                  Signed in as <span className="font-mono text-[#f5dfb8]">{userEmail}</span>. Manage your 6-stage API compatibility pipelines, human review gates, and certified TypeScript adapters.
                </>
              ) : (
                "Manage your 6-stage API compatibility pipelines, human review gates, and certified TypeScript adapters."
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3.5">
            <Link
              href="/projects"
              className="inline-flex items-center gap-2 text-sm sm:text-[15px] font-medium px-6 py-3 rounded-full border border-white/[0.16] bg-black/45 hover:bg-white/[0.1] text-zinc-100 backdrop-blur-md transition"
            >
              All Workspaces ({projects.length})
            </Link>
            <Link
              href="/projects/new"
              className="champagne-pill inline-flex items-center gap-2 text-sm sm:text-[15px] font-semibold px-7 py-3 rounded-full transition"
            >
              + New Project
            </Link>
          </div>
        </div>

        {/* 6-Stage Compiler Architecture Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-mono uppercase tracking-wider text-zinc-300">
              6-Stage Deterministic Compiler Pipeline
            </h2>
            <span className="text-xs font-mono text-zinc-400">
              Zero Eval &bull; 100% Type-Safe
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {PIPELINE_STAGES.map((stage) => (
              <div
                key={stage.step}
                className="apple-glass rounded-2xl p-5 flex items-start gap-4 hover:border-[#f5dfb8]/30 transition"
              >
                <span
                  className={`w-10 h-10 rounded-xl border font-mono text-sm font-bold flex items-center justify-center shrink-0 ${stage.accent}`}
                >
                  {stage.step}
                </span>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-white">{stage.title}</h3>
                  <p className="text-xs sm:text-[13px] text-zinc-300 leading-relaxed">
                    {stage.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Real Workspaces */}
        <section className="apple-glass rounded-3xl overflow-hidden">
          <div className="px-7 py-5 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white tracking-tight">
                Recent Workspaces
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Jump back into an active contract migration or initialize a new one.
              </p>
            </div>
            <Link
              href="/projects"
              className="text-xs sm:text-sm font-medium text-[#f5dfb8] hover:underline"
            >
              View all workspaces →
            </Link>
          </div>

          <div className="divide-y divide-white/[0.07]">
            {loading ? (
              <div className="p-8 space-y-3">
                <div className="h-12 bg-white/[0.04] rounded-xl animate-pulse" />
                <div className="h-12 bg-white/[0.04] rounded-xl animate-pulse" />
              </div>
            ) : projects.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <p className="text-sm text-zinc-300">
                  No workspaces created yet under your account.
                </p>
                <Link
                  href="/projects/new"
                  className="champagne-pill inline-flex items-center gap-2 text-sm font-semibold px-6 py-2.5 rounded-full transition"
                >
                  Create Your First Workspace →
                </Link>
              </div>
            ) : (
              projects.slice(0, 5).map((p, i) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="px-7 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.03] transition group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-base font-mono shrink-0 border ${
                        i % 2 === 0
                          ? "bg-teal-500/15 border-teal-400/30 text-teal-300"
                          : "bg-violet-500/15 border-violet-400/30 text-violet-300"
                      }`}
                    >
                      {i % 2 === 0 ? "↗" : "⚡"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base font-semibold text-zinc-100 group-hover:text-[#f5dfb8] transition truncate">
                          {p.name}
                        </span>
                        <span className="font-mono text-xs text-zinc-400 bg-white/[0.05] border border-white/[0.09] px-2.5 py-0.5 rounded-full">
                          {p.id}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-zinc-400 truncate mt-0.5">
                        {p.description || "API contract diff, review, and adapter compilation workspace"}
                      </p>
                    </div>
                  </div>
                  <span className="champagne-pill inline-flex items-center gap-2 text-xs sm:text-sm font-semibold px-5 py-2 rounded-full shrink-0">
                    Open Studio →
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
