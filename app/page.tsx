"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shell/topbar";
import { HeroBackdrop } from "@/components/ui/hero-backdrop";
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

type SandboxTab = "execute" | "diff" | "adapter";
type OutputSubTab = "output" | "steps" | "details";

export default function LandingDashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = React.useState(true);
  const [launchingSandbox, setLaunchingSandbox] = React.useState(false);

  const [sandboxTab, setSandboxTab] = React.useState<SandboxTab>("execute");
  const [outputSubTab, setOutputSubTab] = React.useState<OutputSubTab>("output");
  const [fixtureIdx, setFixtureIdx] = React.useState<number>(0);
  const [payloadText, setPayloadText] = React.useState<string>(
    JSON.stringify(CANONICAL_TEST_FIXTURES[0].payload, null, 2)
  );
  const [copiedAdapter, setCopiedAdapter] = React.useState(false);
  const [copiedInput, setCopiedInput] = React.useState(false);

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
  }, []);

  // Compile canonical contracts deterministically with complete approved mappings
  const liveCompiled = React.useMemo(() => {
    const sourceNorm = normalizeSpecification(parseSpecificationText(CANONICAL_SOURCE_SPEC), "source");
    const targetNorm = normalizeSpecification(parseSpecificationText(CANONICAL_TARGET_SPEC), "target");
    const diff = computeStructuralDiff(sourceNorm, targetNorm);

    const approvedMappings = generateBaselineMappings(diff, sourceNorm, targetNorm).map((m) => {
      // Ensure required new target field 'region' uses a safe default instead of failing
      if (m.targetPath.includes("region")) {
        return {
          ...m,
          status: "accepted" as const,
          semanticStatus: "verified" as const,
          transformation: {
            operation: "default" as const,
            targetType: "string" as const,
            defaultValue: "us-east-1",
            policyOnMissing: "useDefault" as const,
          },
        };
      }
      return {
        ...m,
        status: "accepted" as const,
        semanticStatus: "verified" as const,
      };
    });

    const compiled = compileTransformationPlan(approvedMappings, sourceNorm, targetNorm, "live-sandbox");
    const plan = compiled.success ? compiled.plan : null;
    const adapterCode = plan ? generateTypeScriptAdapter(plan) : "";

    return { sourceNorm, targetNorm, diff, plan, adapterCode };
  }, []);

  // Execute real AST interpreter + target validator on editable JSON payload
  const liveRun = React.useMemo(() => {
    if (!liveCompiled.plan) return null;
    const t0 = typeof performance !== "undefined" ? performance.now() : 0;
    try {
      const parsedInput = JSON.parse(payloadText) as Record<string, unknown>;
      const exec = executeTransformationPlan(liveCompiled.plan, parsedInput);
      const validation = validateAgainstTargetSchema(exec.outputPayload, liveCompiled.targetNorm);
      const elapsedMs = typeof performance !== "undefined" ? Math.max(0.2, performance.now() - t0) : 0.8;
      return { parseError: null, exec, validation, elapsedMs: elapsedMs.toFixed(1) };
    } catch (err: unknown) {
      return {
        parseError: err instanceof Error ? err.message : "Invalid JSON payload",
        exec: null,
        validation: null,
        elapsedMs: "0.0",
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
          name: "Billing API to Invoice Fulfillment",
          description: "Legacy integer-based billing order contract adapted to the string-based invoice fulfillment microservice.",
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

  function handleCopyInput() {
    navigator.clipboard.writeText(payloadText);
    setCopiedInput(true);
    setTimeout(() => setCopiedInput(false), 1500);
  }

  const inputLines = payloadText.split("\n");
  const isAllValid = Boolean(!liveRun?.parseError && liveRun?.exec?.success && liveRun?.validation?.valid);

  return (
    <div className="min-h-screen bg-[#0b0a09] text-[#f5f2eb] flex flex-col font-sans">
      <TopBar />

      <main className="flex-1 relative">
        {/* Hero Section with Sculpted Architectural Backdrop */}
        <section className="relative overflow-hidden">
          <HeroBackdrop />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-16 lg:pt-20 lg:pb-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Left Column: Editorial Serif Headline + Champagne Pill CTAs */}
              <div className="lg:col-span-5 space-y-6">
                <h1 className="font-editorial text-[42px] sm:text-[52px] lg:text-[58px] font-normal tracking-[-0.02em] text-[#f8f3eb] leading-[1.03]">
                  Compile breaking API migrations into{" "}
                  <em className="italic text-[#f3e7d3] font-normal">verified</em> adapters.
                </h1>

                <p className="text-[15px] text-[#b4aba0] leading-[1.6] max-w-md">
                  Compare OpenAPI 3.x and JSON Schemas with deterministic 9-facet diffs, review Groq
                  AI mapping proposals behind human gates, and ship zero-eval TypeScript adapters
                  backed by Azure SQL &amp; Blob evidence.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={launchCanonicalWorkspace}
                    disabled={launchingSandbox}
                    className="champagne-pill inline-flex items-center justify-center gap-2 text-xs font-semibold px-5 py-2.5 rounded-full disabled:opacity-60 transition-all duration-150"
                  >
                    <span>{launchingSandbox ? "Initializing..." : "Launch Live Workbench"}</span>
                    <span aria-hidden="true">→</span>
                  </button>
                  <Link
                    href="/projects/new"
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-medium px-5 py-2.5 rounded-full border border-white/[0.12] bg-white/[0.05] text-zinc-100 hover:bg-white/[0.1] hover:border-white/[0.2] transition-all duration-150 backdrop-blur-md"
                  >
                    <span>+ New Custom Project</span>
                  </Link>
                </div>

                {/* 3 Tactile Glass Spec Badges */}
                <div className="pt-3 flex flex-wrap items-center gap-2.5">
                  <div className="apple-glass rounded-xl px-3.5 py-2 flex items-center gap-2.5">
                    <span className="text-[#f3e7d3] text-xs">⚡</span>
                    <div>
                      <div className="text-xs font-semibold text-white leading-none">Zero Eval</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">Sandboxed IR</div>
                    </div>
                  </div>
                  <div className="apple-glass rounded-xl px-3.5 py-2 flex items-center gap-2.5">
                    <span className="text-emerald-400 text-xs">✓</span>
                    <div>
                      <div className="text-xs font-semibold text-white leading-none">100%</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">Type-Safe</div>
                    </div>
                  </div>
                  <div className="apple-glass rounded-xl px-3.5 py-2 flex items-center gap-2.5">
                    <span className="text-sky-300 text-xs">☁</span>
                    <div>
                      <div className="text-xs font-semibold text-white leading-none">Multi-Cloud</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">Azure &amp; Supabase</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: macOS Traffic-Light Studio Window */}
              <div className="lg:col-span-7 apple-glass rounded-2xl overflow-hidden">
                {/* macOS Chrome + Centered Segmented Control */}
                <div className="px-4 py-3 bg-white/[0.03] border-b border-white/[0.07] flex flex-wrap items-center justify-between gap-3">
                  {/* Traffic Light Dots */}
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#ff5f56]/90 border border-black/20" />
                    <span className="w-3 h-3 rounded-full bg-[#ffbd2e]/90 border border-black/20" />
                    <span className="w-3 h-3 rounded-full bg-[#27c93f]/90 border border-black/20" />
                  </div>

                  {/* Segmented Pill Control */}
                  <div className="flex items-center p-0.5 rounded-full bg-black/50 border border-white/[0.08] text-[11px] font-medium">
                    <button
                      type="button"
                      onClick={() => setSandboxTab("execute")}
                      className={`px-3.5 py-1 rounded-full transition-all duration-150 ${
                        sandboxTab === "execute"
                          ? "bg-[#f3e7d3] text-[#141210] font-semibold shadow-sm"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Execution
                    </button>
                    <button
                      type="button"
                      onClick={() => setSandboxTab("diff")}
                      className={`px-3.5 py-1 rounded-full transition-all duration-150 ${
                        sandboxTab === "diff"
                          ? "bg-[#f3e7d3] text-[#141210] font-semibold shadow-sm"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Diff ({liveCompiled.diff.items.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSandboxTab("adapter")}
                      className={`px-3.5 py-1 rounded-full transition-all duration-150 ${
                        sandboxTab === "adapter"
                          ? "bg-[#f3e7d3] text-[#141210] font-semibold shadow-sm"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Adapters
                    </button>
                  </div>

                  <div className="hidden sm:flex items-center gap-2 font-mono text-[10px]">
                    <span className="text-zinc-400">v1.2.0</span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live
                    </span>
                  </div>
                </div>

                {/* Tab 1: Real Execution & Validation */}
                {sandboxTab === "execute" && (
                  <div className="p-4 sm:p-5 space-y-3.5">
                    {/* Fixture Pill Strip */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-zinc-400">
                        BillingOrderSource → InvoiceFulfillmentTarget
                      </span>
                      <div className="flex items-center gap-1.5">
                        {CANONICAL_TEST_FIXTURES.map((f, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectFixture(idx)}
                            className={`text-[10px] font-mono px-2.5 py-1 rounded-full border transition ${
                              fixtureIdx === idx
                                ? "bg-white/[0.14] text-white border-white/[0.22]"
                                : "bg-black/35 text-zinc-400 border-white/[0.06] hover:text-zinc-200"
                            }`}
                          >
                            {f.expectValid ? `Fixture ${idx + 1}` : `Invalid ${idx + 1}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {/* Left Code Editor Pane with Line Numbers */}
                      <div className="bg-[#090807] border border-white/[0.08] rounded-xl overflow-hidden flex flex-col">
                        <div className="px-3 py-2 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between text-[11px]">
                          <span className="font-mono text-zinc-300 flex items-center gap-1.5">
                            <span className="text-zinc-500">{"{}"}</span> Source JSON Input
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyInput}
                            className="text-[10px] font-mono text-zinc-400 hover:text-white transition"
                          >
                            {copiedInput ? "Copied" : "Copy"}
                          </button>
                        </div>

                        <div className="flex flex-1 p-3 font-mono text-[11px] leading-relaxed min-h-[210px]">
                          <div
                            aria-hidden="true"
                            className="select-none text-zinc-600 pr-3 text-right border-r border-white/[0.05] mr-3 shrink-0"
                          >
                            {inputLines.map((_, i) => (
                              <div key={i}>{i + 1}</div>
                            ))}
                          </div>
                          <textarea
                            value={payloadText}
                            onChange={(e) => setPayloadText(e.target.value)}
                            spellCheck={false}
                            rows={Math.max(8, inputLines.length)}
                            aria-label="Source JSON payload"
                            className="w-full bg-transparent text-[#e6dfd3] focus:outline-none resize-none leading-relaxed"
                          />
                        </div>
                      </div>

                      {/* Right Execution & Verification Pane */}
                      <div className="bg-[#090807] border border-white/[0.08] rounded-xl overflow-hidden flex flex-col">
                        {/* Compilation Banner */}
                        <div
                          className={`px-3 py-2 border-b flex items-center justify-between text-[11px] ${
                            isAllValid
                              ? "bg-emerald-950/40 border-emerald-500/20 text-emerald-300"
                              : "bg-rose-950/40 border-rose-500/20 text-rose-300"
                          }`}
                        >
                          <span className="font-medium flex items-center gap-1.5">
                            <span>{isAllValid ? "✓" : "!"}</span>
                            <span>
                              {isAllValid
                                ? "Compilation Successful"
                                : liveRun?.parseError
                                ? "JSON Syntax Error"
                                : "Contract Violation"}
                            </span>
                          </span>
                          <span className="font-mono text-[10px] opacity-80">
                            {liveRun?.elapsedMs || "0.8"}ms ⚡
                          </span>
                        </div>

                        {/* Sub-tabs */}
                        <div className="px-3 pt-2 border-b border-white/[0.06] flex items-center gap-4 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setOutputSubTab("output")}
                            className={`pb-1.5 border-b-2 transition ${
                              outputSubTab === "output"
                                ? "border-[#f3e7d3] text-white font-medium"
                                : "border-transparent text-zinc-500 hover:text-zinc-300"
                            }`}
                          >
                            Output
                          </button>
                          <button
                            type="button"
                            onClick={() => setOutputSubTab("steps")}
                            className={`pb-1.5 border-b-2 transition ${
                              outputSubTab === "steps"
                                ? "border-[#f3e7d3] text-white font-medium"
                                : "border-transparent text-zinc-500 hover:text-zinc-300"
                            }`}
                          >
                            Steps ({liveRun?.exec?.stepResults.length || 0})
                          </button>
                          <button
                            type="button"
                            onClick={() => setOutputSubTab("details")}
                            className={`pb-1.5 border-b-2 transition ${
                              outputSubTab === "details"
                                ? "border-[#f3e7d3] text-white font-medium"
                                : "border-transparent text-zinc-500 hover:text-zinc-300"
                            }`}
                          >
                            Validation
                          </button>
                        </div>

                        <div className="p-3 flex-1 overflow-auto max-h-[195px] font-mono text-[11px]">
                          {outputSubTab === "output" && (
                            <>
                              {liveRun?.parseError ? (
                                <p className="text-rose-300">{liveRun.parseError}</p>
                              ) : liveRun?.exec?.success ? (
                                <pre className="text-emerald-300/95 whitespace-pre-wrap leading-relaxed">
                                  {JSON.stringify(liveRun.exec.outputPayload, null, 2)}
                                </pre>
                              ) : (
                                <p className="text-rose-300 leading-relaxed">{liveRun?.exec?.error}</p>
                              )}
                            </>
                          )}

                          {outputSubTab === "steps" && (
                            <div className="space-y-1.5">
                              {liveRun?.exec?.stepResults.map((s) => (
                                <div
                                  key={s.stepId}
                                  className="flex items-center justify-between text-[10px] py-1 border-b border-white/[0.04]"
                                >
                                  <span className="text-zinc-300 truncate pr-2">
                                    <span className="text-zinc-500">{s.operation}</span> → {s.targetPath}
                                  </span>
                                  <span className={s.success ? "text-emerald-400" : "text-rose-400"}>
                                    {s.success ? "OK" : "FAIL"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {outputSubTab === "details" && (
                            <div className="space-y-2 text-[10px]">
                              {liveRun?.validation?.valid ? (
                                <div className="text-emerald-300">
                                  All {liveRun.validation.checkedFieldCount} target contract fields
                                  validated against InvoiceFulfillmentTargetAPI v2.0.0.
                                </div>
                              ) : (
                                liveRun?.validation?.errors.map((e, i) => (
                                  <div key={i} className="text-rose-300">
                                    • {e.message}
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 2: Structural Diff */}
                {sandboxTab === "diff" && (
                  <div className="p-5">
                    <div className="max-h-[268px] overflow-y-auto divide-y divide-white/[0.06] border border-white/[0.08] rounded-xl bg-[#090807]">
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

                {/* Tab 3: Generated Adapter.ts */}
                {sandboxTab === "adapter" && (
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-zinc-400">
                        Standalone TypeScript adapter (zero dynamic eval)
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyAdapter}
                        className="text-[11px] font-medium px-3 py-1 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-zinc-100 border border-white/[0.1] transition"
                      >
                        {copiedAdapter ? "Copied ✓" : "Copy .ts"}
                      </button>
                    </div>
                    <pre className="max-h-[234px] overflow-auto bg-[#090807] border border-white/[0.08] rounded-xl p-3.5 font-mono text-[11px] text-[#e6dfd3] leading-relaxed">
                      {liveCompiled.adapterCode}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Floating Workspaces Glass Card */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 relative z-10">
          <div className="apple-glass rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white tracking-tight">Workspaces</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Resume a compatibility project or initialize a fresh contract pair.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/projects"
                  className="text-xs font-medium text-zinc-300 hover:text-white px-3.5 py-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] transition"
                >
                  View all →
                </Link>
                <Link
                  href="/projects/new"
                  className="champagne-pill text-xs font-semibold px-3.5 py-1.5 rounded-full transition"
                >
                  + New Workspace
                </Link>
              </div>
            </div>

            <div className="divide-y divide-white/[0.06]">
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
                    className="text-[#f3e7d3] hover:underline font-medium"
                  >
                    Launch the canonical e-commerce workspace →
                  </button>
                </div>
              ) : (
                projects.map((p, i) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.03] transition group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono shrink-0 border ${
                          i % 2 === 0
                            ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-300"
                            : "bg-indigo-500/15 border-indigo-500/25 text-indigo-300"
                        }`}
                      >
                        {i % 2 === 0 ? "⇄" : "◈"}
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-medium text-zinc-100 group-hover:text-white transition truncate">
                            {p.name}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-400 bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 rounded-full">
                            {p.id}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 truncate">
                          {p.description || "API contract diff, review, and adapter compilation workspace"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 text-xs">
                      <span className="font-mono text-[11px] text-zinc-500">
                        {new Date(p.updated_at).toLocaleDateString()}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-zinc-300 group-hover:text-white font-medium transition">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Open
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
