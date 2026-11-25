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

  // Real Live Interactive Compiler State
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

  // Compile real canonical specs & plan once deterministically
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

  // Execute real interpreter + target validator on user's live JSON input
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
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans">
      <TopBar />

      <main className="flex-1">
        {/* Hero + Live Interactive Compiler Split */}
        <section className="border-b border-zinc-800/80 bg-dot-grid">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
              {/* Left: Authoritative Value Prop & Real Actions */}
              <div className="lg:col-span-5 space-y-6 pt-2">
                <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-semibold tracking-[-0.03em] text-white leading-[1.1]">
                  Compile breaking API migrations into verified adapters.
                </h1>

                <p className="text-sm sm:text-[15px] text-zinc-400 leading-relaxed max-w-lg">
                  Ingest OpenAPI 3.x and JSON Schemas, inspect deterministic 9-facet diffs, review
                  Groq AI mapping proposals with mandatory human gates, and emit zero-eval TypeScript
                  adapters backed by Azure SQL &amp; Blob evidence.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={launchCanonicalWorkspace}
                    disabled={launchingSandbox}
                    className="inline-flex items-center justify-center text-xs font-semibold px-4 py-2.5 rounded-md bg-emerald-500 text-zinc-950 hover:bg-emerald-400 disabled:opacity-60 transition shadow-sm"
                  >
                    {launchingSandbox ? "Initializing Workspace..." : "Launch Live Workbench →"}
                  </button>
                  <Link
                    href="/projects/new"
                    className="inline-flex items-center justify-center text-xs font-medium px-4 py-2.5 rounded-md border border-zinc-800 bg-zinc-900/90 text-zinc-200 hover:bg-zinc-800 hover:text-white transition"
                  >
                    New Custom Project
                  </Link>
                </div>

                {/* Live Infrastructure Ledger Strip (Not a 4-card grid!) */}
                <div className="pt-4 border-t border-zinc-800/80 space-y-2.5">
                  <div className="text-[11px] font-medium text-zinc-500">
                    Connected Infrastructure
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-400">PostgreSQL</span>
                      <span className={cloudStatus?.supabase.configured ? "text-emerald-400" : "text-zinc-500"}>
                        {cloudStatus?.supabase.configured ? "Supabase RLS" : "Local Store"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-400">Advisory AI</span>
                      <span className={cloudStatus?.groq.configured ? "text-emerald-400" : "text-zinc-500"}>
                        {cloudStatus?.groq.configured ? "gpt-oss-120b" : "Offline"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-400">Evidence SQL</span>
                      <span className={cloudStatus?.azureSql.configured ? "text-emerald-400" : "text-zinc-500"}>
                        {cloudStatus?.azureSql.configured ? "Azure SQL" : "Simulated"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-400">Artifacts</span>
                      <span className={cloudStatus?.azureBlob.configured ? "text-emerald-400" : "text-zinc-500"}>
                        {cloudStatus?.azureBlob.configured ? "Azure Blob" : "In-Memory"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Live Interactive Compiler Sandbox (Real Engine Running Live) */}
              <div className="lg:col-span-7 bg-[#0c0c0f] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
                {/* Sandbox Header Bar */}
                <div className="px-4 py-2.5 bg-zinc-950 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setSandboxTab("execute")}
                      className={`px-2.5 py-1 rounded-md font-medium transition ${
                        sandboxTab === "execute"
                          ? "bg-zinc-800 text-white"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Live Execution
                    </button>
                    <button
                      type="button"
                      onClick={() => setSandboxTab("diff")}
                      className={`px-2.5 py-1 rounded-md font-medium transition ${
                        sandboxTab === "diff"
                          ? "bg-zinc-800 text-white"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Structural Diff ({liveCompiled.diff.items.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSandboxTab("adapter")}
                      className={`px-2.5 py-1 rounded-md font-medium transition ${
                        sandboxTab === "adapter"
                          ? "bg-zinc-800 text-white"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Generated Adapter (.ts)
                    </button>
                  </div>

                  <span className="font-mono text-[10px] text-zinc-500">
                    BillingOrder v1.2 → InvoiceFulfillment v2.0
                  </span>
                </div>

                {/* Tab 1: Real-Time Interpreter & Validator */}
                {sandboxTab === "execute" && (
                  <div className="p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-zinc-400">
                        Source Payload (Editable JSON)
                      </span>
                      <div className="flex items-center gap-1.5">
                        {CANONICAL_TEST_FIXTURES.map((f, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectFixture(idx)}
                            className={`text-[10px] font-mono px-2 py-0.5 rounded border transition ${
                              fixtureIdx === idx
                                ? "bg-zinc-800 text-zinc-100 border-zinc-700"
                                : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                            }`}
                          >
                            {f.expectValid ? `Fixture ${idx + 1} (Valid)` : `Fixture ${idx + 1} (Invalid)`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <textarea
                          value={payloadText}
                          onChange={(e) => setPayloadText(e.target.value)}
                          spellCheck={false}
                          rows={9}
                          aria-label="Source JSON payload"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-[11px] text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none leading-relaxed"
                        />
                      </div>

                      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 flex flex-col justify-between min-h-[192px]">
                        <div>
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/80">
                            <span className="text-[10px] font-mono text-zinc-400 uppercase">
                              Target Output &amp; Conformance
                            </span>
                            {liveRun?.parseError ? (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-950/70 text-rose-300 border border-rose-800/60">
                                JSON SYNTAX ERROR
                              </span>
                            ) : liveRun?.exec?.success && liveRun.validation?.valid ? (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-800/60">
                                TARGET VALID
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-950/70 text-rose-300 border border-rose-800/60">
                                CONTRACT VIOLATION
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
                          <div className="mt-2 pt-2 border-t border-zinc-800/80 text-[10px] font-mono text-rose-300 space-y-1">
                            {liveRun.validation.errors.map((e, i) => (
                              <div key={i}>{e.message}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 2: Live Computed Structural Diff */}
                {sandboxTab === "diff" && (
                  <div className="p-4">
                    <div className="max-h-[260px] overflow-y-auto divide-y divide-zinc-800/70 border border-zinc-800 rounded-lg bg-zinc-950">
                      {liveCompiled.diff.items.map((item) => (
                        <div key={item.id} className="p-3 flex items-start justify-between gap-3 text-xs">
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
                            className={`shrink-0 font-mono text-[10px] px-2 py-0.5 rounded border ${
                              item.severity === "error"
                                ? "bg-rose-950/60 text-rose-300 border-rose-800/60"
                                : item.severity === "warning"
                                ? "bg-amber-950/60 text-amber-300 border-amber-800/60"
                                : "bg-zinc-900 text-zinc-300 border-zinc-800"
                            }`}
                          >
                            {item.category}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab 3: Live Generated TypeScript Adapter */}
                {sandboxTab === "adapter" && (
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-zinc-400">
                        Zero-dependency standalone adapter (compiled without eval)
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyAdapter}
                        className="text-[11px] font-mono px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition"
                      >
                        {copiedAdapter ? "Copied ✓" : "Copy .ts"}
                      </button>
                    </div>
                    <pre className="max-h-[240px] overflow-auto bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-[11px] text-zinc-300 leading-relaxed">
                      {liveCompiled.adapterCode}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Active Workspaces Table (Dense Linear-style List) */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">Workspaces</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Open an existing compatibility project or initialize a new contract pair.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/projects"
                className="text-xs font-medium text-zinc-300 hover:text-white px-3 py-1.5 rounded-md border border-zinc-800 bg-zinc-900/70 hover:bg-zinc-800 transition"
              >
                View all
              </Link>
              <Link
                href="/projects/new"
                className="text-xs font-semibold text-zinc-950 bg-emerald-500 hover:bg-emerald-400 px-3 py-1.5 rounded-md transition"
              >
                + New Workspace
              </Link>
            </div>
          </div>

          <div className="border border-zinc-800 rounded-xl bg-zinc-900/40 overflow-hidden divide-y divide-zinc-800/70">
            {loadingProjects ? (
              <div className="p-6 space-y-3">
                <div className="h-10 bg-zinc-800/50 rounded animate-pulse" />
                <div className="h-10 bg-zinc-800/50 rounded animate-pulse" />
              </div>
            ) : projects.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400">
                No workspaces yet.{" "}
                <button
                  type="button"
                  onClick={launchCanonicalWorkspace}
                  className="text-emerald-400 hover:underline font-medium"
                >
                  Launch the canonical e-commerce workspace →
                </button>
              </div>
            ) : (
              projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-zinc-800/40 transition group"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-medium text-zinc-100 group-hover:text-emerald-400 transition truncate">
                        {p.name}
                      </span>
                      <span className="font-mono text-[10px] text-zinc-500 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">
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

        {/* System Guarantees & Architecture Boundaries (Clean 2-Column Technical Spec) */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="border-t border-zinc-800/80 pt-10 grid grid-cols-1 md:grid-cols-2 gap-8 text-xs">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white">Deterministic Security Boundaries</h3>
              <p className="text-zinc-400 leading-relaxed">
                External <code className="text-zinc-200 font-mono">$ref</code> URLs are rejected at ingestion to
                eliminate SSRF. Schema descriptions are fenced as untrusted data before reaching Groq’s{" "}
                <code className="text-zinc-200 font-mono">openai/gpt-oss-120b</code>, and ambiguous mappings
                always require explicit human sign-off prior to IR compilation.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white">Zero-Eval Multi-Cloud Evidence</h3>
              <p className="text-zinc-400 leading-relaxed">
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
