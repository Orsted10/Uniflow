"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { CommandPalette } from "@/components/ui/command-palette";
import { Project } from "@/lib/supabase/models";

interface CloudServices {
  supabase: { configured: boolean; status: string; endpoint?: string | null };
  groq: { configured: boolean; status: string; model: string };
  azureBlob: { configured: boolean; status: string; accountName?: string | null; containerName?: string };
  azureSql: { configured: boolean; status: string; server?: string | null; database?: string | null };
}

export function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = React.useState<CloudServices | null>(null);
  const [cloudLatencyMs, setCloudLatencyMs] = React.useState<number | null>(null);
  const [checkingCloud, setCheckingCloud] = React.useState(false);
  const [cloudPopoverOpen, setCloudPopoverOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [projects, setProjects] = React.useState<Project[]>([]);

  const refreshCloudStatus = React.useCallback(async () => {
    setCheckingCloud(true);
    const t0 = performance.now();
    try {
      const r = await fetch("/api/cloud/status", { cache: "no-store" });
      const data = await r.json();
      if (data?.services) {
        setCloudStatus(data.services);
        setCloudLatencyMs(Math.round(performance.now() - t0));
      }
    } catch {
      // keep previous state if offline
    } finally {
      setCheckingCloud(false);
    }
  }, []);

  React.useEffect(() => {
    refreshCloudStatus();

    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.projects)) setProjects(data.projects);
      })
      .catch(() => {});

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
        setCloudPopoverOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    const supabase = createSupabaseBrowserClient();
    let unsubscribe: (() => void) | undefined;
    if (supabase) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.email) setUserEmail(user.email);
      });
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setUserEmail(session?.user?.email || null);
      });
      unsubscribe = () => subscription.unsubscribe();
    }

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (unsubscribe) unsubscribe();
    };
  }, [refreshCloudStatus]);

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUserEmail(null);
    router.push("/login");
  }

  const activeCount = cloudStatus
    ? [
        cloudStatus.supabase.configured,
        cloudStatus.groq.configured,
        cloudStatus.azureSql.configured,
        cloudStatus.azureBlob.configured,
      ].filter(Boolean).length
    : 0;

  return (
    <>
      <header className="border-b border-white/[0.08] bg-[#090807]/75 backdrop-blur-2xl sticky top-0 z-50 text-zinc-100 shadow-[inset_0_-1px_0_0_rgba(255,244,224,0.04)]">
        <div className="max-w-[1440px] mx-auto px-5 sm:px-8 lg:px-10 h-14 flex items-center justify-between gap-4">
          {/* Brand & Segmented Nav */}
          <div className="flex items-center gap-5">
            <Link
              href="/"
              className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 rounded-lg px-1 transition group"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-b from-white/[0.14] to-white/[0.04] border border-white/[0.18] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)] flex items-center justify-center text-[#f5dfb8] group-hover:scale-105 transition-transform">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M4.5 12C4.5 9.5 6.5 7.5 9 7.5C11.5 7.5 12.5 10 14.5 12C16.5 14 17.5 16.5 20 16.5C21.38 16.5 22.5 15.38 22.5 14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle cx="4.5" cy="12" r="2" fill="currentColor" />
                </svg>
              </div>
              <span className="font-semibold tracking-[0.08em] text-xs text-white uppercase">
                UNIFLOW
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1 p-1 rounded-full bg-white/[0.04] border border-white/[0.07] text-xs font-medium shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
              <Link
                href="/"
                className={`px-3.5 py-1 rounded-full transition-all duration-150 ${
                  pathname === "/"
                    ? "bg-[#f3e7d3] text-[#141210] font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                Overview
              </Link>
              <Link
                href="/projects"
                className={`px-3.5 py-1 rounded-full transition-all duration-150 ${
                  pathname === "/projects"
                    ? "bg-[#f3e7d3] text-[#141210] font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                Workspaces
              </Link>
              <Link
                href="/projects/new"
                className={`px-3.5 py-1 rounded-full transition-all duration-150 ${
                  pathname === "/projects/new"
                    ? "bg-[#f3e7d3] text-[#141210] font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                New Project
              </Link>
            </nav>
          </div>

          {/* Center: Working ⌘K Command Palette Trigger */}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="hidden sm:flex items-center justify-between gap-6 px-3.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.09] hover:border-white/[0.16] text-xs text-zinc-400 hover:text-zinc-200 transition w-56 lg:w-72 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
          >
            <span className="flex items-center gap-2 truncate">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="M20 20L16.5 16.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span>Search workspaces &amp; actions...</span>
            </span>
            <kbd className="font-mono text-[10px] text-zinc-300 bg-black/50 border border-white/[0.1] px-1.5 py-0.5 rounded">
              ⌘K
            </kbd>
          </button>

          {/* Right: Interactive Live Cloud Diagnostics Capsule + Real Session */}
          <div className="flex items-center gap-3 text-xs relative">
            <button
              type="button"
              onClick={() => setCloudPopoverOpen((o) => !o)}
              className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.09] hover:border-white/[0.18] font-mono text-[11px] transition shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
              title="Click to inspect live multi-cloud diagnostics"
            >
              <StatusDot label="Supabase" active={Boolean(cloudStatus?.supabase.configured)} />
              <StatusDot label="Groq" active={Boolean(cloudStatus?.groq.configured)} />
              <StatusDot label="Azure SQL" active={Boolean(cloudStatus?.azureSql.configured)} />
              <StatusDot label="Azure Blob" active={Boolean(cloudStatus?.azureBlob.configured)} />
              <span className="text-zinc-500 pl-0.5 text-[10px]">
                {cloudPopoverOpen ? "▴" : "▾"}
              </span>
            </button>

            {/* Interactive Cloud Diagnostics Popover */}
            {cloudPopoverOpen && (
              <div className="absolute right-0 top-12 w-80 apple-glass rounded-2xl p-4 z-50 text-xs space-y-3">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
                  <div>
                    <div className="font-semibold text-white">Live Cloud Diagnostics</div>
                    <div className="text-[10px] font-mono text-zinc-400">
                      {activeCount}/4 services connected {cloudLatencyMs !== null ? `• ${cloudLatencyMs}ms` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={refreshCloudStatus}
                    disabled={checkingCloud}
                    className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-zinc-200 border border-white/[0.1] transition disabled:opacity-50"
                  >
                    {checkingCloud ? "Checking..." : "Re-verify"}
                  </button>
                </div>

                <div className="space-y-2 font-mono text-[11px]">
                  <CloudRow
                    name="Supabase Postgres"
                    active={Boolean(cloudStatus?.supabase.configured)}
                    detail={cloudStatus?.supabase.endpoint || "Local store fallback"}
                  />
                  <CloudRow
                    name="Groq Advisory"
                    active={Boolean(cloudStatus?.groq.configured)}
                    detail={cloudStatus?.groq.model || "Offline"}
                  />
                  <CloudRow
                    name="Azure SQL Ledger"
                    active={Boolean(cloudStatus?.azureSql.configured)}
                    detail={cloudStatus?.azureSql.database || "Simulated"}
                  />
                  <CloudRow
                    name="Azure Blob Store"
                    active={Boolean(cloudStatus?.azureBlob.configured)}
                    detail={cloudStatus?.azureBlob.containerName || "In-memory"}
                  />
                </div>
              </div>
            )}

            {userEmail ? (
              <div className="flex items-center gap-2">
                <span
                  title={userEmail}
                  className="w-7 h-7 rounded-full bg-[#f3e7d3]/15 border border-[#f3e7d3]/30 flex items-center justify-center text-[11px] font-semibold text-[#f5dfb8] uppercase"
                >
                  {userEmail[0]}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-xs text-zinc-300 hover:text-white font-medium px-2.5 py-1 rounded-full border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.09] transition"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-100 hover:text-white px-3.5 py-1.5 rounded-full border border-white/[0.12] bg-white/[0.05] hover:bg-white/[0.1] transition"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        projects={projects}
      />
    </>
  );
}

function StatusDot({ label, active }: { label: string; active: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-1">
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          active ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.75)]" : "bg-zinc-600"
        }`}
      />
      <span className={active ? "text-zinc-200" : "text-zinc-500"}>{label}</span>
    </span>
  );
}

function CloudRow({ name, active, detail }: { name: string; active: boolean; detail: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-white/[0.04] last:border-0">
      <span className="flex items-center gap-2 text-zinc-300">
        <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-400" : "bg-zinc-600"}`} />
        {name}
      </span>
      <span className="text-zinc-400 truncate max-w-[130px]">{detail}</span>
    </div>
  );
}
