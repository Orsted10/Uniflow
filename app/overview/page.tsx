"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shell/topbar";
import { HeroBackdrop } from "@/components/ui/hero-backdrop";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Project } from "@/lib/supabase/models";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ProjectState } from "@/lib/store/project-store";

interface CloudServices {
  supabase: { configured: boolean; status: string; endpoint?: string | null };
  groq: { configured: boolean; status: string; model: string };
  azureBlob: { configured: boolean; status: string; accountName?: string | null; containerName?: string };
  azureSql: { configured: boolean; status: string; server?: string | null; database?: string | null };
}

interface HydratedWorkspaceSummary {
  project: Project;
  state: ProjectState | null;
}

export default function OverviewDashboardPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [workspaces, setWorkspaces] = React.useState<HydratedWorkspaceSummary[]>([]);
  const [cloud, setCloud] = React.useState<CloudServices | null>(null);
  const [cloudLatencyMs, setCloudLatencyMs] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [runningQuickMigrate, setRunningQuickMigrate] = React.useState(false);
  const [statusError, setStatusError] = React.useState<string | null>(null);

  const loadAllTelemetry = React.useCallback(async () => {
    setSyncing(true);
    try {
      const t0 = performance.now();
      const [projRes, cloudRes] = await Promise.all([
        fetch("/api/projects", { cache: "no-store" }),
        fetch("/api/cloud/status", { cache: "no-store" }),
      ]);

      if (cloudRes.ok) {
        const cloudData = await cloudRes.json();
        if (cloudData?.services) {
          setCloud(cloudData.services);
          setCloudLatencyMs(Math.round(performance.now() - t0));
        }
      }

      if (projRes.ok) {
        const projData = await projRes.json();
        const projectList: Project[] = Array.isArray(projData?.projects)
          ? projData.projects
          : [];

        const detailed = await Promise.all(
          projectList.map(async (p) => {
            try {
              const stRes = await fetch(`/api/projects/${p.id}`, { cache: "no-store" });
              if (stRes.ok) {
                const stJson = await stRes.json();
                return { project: p, state: stJson.state || null };
              }
            } catch {
              // ignore individual state fetch error
            }
            return { project: p, state: null };
          })
        );
        setWorkspaces(detailed);
      }
    } catch {
      // keep existing UI state
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  React.useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        setUserEmail(user?.email || null);
      });
    }
    loadAllTelemetry();
  }, [loadAllTelemetry]);

  async function handleOneClickFullMigration() {
    setRunningQuickMigrate(true);
    setStatusError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Billing API → Invoice Fulfillment (Verified AI)",
          description:
            "End-to-end compatibility migration with Groq AI proposals, zero-eval TypeScript adapter, and Azure ledger evidence.",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.project?.id) {
        throw new Error(data?.error || "Could not create workspace.");
      }

      const newId = data.project.id;
      const { CANONICAL_SOURCE_SPEC, CANONICAL_TARGET_SPEC } = await import(
        "@/lib/specs/fixtures"
      );

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

      await fetch(`/api/projects/${newId}/mappings/propose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowFallbackOnFailure: true }),
      });

      router.push(`/projects/${newId}`);
    } catch (err: unknown) {
      setStatusError(err instanceof Error ? err.message : String(err));
      setRunningQuickMigrate(false);
    }
  }

  // Real aggregated live metrics derived strictly from user's real workspaces
  const aggregate = React.useMemo(() => {
    let totalDiffs = 0;
    let totalApproved = 0;
    let totalMappings = 0;
    let compiledCount = 0;
    let certifiedCount = 0;

    for (const w of workspaces) {
      const st = w.state;
      if (!st) continue;
      if (st.diff) totalDiffs += st.diff.items.length;
      if (Array.isArray(st.mappings)) {
        totalMappings += st.mappings.length;
        totalApproved += st.mappings.filter(
          (m) => m.status === "accepted" || m.status === "edited"
        ).length;
      }
      if (st.plan) compiledCount++;
      if (st.report?.data) certifiedCount++;
    }

    return {
      totalDiffs,
      totalApproved,
      totalMappings,
      compiledCount,
      certifiedCount,
    };
  }, [workspaces]);

  // Real dynamic activity stream pulled from real workspaces & audit trails
  const liveEvents = React.useMemo(() => {
    const events: Array<{
      id: string;
      project: string;
      projectId: string;
      title: string;
      detail: string;
      time: string;
      badge: string;
      badgeColor: string;
    }> = [];

    for (const w of workspaces) {
      const st = w.state;
      if (st?.report?.data) {
        events.push({
          id: `rep-${w.project.id}`,
          project: w.project.name,
          projectId: w.project.id,
          title: `Report ${st.report.data.status} (${st.report.data.summary.compatibilityScore}%)`,
          detail: st.report.data.cloudEvidence?.azureSqlRunId
            ? `Azure SQL Run: ${st.report.data.cloudEvidence.azureSqlRunId}`
            : `Source SHA-256: ${st.report.data.checksums.sourceSchemaHash.slice(0, 12)}...`,
          time: st.report.data.generatedAt,
          badge: "CERTIFIED",
          badgeColor: "text-emerald-300 bg-emerald-500/15 border-emerald-400/30",
        });
      } else if (st?.plan) {
        events.push({
          id: `plan-${w.project.id}`,
          project: w.project.name,
          projectId: w.project.id,
          title: `Compiled Plan '${st.plan.planId}' (${st.plan.steps.length} IR steps)`,
          detail: st.adapter
            ? "Standalone TypeScript adapter ready"
            : "Ready for interpreter fixture execution",
          time: st.plan.compiledAt,
          badge: "COMPILED",
          badgeColor: "text-violet-300 bg-violet-500/15 border-violet-400/30",
        });
      } else if (st?.mappings && st.mappings.length > 0) {
        const latestDecision = st.mappings[0]?.decisionHistory?.slice(-1)[0];
        events.push({
          id: `map-${w.project.id}`,
          project: w.project.name,
          projectId: w.project.id,
          title: `${st.mappings.length} Candidate Mappings Generated`,
          detail: latestDecision?.note || "Waiting for human gate review",
          time: latestDecision?.timestamp || w.project.updated_at,
          badge: st.mappings[0]?.provider === "groq" ? "GROQ AI" : "HEURISTIC",
          badgeColor: "text-amber-300 bg-amber-500/15 border-amber-400/30",
        });
      } else {
        events.push({
          id: `proj-${w.project.id}`,
          project: w.project.name,
          projectId: w.project.id,
          title: "Workspace Initialized in PostgreSQL",
          detail: w.project.description || "Ready for OpenAPI / JSON Schema ingestion",
          time: w.project.updated_at,
          badge: "ACTIVE",
          badgeColor: "text-sky-300 bg-sky-500/15 border-sky-400/30",
        });
      }
    }

    return events.sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
    );
  }, [workspaces]);

  return (
    <div className="min-h-screen bg-[#090807] text-[#f5f2eb] flex flex-col font-sans relative overflow-x-hidden">
      <HeroBackdrop />
      <TopBar />

      <main className="relative z-10 max-w-[1680px] mx-auto px-6 sm:px-10 lg:px-12 py-10 w-full flex-1 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Breadcrumb items={[{ label: "Overview", current: true }]} />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={loadAllTelemetry}
              disabled={syncing}
              className="text-xs font-mono px-4 py-1.5 rounded-full bg-black/60 hover:bg-white/[0.1] border border-white/[0.14] text-zinc-200 transition disabled:opacity-50"
            >
              {syncing ? "↻ Syncing Telemetry..." : "↻ Refresh Telemetry"}
            </button>
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/[0.14] text-xs font-mono text-zinc-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
              <span>
                CERT-In &bull; DPDP Act 2023 &bull; PostgreSQL RLS
                {cloudLatencyMs !== null ? ` • ${cloudLatencyMs}ms` : ""}
              </span>
            </div>
          </div>
        </div>

        {statusError && (
          <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-sm">
            {statusError}
          </div>
        )}

        {/* Dynamic Command Header */}
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 pb-6 border-b border-white/[0.1]">
          <div className="space-y-3">
            <h1 className="font-editorial text-[48px] sm:text-[60px] font-normal tracking-[-0.025em] text-[#fdfaf5] leading-[1.02] drop-shadow-[0_4px_24px_rgba(0,0,0,0.75)]">
              Live migration{" "}
              <span className="relative inline-block">
                <span className="font-brush text-[58px] sm:text-[68px] text-[#f4845f] font-bold tracking-normal leading-none pr-1">
                  pulse
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
              &amp; telemetry.
            </h1>
            <p className="text-base sm:text-lg text-[#ebe3d8] max-w-2xl leading-relaxed">
              {userEmail ? (
                <>
                  Live tenant console for <span className="font-mono text-[#f5dfb8]">{userEmail}</span>. Every card below reflects real PostgreSQL records, Groq AI reviews, and compiled adapters.
                </>
              ) : (
                "Live tenant console reflecting real PostgreSQL records, Groq AI reviews, and compiled adapters."
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3.5">
            <button
              type="button"
              onClick={handleOneClickFullMigration}
              disabled={runningQuickMigrate}
              className="inline-flex items-center gap-2 text-sm sm:text-[15px] font-semibold px-6 py-3.5 rounded-full border border-violet-400/45 bg-violet-500/20 hover:bg-violet-500/30 text-violet-100 backdrop-blur-md transition disabled:opacity-50"
            >
              <span>✨</span>
              <span>
                {runningQuickMigrate
                  ? "Generating Groq AI Migration..."
                  : "Launch New AI Migration"}
              </span>
            </button>
            <Link
              href="/projects/new"
              className="champagne-pill inline-flex items-center gap-2 text-sm sm:text-[15px] font-semibold px-7 py-3.5 rounded-full transition"
            >
              + New Custom Project
            </Link>
          </div>
        </div>

        {/* Live Telemetry & Cloud Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="apple-glass rounded-2xl p-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-mono text-zinc-400">Active Workspaces</div>
              <div className="text-2xl font-bold text-white mt-1">
                {workspaces.length}
              </div>
              <div className="text-xs text-emerald-300 mt-0.5 font-mono">
                {aggregate.certifiedCount} certified reports
              </div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-300 text-lg">
              ↗
            </div>
          </div>

          <div className="apple-glass rounded-2xl p-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-mono text-zinc-400">Mapping Approvals</div>
              <div className="text-2xl font-bold text-white mt-1">
                {aggregate.totalApproved} / {aggregate.totalMappings}
              </div>
              <div className="text-xs text-violet-300 mt-0.5 font-mono">
                {aggregate.totalDiffs} structural diffs tracked
              </div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-violet-500/15 border border-violet-400/30 flex items-center justify-center text-violet-300 text-lg">
              ✨
            </div>
          </div>

          <div className="apple-glass rounded-2xl p-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-mono text-zinc-400">Compiled Adapters</div>
              <div className="text-2xl font-bold text-white mt-1">
                {aggregate.compiledCount}
              </div>
              <div className="text-xs text-amber-300 mt-0.5 font-mono">
                Groq: {cloud?.groq.configured ? cloud.groq.model : "Heuristic"}
              </div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-300 text-lg">
              ⚡
            </div>
          </div>

          <div className="apple-glass rounded-2xl p-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-mono text-zinc-400">Azure Cloud Evidence</div>
              <div className="text-lg font-bold text-white mt-1 truncate max-w-[180px]">
                {cloud?.azureSql.configured ? cloud.azureSql.database : "Simulated"}
              </div>
              <div className="text-xs text-teal-300 mt-0.5 font-mono truncate max-w-[180px]">
                Blob: {cloud?.azureBlob.configured ? cloud.azureBlob.containerName : "In-Memory"}
              </div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-teal-500/15 border border-teal-400/30 flex items-center justify-center text-teal-300 text-lg">
              ☁
            </div>
          </div>
        </div>

        {/* Main 2-Column Dynamic Workspace Matrix + Live Audit Feed */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left 8 cols: Dynamic Workspace Health Matrix */}
          <div className="xl:col-span-8 apple-glass rounded-3xl overflow-hidden">
            <div className="px-7 py-5 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white tracking-tight">
                  Workspace Migration Matrix
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                  Real-time progress, contract pair checksums, and next recommended action per project.
                </p>
              </div>
              <Link
                href="/projects"
                className="text-xs sm:text-sm font-medium text-[#f5dfb8] hover:underline"
              >
                Manage all workspaces →
              </Link>
            </div>

            {loading ? (
              <div className="p-8 space-y-4">
                <div className="h-24 bg-white/[0.04] rounded-2xl animate-pulse" />
                <div className="h-24 bg-white/[0.04] rounded-2xl animate-pulse" />
              </div>
            ) : workspaces.length === 0 ? (
              <div className="p-12 text-center space-y-4">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-2xl text-[#f5dfb8]">
                  ∿
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-white">No Live Workspaces Yet</h3>
                  <p className="text-sm text-zinc-400 max-w-md mx-auto">
                    Initialize your first compatibility migration with Groq AI proposals in one click.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOneClickFullMigration}
                  disabled={runningQuickMigrate}
                  className="champagne-pill inline-flex items-center gap-2 text-sm font-semibold px-7 py-3 rounded-full transition"
                >
                  {runningQuickMigrate ? "Initializing..." : "✨ Launch First AI Migration →"}
                </button>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.08]">
                {workspaces.map(({ project: p, state: st }) => {
                  const hasSpecs = Boolean(st?.specs?.source && st?.specs?.target);
                  const totalMap = st?.mappings?.length || 0;
                  const approvedMap =
                    st?.mappings?.filter(
                      (m) => m.status === "accepted" || m.status === "edited"
                    ).length || 0;
                  const hasPlan = Boolean(st?.plan);
                  const hasAdapter = Boolean(st?.adapter?.code);
                  const hasReport = Boolean(st?.report?.data);

                  const completedSteps = [
                    Boolean(st?.specs?.source),
                    Boolean(st?.diff),
                    totalMap > 0,
                    approvedMap > 0 && approvedMap === totalMap,
                    hasPlan && hasAdapter,
                    hasReport,
                  ].filter(Boolean).length;

                  const nextLabel = !hasSpecs
                    ? "Import Specs →"
                    : totalMap === 0
                    ? "Propose Mappings →"
                    : approvedMap < totalMap
                    ? `Approve ${totalMap - approvedMap} Mappings →`
                    : !hasPlan || !hasAdapter
                    ? "Compile & Execute →"
                    : !hasReport
                    ? "Certify Report →"
                    : "Open Verified Studio →";

                  return (
                    <div
                      key={p.id}
                      className="p-6 sm:p-7 hover:bg-white/[0.025] transition space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <Link
                              href={`/projects/${p.id}`}
                              className="text-lg font-semibold text-white hover:text-[#f5dfb8] transition truncate"
                            >
                              {p.name}
                            </Link>
                            <span className="font-mono text-xs text-zinc-400 bg-white/[0.05] border border-white/[0.1] px-2.5 py-0.5 rounded-full">
                              {p.id.slice(0, 18)}
                            </span>
                          </div>
                          <p className="text-sm text-zinc-300 truncate">
                            {st?.specs?.source?.normalized?.title &&
                            st?.specs?.target?.normalized?.title
                              ? `${st.specs.source.normalized.title} ──▶ ${st.specs.target.normalized.title}`
                              : p.description || "Ready for OpenAPI / JSON Schema ingestion"}
                          </p>
                        </div>

                        <Link
                          href={`/projects/${p.id}`}
                          className="champagne-pill inline-flex items-center gap-2 text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-full shrink-0 transition"
                        >
                          {nextLabel}
                        </Link>
                      </div>

                      {/* Real 6-Stage Progress Indicators */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                          <span
                            className={`px-2.5 py-1 rounded-full border ${
                              hasSpecs
                                ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/30"
                                : "bg-white/[0.04] text-zinc-500 border-white/[0.08]"
                            }`}
                          >
                            {hasSpecs ? "✓ Specs" : "• Specs"}
                          </span>
                          <span
                            className={`px-2.5 py-1 rounded-full border ${
                              st?.diff
                                ? "bg-sky-500/15 text-sky-300 border-sky-400/30"
                                : "bg-white/[0.04] text-zinc-500 border-white/[0.08]"
                            }`}
                          >
                            {st?.diff ? `${st.diff.items.length} Diffs` : "• Diff"}
                          </span>
                          <span
                            className={`px-2.5 py-1 rounded-full border ${
                              totalMap > 0
                                ? approvedMap === totalMap
                                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/30"
                                  : "bg-amber-500/15 text-amber-300 border-amber-400/30"
                                : "bg-white/[0.04] text-zinc-500 border-white/[0.08]"
                            }`}
                          >
                            {totalMap > 0
                              ? `${approvedMap}/${totalMap} Approved`
                              : "• Review"}
                          </span>
                          <span
                            className={`px-2.5 py-1 rounded-full border ${
                              hasPlan
                                ? "bg-violet-500/15 text-violet-300 border-violet-400/30"
                                : "bg-white/[0.04] text-zinc-500 border-white/[0.08]"
                            }`}
                          >
                            {hasPlan ? `IR: ${st?.plan?.steps.length} steps` : "• Plan"}
                          </span>
                          <span
                            className={`px-2.5 py-1 rounded-full border ${
                              hasReport
                                ? "bg-teal-500/15 text-teal-300 border-teal-400/30"
                                : "bg-white/[0.04] text-zinc-500 border-white/[0.08]"
                            }`}
                          >
                            {hasReport
                              ? `${st?.report?.data?.summary.compatibilityScore}% Certified`
                              : "• Report"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5 min-w-[140px]">
                          <div className="flex-1 h-2 rounded-full bg-white/[0.08] overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#f4845f] to-emerald-400 rounded-full transition-all duration-300"
                              style={{ width: `${Math.round((completedSteps / 6) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-zinc-300">
                            {completedSteps}/6
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right 4 cols: Real Live Activity & Provenance Feed */}
          <div className="xl:col-span-4 apple-glass rounded-3xl overflow-hidden">
            <div className="px-6 py-5 border-b border-white/[0.08]">
              <h2 className="text-lg font-semibold text-white tracking-tight">
                Live Audit &amp; Provenance Stream
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Computed directly from active specs, Groq runs, and Azure evidence.
              </p>
            </div>

            <div className="p-5 space-y-3 max-h-[540px] overflow-y-auto">
              {loading ? (
                <div className="h-24 bg-white/[0.04] rounded-2xl animate-pulse" />
              ) : liveEvents.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-8">
                  Activity appears here as soon as you create a workspace or compile contracts.
                </p>
              ) : (
                liveEvents.map((ev) => (
                  <Link
                    key={ev.id}
                    href={`/projects/${ev.projectId}`}
                    className="block p-4 rounded-2xl bg-black/45 border border-white/[0.08] hover:border-[#f5dfb8]/35 transition space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border ${ev.badgeColor}`}>
                        {ev.badge}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-500">
                        {new Date(ev.time).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-white truncate">
                      {ev.title}
                    </div>
                    <div className="text-xs text-zinc-400 truncate">
                      {ev.project} &bull; {ev.detail}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
