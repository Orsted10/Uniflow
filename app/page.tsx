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

function HighlightedJson({ value }: { value: unknown }) {
  const json = JSON.stringify(value, null, 2);
  const lines = json.split("\n");

  return (
    <div className="font-mono text-xs leading-relaxed">
      {lines.map((line, i) => {
        const keyMatch = line.match(/^(\s*)"([^"]+)"(\s*:\s*)(.*)$/);
        if (keyMatch) {
          const [, indent, key, colon, rest] = keyMatch;
          let valColor = "text-zinc-200";
          if (rest.startsWith('"')) valColor = "text-emerald-300";
          else if (/^-?\d/.test(rest)) valColor = "text-sky-300";
          else if (rest.startsWith("true") || rest.startsWith("false") || rest.startsWith("null"))
            valColor = "text-amber-300";

          return (
            <div key={i} className="whitespace-pre">
              <span>{indent}</span>
              <span className="text-[#f5dfb8]">&quot;{key}&quot;</span>
              <span className="text-zinc-500">{colon}</span>
              <span className={valColor}>{rest}</span>
            </div>
          );
        }
        return (
          <div key={i} className="whitespace-pre text-zinc-500">
            {line}
          </div>
        );
      })}
    </div>
  );
}

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
  const [compileNonce, setCompileNonce] = React.useState(0);
  const [hoveredStep, setHoveredStep] = React.useState<string | null>(null);

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

  const liveCompiled = React.useMemo(() => {
    const sourceNorm = normalizeSpecification(parseSpecificationText(CANONICAL_SOURCE_SPEC), "source");
    const targetNorm = normalizeSpecification(parseSpecificationText(CANONICAL_TARGET_SPEC), "target");
    const diff = computeStructuralDiff(sourceNorm, targetNorm);

    const approvedMappings = generateBaselineMappings(diff, sourceNorm, targetNorm).map((m) => {
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

  const liveRun = React.useMemo(() => {
    if (!liveCompiled.plan) return null;
    const t0 = typeof performance !== "undefined" ? performance.now() : 0;
    try {
      const parsedInput = JSON.parse(payloadText) as Record<string, unknown>;
      const exec = executeTransformationPlan(liveCompiled.plan, parsedInput);
      const validation = validateAgainstTargetSchema(exec.outputPayload, liveCompiled.targetNorm);
      const elapsedMs = typeof performance !== "undefined" ? Math.max(0.2, performance.now() - t0) : 0.6;
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
          description:
            "Legacy integer-based billing order contract adapted to the string-based invoice fulfillment microservice.",
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
    setCompileNonce((n) => n + 1);
  }

  function handlePayloadEdit(val: string) {
    setPayloadText(val);
    setCompileNonce((n) => n + 1);
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
    <div className="min-h-screen bg-[#090807] text-[#f5f2eb] flex flex-col font-sans relative overflow-x-hidden">
      {/* Supplied Warm Photographic Developer Desk Foundation */}
      <HeroBackdrop />

      <TopBar />

      <main className="flex-1 relative z-10 flex flex-col justify-between">
        {/* Hero & Live JSON Execution Workbench */}
        <section className="max-w-[1440px] w-full mx-auto px-5 sm:px-8 lg:px-10 pt-8 pb-6 lg:pt-12 lg:pb-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            {/* Left Column: Editorial Headline + Hand-Drawn Coral Brush + Tactile Capability Cards */}
            <div className="lg:col-span-5 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/55 backdrop-blur-md border border-white/[0.12] text-[11px] font-mono text-zinc-300">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>UNIFLOW v1.2.0</span>
                <span className="text-zinc-600">&bull;</span>
                <span className="text-emerald-400">Live</span>
              </div>

              <h1 className="font-editorial text-[46px] sm:text-[56px] xl:text-[64px] font-normal tracking-[-0.02em] text-[#fdfaf5] leading-[1.02] drop-shadow-[0_2px_18px_rgba(0,0,0,0.65)]">
                Compile breaking API migrations into{" "}
                <span className="relative inline-block">
                  <span className="font-brush text-[54px] sm:text-[64px] xl:text-[74px] text-[#f4845f] font-bold tracking-normal leading-none pr-1">
                    verified
                  </span>
                  {/* Subtle hand-drawn brush underline */}
                  <svg
                    viewBox="0 0 180 14"
                    fill="none"
                    aria-hidden="true"
                    className="absolute -bottom-1 left-0 w-full h-3 text-[#f4845f]/85"
                  >
                    <path
                      d="M3 10.5C45 4.2 118 2.8 176 7.5"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>{" "}
                adapters.
              </h1>

              <p className="text-[15px] text-[#e5ddd2] leading-[1.6] max-w-md drop-shadow-[0_1px_10px_rgba(0,0,0,0.8)]">
                Compare OpenAPI 3.x and JSON Schemas with deterministic 9-facet diffs, review Groq
                AI mapping proposals behind human gates, and ship zero-eval TypeScript adapters
                backed by Azure SQL &amp; Blob evidence.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={launchCanonicalWorkspace}
                  disabled={launchingSandbox}
                  className="champagne-pill inline-flex items-center justify-center gap-2 text-xs sm:text-[13px] font-semibold px-6 py-3 rounded-full disabled:opacity-60 transition-all duration-200"
                >
                  <span>{launchingSandbox ? "Initializing..." : "Launch Live Workbench"}</span>
                  <span aria-hidden="true">→</span>
                </button>
                <Link
                  href="/projects/new"
                  className="inline-flex items-center justify-center gap-2 text-xs sm:text-[13px] font-medium px-6 py-3 rounded-full border border-white/[0.18] bg-black/55 text-zinc-100 hover:bg-black/75 hover:border-white/[0.3] transition-all duration-200 backdrop-blur-xl"
                >
                  <span>+ New Custom Project</span>
                </Link>
              </div>

              {/* Capability Cards with Rich Amber, Teal & Muted Violet Accents */}
              <div className="pt-2 grid grid-cols-3 gap-3 max-w-md">
                <div className="apple-glass rounded-2xl px-3.5 py-3 hover:border-amber-400/40 hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-300 text-xs shrink-0">
                    ⚡
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white leading-tight">Zero Eval</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">Sandboxed IR</div>
                  </div>
                </div>

                <div className="apple-glass rounded-2xl px-3.5 py-3 hover:border-teal-400/40 hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-teal-500/15 border border-teal-400/30 flex items-center justify-center text-teal-300 text-xs shrink-0">
                    ✓
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white leading-tight">100%</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">Type-Safe</div>
                  </div>
                </div>

                <div className="apple-glass rounded-2xl px-3.5 py-3 hover:border-violet-400/40 hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-400/30 flex items-center justify-center text-violet-300 text-xs shrink-0">
                    ☁
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white leading-tight">Multi-Cloud</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">Azure + Supabase</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: JSON Execution Workbench */}
            <div className="lg:col-span-7 apple-glass rounded-2xl overflow-hidden">
              {/* macOS Chrome + Segmented Tabs */}
              <div className="px-4 py-3 bg-white/[0.04] border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                  <span className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                  <span className="w-3 h-3 rounded-full bg-[#27c93f]" />
                </div>

                <div className="flex items-center p-0.5 rounded-full bg-black/60 border border-white/[0.1] text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setSandboxTab("execute")}
                    className={`px-4 py-1 rounded-full transition-all duration-150 ${
                      sandboxTab === "execute"
                        ? "bg-[#f3e7d3] text-[#141210] font-semibold shadow-sm"
                        : "text-zinc-400 hover:text-zinc-100"
                    }`}
                  >
                    Execution
                  </button>
                  <button
                    type="button"
                    onClick={() => setSandboxTab("diff")}
                    className={`px-4 py-1 rounded-full transition-all duration-150 ${
                      sandboxTab === "diff"
                        ? "bg-[#f3e7d3] text-[#141210] font-semibold shadow-sm"
                        : "text-zinc-400 hover:text-zinc-100"
                    }`}
                  >
                    Diff ({liveCompiled.diff.items.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSandboxTab("adapter")}
                    className={`px-4 py-1 rounded-full transition-all duration-150 ${
                      sandboxTab === "adapter"
                        ? "bg-[#f3e7d3] text-[#141210] font-semibold shadow-sm"
                        : "text-zinc-400 hover:text-zinc-100"
                    }`}
                  >
                    Adapters
                  </button>
                </div>

                <div className="hidden sm:flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-zinc-400">v1.2.0</span>
                  <span className="text-emerald-400 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </span>
                </div>
              </div>

              {/* Subtle compiler progress beam */}
              <div className="relative h-[2px] w-full bg-white/[0.04] overflow-hidden">
                <div
                  className={`animate-beam h-full w-1/3 ${
                    isAllValid
                      ? "bg-gradient-to-r from-transparent via-teal-400 to-transparent"
                      : "bg-gradient-to-r from-transparent via-rose-400 to-transparent"
                  }`}
                />
              </div>

              {/* Tab 1: Execution */}
              {sandboxTab === "execute" && (
                <div className="p-4 sm:p-5 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                      {[
                        { id: "id", label: "id → order_id" },
                        { id: "amount", label: "amount → total" },
                        { id: "currency", label: "USD → usd" },
                        { id: "region", label: "+ region" },
                      ].map((chip) => (
                        <span
                          key={chip.id}
                          onMouseEnter={() => setHoveredStep(chip.id)}
                          onMouseLeave={() => setHoveredStep(null)}
                          className={`px-2.5 py-0.5 rounded-full border transition cursor-default ${
                            hoveredStep === chip.id
                              ? "bg-[#f4845f]/20 text-[#f9a88b] border-[#f4845f]/40"
                              : "bg-black/45 text-zinc-300 border-white/[0.09]"
                          }`}
                        >
                          {chip.label}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {CANONICAL_TEST_FIXTURES.map((f, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectFixture(idx)}
                          className={`text-[11px] font-mono px-3 py-1 rounded-full border transition-all ${
                            fixtureIdx === idx
                              ? f.expectValid
                                ? "bg-violet-600/80 text-white border-violet-400/50 shadow-sm"
                                : "bg-rose-600/75 text-white border-rose-400/50 shadow-sm"
                              : "bg-black/45 text-zinc-400 border-white/[0.09] hover:text-white"
                          }`}
                        >
                          {f.expectValid ? `Fixture ${idx + 1}` : `Invalid ${idx + 1}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left Source JSON Pane */}
                    <div className="bg-[#090807]/95 border border-white/[0.1] rounded-xl overflow-hidden flex flex-col">
                      <div className="px-3.5 py-2.5 border-b border-white/[0.07] bg-white/[0.03] flex items-center justify-between text-xs">
                        <span className="font-mono text-zinc-200 flex items-center gap-2">
                          <span className="text-amber-300">{"{}"}</span> Source JSON Input
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyInput}
                          className="text-[11px] font-mono text-zinc-400 hover:text-white transition"
                        >
                          {copiedInput ? "Copied ✓" : "Copy"}
                        </button>
                      </div>

                      <div className="flex flex-1 p-3.5 font-mono text-xs leading-relaxed min-h-[250px]">
                        <div
                          aria-hidden="true"
                          className="select-none text-zinc-600 pr-3 text-right border-r border-white/[0.06] mr-3 shrink-0"
                        >
                          {inputLines.map((_, i) => (
                            <div key={i}>{i + 1}</div>
                          ))}
                        </div>
                        <textarea
                          value={payloadText}
                          onChange={(e) => handlePayloadEdit(e.target.value)}
                          spellCheck={false}
                          rows={Math.max(10, inputLines.length)}
                          aria-label="Source JSON payload"
                          className="w-full bg-transparent text-[#f5dfb8] focus:outline-none resize-none leading-relaxed"
                        />
                      </div>
                    </div>

                    {/* Right Output & Verification Pane */}
                    <div
                      key={compileNonce}
                      className="animate-compile-flash bg-[#090807]/95 border border-white/[0.1] rounded-xl overflow-hidden flex flex-col"
                    >
                      <div
                        className={`px-3.5 py-2.5 border-b flex items-center justify-between text-xs ${
                          isAllValid
                            ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-300"
                            : "bg-rose-500/15 border-rose-500/25 text-rose-300"
                        }`}
                      >
                        <span className="font-semibold flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isAllValid ? "bg-emerald-400" : "bg-rose-400"
                            }`}
                          />
                          <span>
                            {isAllValid
                              ? "Compilation Successful"
                              : liveRun?.parseError
                              ? "JSON Syntax Error"
                              : "Contract Violation"}
                          </span>
                        </span>
                        <span className="font-mono text-[11px] font-semibold">
                          {liveRun?.elapsedMs || "0.2"}ms ⚡
                        </span>
                      </div>

                      <div className="px-3.5 pt-2.5 border-b border-white/[0.07] flex items-center gap-5 text-xs">
                        <button
                          type="button"
                          onClick={() => setOutputSubTab("output")}
                          className={`pb-2 border-b-2 transition ${
                            outputSubTab === "output"
                              ? "border-[#f3e7d3] text-white font-semibold"
                              : "border-transparent text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          Output
                        </button>
                        <button
                          type="button"
                          onClick={() => setOutputSubTab("steps")}
                          className={`pb-2 border-b-2 transition ${
                            outputSubTab === "steps"
                              ? "border-[#f3e7d3] text-white font-semibold"
                              : "border-transparent text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          Steps ({liveRun?.exec?.stepResults.length || 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => setOutputSubTab("details")}
                          className={`pb-2 border-b-2 transition ${
                            outputSubTab === "details"
                              ? "border-[#f3e7d3] text-white font-semibold"
                              : "border-transparent text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          Validation
                        </button>
                      </div>

                      <div className="p-3.5 flex-1 overflow-auto max-h-[225px] font-mono text-xs">
                        {outputSubTab === "output" && (
                          <>
                            {liveRun?.parseError ? (
                              <p className="text-rose-300">{liveRun.parseError}</p>
                            ) : liveRun?.exec?.success ? (
                              <HighlightedJson value={liveRun.exec.outputPayload} />
                            ) : (
                              <p className="text-rose-300 leading-relaxed">{liveRun?.exec?.error}</p>
                            )}
                          </>
                        )}

                        {outputSubTab === "steps" && (
                          <div className="space-y-2">
                            {liveRun?.exec?.stepResults.map((s) => (
                              <div
                                key={s.stepId}
                                className="flex items-center justify-between text-[11px] py-1.5 border-b border-white/[0.05]"
                              >
                                <span className="text-zinc-200 truncate pr-2">
                                  <span className="text-amber-300">{s.operation}</span> → {s.targetPath}
                                </span>
                                <span
                                  className={`font-semibold ${
                                    s.success ? "text-emerald-400" : "text-rose-400"
                                  }`}
                                >
                                  {s.success ? "OK" : "FAIL"}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {outputSubTab === "details" && (
                          <div className="space-y-2 text-[11px]">
                            {liveRun?.validation?.valid ? (
                              <div className="text-emerald-300 leading-relaxed">
                                ✓ All {liveRun.validation.checkedFieldCount} target contract fields
                                validated against InvoiceFulfillmentTargetAPI v2.0.0.
                              </div>
                            ) : (
                              liveRun?.validation?.errors.map((e, i) => (
                                <div key={i} className="text-rose-300 leading-relaxed">
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

              {/* Tab 2: Diff */}
              {sandboxTab === "diff" && (
                <div className="p-5">
                  <div className="max-h-[310px] overflow-y-auto divide-y divide-white/[0.06] border border-white/[0.09] rounded-xl bg-[#090807]/95">
                    {liveCompiled.diff.items.map((item) => (
                      <div key={item.id} className="p-3.5 flex items-start justify-between gap-3 text-xs">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 font-mono text-xs">
                            <span className="text-zinc-400 truncate">
                              {item.sourcePath || "(none)"}
                            </span>
                            <span className="text-teal-400">→</span>
                            <span className="text-[#f5dfb8] font-semibold truncate">{item.targetPath}</span>
                          </div>
                          <p className="text-[11px] text-zinc-400">{item.message}</p>
                        </div>
                        <span
                          className={`shrink-0 font-mono text-[10px] px-2.5 py-0.5 rounded-full border ${
                            item.severity === "error"
                              ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                              : item.severity === "warning"
                              ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                              : "bg-white/[0.06] text-zinc-300 border-white/[0.12]"
                          }`}
                        >
                          {item.category}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 3: Adapters */}
              {sandboxTab === "adapter" && (
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-zinc-300">
                      Standalone TypeScript adapter (zero dynamic eval)
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyAdapter}
                      className="text-xs font-medium px-3.5 py-1 rounded-full bg-white/[0.09] hover:bg-white/[0.16] text-white border border-white/[0.12] transition"
                    >
                      {copiedAdapter ? "Copied ✓" : "Copy .ts"}
                    </button>
                  </div>
                  <pre className="max-h-[270px] overflow-auto bg-[#090807]/95 border border-white/[0.09] rounded-xl p-4 font-mono text-xs text-[#f3eadc] leading-relaxed">
                    {liveCompiled.adapterCode}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Active Workspaces Glass Dock */}
        <section className="max-w-[1440px] w-full mx-auto px-5 sm:px-8 lg:px-10 pb-8 pt-2">
          <div className="apple-glass rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-400/30 flex items-center justify-center text-violet-300 text-sm shrink-0">
                  ∿
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white tracking-tight">Active Workspaces</h2>
                  <p className="text-xs text-zinc-400">
                    Resume a compatibility project or initialize a fresh contract pair.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <Link
                  href="/projects"
                  className="text-xs font-medium text-zinc-200 hover:text-white px-4 py-1.5 rounded-full border border-white/[0.12] bg-white/[0.05] hover:bg-white/[0.1] transition"
                >
                  View all →
                </Link>
                <Link
                  href="/projects/new"
                  className="champagne-pill text-xs font-semibold px-4 py-1.5 rounded-full transition"
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
                <div className="p-8 text-center text-xs text-zinc-400">
                  No workspaces yet.{" "}
                  <button
                    type="button"
                    onClick={launchCanonicalWorkspace}
                    className="text-[#f4845f] hover:underline font-medium"
                  >
                    Launch the canonical e-commerce workspace →
                  </button>
                </div>
              ) : (
                projects.map((p, i) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.04] transition group"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-mono shrink-0 border transition-transform duration-200 group-hover:scale-105 ${
                          i % 2 === 0
                            ? "bg-teal-500/15 border-teal-400/30 text-teal-300"
                            : "bg-violet-500/15 border-violet-400/30 text-violet-300"
                        }`}
                      >
                        {i % 2 === 0 ? "↗" : "⚡"}
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-semibold text-zinc-100 group-hover:text-[#f5dfb8] transition truncate">
                            {p.name}
                          </span>
                          <span className="font-mono text-[11px] text-zinc-400 bg-white/[0.05] border border-white/[0.09] px-2.5 py-0.5 rounded-full">
                            {p.id}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 truncate">
                          {p.description || "API contract diff, review, and adapter compilation workspace"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-5 shrink-0 text-xs">
                      <span className="font-mono text-xs text-zinc-400">
                        {new Date(p.updated_at).toLocaleDateString()}
                      </span>
                      <span className="inline-flex items-center gap-2 text-zinc-200 group-hover:text-white font-medium px-3 py-1 rounded-full bg-white/[0.05] group-hover:bg-white/[0.12] border border-white/[0.1] transition">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                        Open →
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
