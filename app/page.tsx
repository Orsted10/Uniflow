"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shell/topbar";
import { Project } from "@/lib/supabase/models";
import { DEMO_PROJECTS } from "@/lib/fixtures/mock-projects";
import {
  CANONICAL_SOURCE_SPEC,
  CANONICAL_TARGET_SPEC,
  CANONICAL_TEST_FIXTURES,
} from "@/lib/specs/fixtures";
import { parseSpecificationText } from "@/lib/specs/parser";
import { normalizeSpecification } from "@/lib/specs/normalizer";
import { computeStructuralDiff } from "@/lib/specs/diff";
import { generateBaselineMappings } from "@/lib/mapping/classify";
import { compileTransformationPlan } from "@/lib/transformation/compiler";
import { executeTransformationPlan } from "@/lib/transformation/interpreter";
import { validateAgainstTargetSchema } from "@/lib/transformation/validate";
import { generateTypeScriptAdapter } from "@/lib/transformation/generator";

interface CloudServices {
  supabase: { configured: boolean; status: string; endpoint: string | null };
  groq: { configured: boolean; status: string; model: string };
  azureBlob: { configured: boolean; status: string; accountName: string | null; containerName: string };
  azureSql: { configured: boolean; status: string; server: string | null; database: string | null };
}

type SandboxTab = "execute" | "diff" | "adapter";

export default function LandingDashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [cloudStatus, setCloudStatus] = React.useState<CloudServices | null>(null);
  const [loadingProjects, setLoadingProjects] = React.useState(true);
  const [launchingSandbox, setLaunchingSandbox] = React.useState(false);

  const [sandboxTab, setSandboxTab] = React.useState<SandboxTab>("execute");
  const [fixtureIdx, setFixtureIdx] = React.useState<number>(0);
  const [payloadText, setPayloadText] = React.useState<string>(
    JSON.stringify(CANONICAL_TEST_FIXTURES[0].payload, null, 2)
  );
  const [copiedAdapter, setCopiedAdapter] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        if (data.projects && Array.isArray(data.projects) && data.projects.length > 0) {
          setProjects(data.projects);
        } else {
          setProjects(DEMO_PROJECTS);
        }
      })
      .catch(() => setProjects(DEMO_PROJECTS))
      .finally(() => setLoadingProjects(false));

    fetch("/api/cloud/status")
      .then((r) => r.json())
      .then((data) => {
        if (data?.services) setCloudStatus(data.services);
      })
      .catch(() => {});
  }, []);

  const liveCompiled = React.useMemo(() => {
    const sourceNorm = normalizeSpecification(parseSpecificationText(CANONICAL_SOURCE_SPEC), "source");
    const targetNorm = normalizeSpecification(parseSpecificationText(CANONICAL_TARGET_SPEC), "target");
    const diff = computeStructuralDiff(sourceNorm, targetNorm);
    const baseline = generateBaselineMappings(diff, sourceNorm, targetNorm).map((m) => ({
      ...m,
      status: "accepted" as const,
      transformation:
        m.targetPath === '$["region"]'
          ? { operation: "default" as const, defaultValue: "us-east-1" }
          : m.targetPath === '$["currency_code"]'
          ? {
              operation: "lookup" as const,
              lookupTable: { USD: "usd", EUR: "eur", GBP: "gbp" },
            }
          : m.transformation,
    }));

    const compiled = compileTransformationPlan(baseline, sourceNorm, targetNorm, "live-sandbox");
    const plan = compiled.success ? compiled.plan : null;
    const adapterCode = plan ? generateTypeScriptAdapter(plan) : "";

    return { sourceNorm, targetNorm, diff, plan, adapterCode };
  }, []);

  const liveRun = React.useMemo(() => {
    if (!liveCompiled.plan) return null;
    try {
      const parsedInput = JSON.parse(payloadText) as Record<string, unknown>;
      const exec = executeTransformationPlan(liveCompiled.plan, parsedInput);
      const validation = validateAgainstTargetSchema(exec.outputPayload, liveCompiled.targetNorm);
      return { parseError: null, exec, validation };
    } catch (err: unknown) {
      return {
        parseError: err instanceof Error ? err.message : "Invalid JSON payload",
        exec: null,
        validation: null,
      };
    }
  }, [payloadText, liveCompiled]);

  async function launchCanonicalWorkspace() {
    setLaunchingSandbox(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Billing v1 → Invoice v2 Migration",
          description: "Canonical e-commerce API contract migration with Groq AI proposals & Azure certification.",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.project?.id) {
        router.push("/projects/new");
        return;
      }
      const newId = data.project.id;

      await Promise.all([
        fetch(`/api/projects/${newId}/specs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            side: "source",
            name: "billing-source-v1.json",
            rawContent: CANONICAL_SOURCE_SPEC,
          }),
        }),
        fetch(`/api/projects/${newId}/specs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            side: "target",
            name: "invoice-target-v2.json",
            rawContent: CANONICAL_TARGET_SPEC,
          }),
        }),
      ]);

      router.push(`/projects/${newId}`);
    } catch {
      router.push("/projects/new");
    } finally {
      setLaunchingSandbox(false);
    }
  }

  function handleSelectFixture(idx: number) {
    setFixtureIdx(idx);
    setPayloadText(JSON.stringify(CANONICAL_TEST_FIXTURES[idx].payload, null, 2));
  }

  function handleCopyAdapter() {
    if (!liveCompiled.adapterCode) return;
    navigator.clipboard.writeText(liveCompiled.adapterCode);
    setCopiedAdapter(true);
    setTimeout(() => setCopiedAdapter(false), 1800);
  }

  return (
    <div className="min-h-screen bg-[#050507] text-[#f5f5f7] flex flex-col font-sans">
      <TopBar />

      <main className="flex-1">
        {/* Hero + macOS-Grade Live Compiler Window */}
        <section className="border-b border-white/[0.07] apple-ambient">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
              {/* Left: Crisp Apple Editorial Typography */}
              <div className="lg:col-span-5 space-y-7">
                <h1 className="text-4xl sm:text-5xl font-semibold tracking-[-0.035em] text-white leading-[1.06]">
                  Compile breaking API migrations into verified adapters.
                </h1>

                <p className="text-[15px] text-zinc-400 leading-[1.6] max-w-md">
                  Compare OpenAPI 3.x and JSON Schemas with deterministic 9-facet diffs, review Groq
                  AI proposals behind human gates, and ship zero-eval TypeScript adapters backed by
                  Azure SQL &amp; Blob evidence.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={launchCanonicalWorkspace}
                    disabled={launchingSandbox}
                    className="inline-flex items-center justify-center text-xs font-semibold px-5 py-2.5 rounded-full bg-white text-black hover:bg-zinc-200 disabled:opacity-60 transition-all duration-150 shadow-[0_1px_20px_rgba(255,255,255,0.16)]"
                  >
                    {launchingSandbox ? "Initializing..." : "Launch Live Workbench"}
                  </button>
                  <Link
                    href="/projects/new"
                    className="inline-flex items-center justify-center text-xs font-medium px-5 py-2.5 rounded-full border border-white/[0.12] bg-white/[0.05] text-zinc-100 hover:bg-white/[0.1] hover:border-white/[0.2] transition-all duration-150 backdrop-blur-md"
                  >
                    New Custom Project
                  </Link>
                </div>

                {/* Tactile Hardware-Style Spec Strip */}
                <div className="pt-6 border-t border-white/[0.08] grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
                  <div>
                    <span className="text-zinc-500 block text-[11px]">System of Record</span>
                    <span className="font-mono text-[11px] text-zinc-200">
                      {cloudStatus?.supabase.configured ? "Supabase PostgreSQL (RLS)" : "Local In-Memory"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[11px]">Advisory Engine</span>
                    <span className="font-mono text-[11px] text-zinc-200">
                      {cloudStatus?.groq.configured ? "Groq openai/gpt-oss-120b" : "Deterministic Fallback"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[11px]">Evidence Ledger</span>
                    <span className="font-mono text-[11px] text-zinc-200">
                      {cloudStatus?.azureSql.configured ? "Azure SQL Serverless" : "Simulated Ledger"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[11px]">Artifact Store</span>
                    <span className="font-mono text-[11px] text-zinc-200">
                      {cloudStatus?.azureBlob.configured ? "Azure Blob (uniflow-specs)" : "In-Memory Store"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Frosted Glass macOS Studio Window */}
              <div className="lg:col-span-7 apple-glass rounded-2xl overflow-hidden">
                {/* Window Chrome + Segmented Control */}
                <div className="px-4 py-3 bg-white/[0.025] border-b border-white/[0.07] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-white/[0.14]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-white/[0.14]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-white/[0.14]" />
                  </div>

                  {/* macOS Segmented Control */}
                  <div className="flex items-center p-0.5 rounded-full bg-black/40 border border-white/[0.07] text-[11px] font-medium">
                    <button
                      type="button"
                      onClick={() => setSandboxTab("execute")}
                      className={`px-3 py-1 rounded-full transition-all duration-150 ${
                        sandboxTab === "execute"
                          ? "bg-white/[0.14] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Execution
                    </button>
                    <button
                      type="button"
                      onClick={() => setSandboxTab("diff")}
                      className={`px-3 py-1 rounded-full transition-all duration-150 ${
                        sandboxTab === "diff"
                          ? "bg-white/[0.14] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Diff ({liveCompiled.diff.items.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSandboxTab("adapter")}
                      className={`px-3 py-1 rounded-full transition-all duration-150 ${
                        sandboxTab === "adapter"
                          ? "bg-white/[0.14] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Adapter.ts
                    </button>
                  </div>

                  <span className="hidden sm:inline font-mono text-[10px] text-zinc-500">
                    v1.2 → v2.0
                  </span>
                </div>

                {/* Tab 1: Live Execution */}
                {sandboxTab === "execute" && (
                  <div className="p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium text-zinc-300">
                        Source JSON Input
                      </span>
                      <div className="flex items-center gap-1.5">
                        {CANONICAL_TEST_FIXTURES.map((f, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectFixture(idx)}
                            className={`text-[10px] font-mono px-2.5 py-1 rounded-full border transition ${
                              fixtureIdx === idx
                                ? "bg-white/[0.12] text-white border-white/[0.2]"
                                : "bg-black/30 text-zinc-400 border-white/[0.06] hover:text-zinc-200"
                            }`}
                          >
                            {f.expectValid ? `Fixture ${idx + 1}` : `Invalid ${idx + 1}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <textarea
                        value={payloadText}
                        onChange={(e) => setPayloadText(e.target.value)}
                        spellCheck={false}
                        rows={9}
                        aria-label="Source JSON payload"
                        className="w-full bg-black/50 border border-white/[0.08] rounded-xl p-3.5 font-mono text-[11px] text-zinc-200 focus:outline-none focus:ring-1 focus:ring-white/30 resize-none leading-relaxed"
                      />

                      <div className="bg-black/50 border border-white/[0.08] rounded-xl p-3.5 flex flex-col justify-between min-h-[202px]">
                        <div>
                          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/[0.06]">
                            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                              Compiled Output
                            </span>
                            {liveRun?.parseError ? (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/25">
                                Syntax Error
                              </span>
                            ) : liveRun?.exec?.success && liveRun.validation?.valid ? (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                                Validated
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/25">
                                Rejected
                              </span>
                            )}
                          </div>

                          {liveRun?.parseError ? (
                            <p className="font-mono text-[11px] text-rose-300">{liveRun.parseError}</p>
                          ) : liveRun?.exec?.success ? (
                            <pre className="font-mono text-[11px] text-emerald-300/95 whitespace-pre-wrap leading-relaxed">
                              {JSON.stringify(liveRun.exec.outputPayload, null, 2)}
                            </pre>
                          ) : (
                            <p className="font-mono text-[11px] text-rose-300 leading-relaxed">
                              {liveRun?.exec?.error}
                            </p>
                          )}
                        </div>

                        {liveRun?.validation && !liveRun.validation.valid && (
                          <div className="mt-2 pt-2 border-t border-white/[0.06] text-[10px] font-mono text-rose-300 space-y-1">
                            {liveRun.validation.errors.map((e, i) => (
                              <div key={i}>{e.message}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 2: Structural Diff */}
                {sandboxTab === "diff" && (
                  <div className="p-5">
                    <div className="max-h-[268px] overflow-y-auto divide-y divide-white/[0.06] border border-white/[0.08] rounded-xl bg-black/50">
                      {liveCompiled.diff.items.map((item) => (
                        <div key={item.id} className="p-3.5 flex items-start justify-between gap-3 text-xs">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 font-mono text-[11px]">
                              <span className="text-zinc-400 truncate">
                                {item.sourcePath || "(none)"}
                              </span>
                              <span className="text-zinc-600">→</span>
                              <span className="text-white font-medium truncate">{item.targetPath}</span>
                            </div>
                            <p className="text-[11px] text-zinc-400">{item.message}</p>
                          </div>
                          <span
                            className={`shrink-0 font-mono text-[10px] px-2.5 py-0.5 rounded-full border ${
                              item.severity === "error"
                                ? "bg-rose-500/15 text-rose-300 border-rose-500/25"
                                : item.severity === "warning"
                                ? "bg-amber-500/15 text-amber-300 border-amber-500/25"
                                : "bg-white/[0.06] text-zinc-300 border-white/[0.1]"
                            }`}
                          >
                            {item.category}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab 3: Adapter.ts */}
                {sandboxTab === "adapter" && (
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-zinc-400">
                        Standalone TypeScript output (zero eval)
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyAdapter}
                        className="text-[11px] font-medium px-3 py-1 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-zinc-100 border border-white/[0.1] transition"
                      >
                        {copiedAdapter ? "Copied" : "Copy code"}
                      </button>
                    </div>
                    <pre className="max-h-[234px] overflow-auto bg-black/50 border border-white/[0.08] rounded-xl p-3.5 font-mono text-[11px] text-zinc-300 leading-relaxed">
                      {liveCompiled.adapterCode}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Active Workspaces */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white tracking-[-0.02em]">Workspaces</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Resume a compatibility project or initialize a fresh contract pair.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/projects"
                className="text-xs font-medium text-zinc-300 hover:text-white px-3.5 py-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] transition"
              >
                View all
              </Link>
              <Link
                href="/projects/new"
                className="text-xs font-semibold text-black bg-white hover:bg-zinc-200 px-3.5 py-1.5 rounded-full transition"
              >
                New Workspace
              </Link>
            </div>
          </div>

          <div className="apple-glass rounded-2xl overflow-hidden divide-y divide-white/[0.06]">
            {loadingProjects ? (
              <div className="p-6 space-y-3">
                <div className="h-10 bg-white/[0.04] rounded-lg animate-pulse" />
                <div className="h-10 bg-white/[0.04] rounded-lg animate-pulse" />
              </div>
            ) : projects.length === 0 ? (
              <div className="p-10 text-center text-xs text-zinc-400">
                No workspaces yet.{" "}
                <button
                  type="button"
                  onClick={launchCanonicalWorkspace}
                  className="text-white hover:underline font-medium"
                >
                  Launch the canonical e-commerce workspace →
                </button>
              </div>
            ) : (
              projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-white/[0.03] transition group"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-medium text-zinc-100 group-hover:text-white transition truncate">
                        {p.name}
                      </span>
                      <span className="font-mono text-[10px] text-zinc-500 bg-white/[0.04] border border-white/[0.07] px-2 py-0.5 rounded-full">
                        {p.id}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 truncate">
                      {p.description || "API contract diff, review, and adapter compilation workspace"}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 text-xs">
                    <span className="font-mono text-[11px] text-zinc-500">
                      {new Date(p.updated_at).toLocaleDateString()}
                    </span>
                    <span className="text-zinc-400 group-hover:text-white font-medium transition">
                      Open →
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        {/* Architectural Commitments */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          <div className="border-t border-white/[0.07] pt-12 grid grid-cols-1 md:grid-cols-2 gap-10 text-xs">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white tracking-tight">Deterministic Security Boundaries</h3>
              <p className="text-zinc-400 leading-relaxed max-w-prose">
                External <code className="text-zinc-200 font-mono">$ref</code> URLs are rejected at ingestion to
                eliminate SSRF. Schema descriptions are fenced as untrusted data before reaching Groq’s{" "}
                <code className="text-zinc-200 font-mono">openai/gpt-oss-120b</code>, and ambiguous mappings
                always require explicit human sign-off prior to IR compilation.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white tracking-tight">Zero-Eval Multi-Cloud Evidence</h3>
              <p className="text-zinc-400 leading-relaxed max-w-prose">
                Compiled Transformation IR executes strictly over 7 allowlisted primitives without dynamic{" "}
                <code className="text-zinc-200 font-mono">eval()</code>. Every test run and generated TypeScript
                adapter is equivalence-verified and certified with SHA-256 digests across Supabase PostgreSQL,
                Azure Blob Storage, and Azure SQL Serverless.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
