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

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        if (!userEmail) return;
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
        const email = user?.email || null;
        setUserEmail(email);
        if (email) {
          fetch("/api/projects")
            .then((r) => r.json())
            .then((data) => {
              if (Array.isArray(data?.projects)) setProjects(data.projects);
            })
            .catch(() => {});
        }
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
  }, [refreshCloudStatus, userEmail]);

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUserEmail(null);
    setProjects([]);
    router.push("/");
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
        <div className="max-w-[1680px] mx-auto px-6 sm:px-10 lg:px-12 h-[70px] flex items-center justify-between gap-5">
          {/* Brand & Authenticated App Navigation Only */}
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 rounded-lg px-1 transition group"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-b from-white/[0.14] to-white/[0.04] border border-white/[0.18] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)] flex items-center justify-center text-[#f5dfb8] group-hover:scale-105 transition-transform">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M4.5 12C4.5 9.5 6.5 7.5 9 7.5C11.5 7.5 12.5 10 14.5 12C16.5 14 17.5 16.5 20 16.5C21.38 16.5 22.5 15.38 22.5 14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle cx="4.5" cy="12" r="2" fill="currentColor" />
                </svg>
              </div>
              <span className="font-semibold tracking-[0.08em] text-[15px] text-white uppercase">
                UNIFLOW
              </span>
            </Link>

            {userEmail && (
              <nav className="hidden md:flex items-center gap-1.5 p-1.5 rounded-full bg-white/[0.04] border border-white/[0.07] text-[14px] font-medium shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
                <Link
                  href="/"
                  className={`px-4 py-1.5 rounded-full transition-all duration-150 ${
                    pathname === "/"
                      ? "bg-[#f3e7d3] text-[#141210] font-semibold shadow-sm"
                      : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  Overview
                </Link>
                <Link
                  href="/projects"
                  className={`px-4 py-1.5 rounded-full transition-all duration-150 ${
                    pathname === "/projects"
                      ? "bg-[#f3e7d3] text-[#141210] font-semibold shadow-sm"
                      : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  Workspaces
                </Link>
                <Link
                  href="/projects/new"
                  className={`px-4 py-1.5 rounded-full transition-all duration-150 ${
                    pathname === "/projects/new"
                      ? "bg-[#f3e7d3] text-[#141210] font-semibold shadow-sm"
                      : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  New Project
                </Link>
              </nav>
            )}
          </div>

          {/* Center: ⌘K Command Palette (Shown Inside App After Login) */}
          {userEmail && (
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden sm:flex items-center justify-between gap-6 px-4 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.09] hover:border-white/[0.16] text-[14px] text-zinc-400 hover:text-zinc-200 transition w-64 lg:w-80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
            >
              <span className="flex items-center gap-2.5 truncate">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="M20 20L16.5 16.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span>Search workspaces &amp; actions...</span>
              </span>
              <kbd className="font-mono text-xs text-zinc-300 bg-black/50 border border-white/[0.1] px-2 py-0.5 rounded">
                ⌘K
              </kbd>
            </button>
          )}

          {/* Right: Interactive Live Cloud Diagnostics Capsule + Real Session */}
          <div className="flex items-center gap-3.5 text-sm relative">
            <button
              type="button"
              onClick={() => setCloudPopoverOpen((o) => !o)}
              className="hidden xl:flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.09] hover:border-white/[0.18] font-mono text-[13px] transition shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
              title="Click to inspect live multi-cloud diagnostics"
            >
              <StatusDot label="Supabase" active={Boolean(cloudStatus?.supabase.configured)} />
              <StatusDot label="Groq" active={Boolean(cloudStatus?.groq.configured)} />
              <StatusDot label="Azure SQL" active={Boolean(cloudStatus?.azureSql.configured)} />
              <StatusDot label="Azure Blob" active={Boolean(cloudStatus?.azureBlob.configured)} />
              <span className="text-zinc-500 pl-0.5 text-xs">
                {cloudPopoverOpen ? "▴" : "▾"}
              </span>
            </button>

            {cloudPopoverOpen && (
              <div className="absolute right-0 top-14 w-96 apple-glass rounded-2xl p-5 z-50 text-[13px] space-y-3.5">
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
              <div className="flex items-center gap-2.5">
                <span
                  title={userEmail}
                  className="w-9 h-9 rounded-full bg-[#f3e7d3]/15 border border-[#f3e7d3]/30 flex items-center justify-center text-xs font-semibold text-[#f5dfb8] uppercase"
                >
                  {userEmail[0]}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-[14px] text-zinc-300 hover:text-white font-medium px-3.5 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.09] transition"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="champagne-pill inline-flex items-center gap-2 text-[14px] font-semibold px-5 py-2 rounded-full transition"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {userEmail && (
        <CommandPalette
          isOpen={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          projects={projects}
        />
      )}
    </>
  );
}

function StatusDot({ label, active }: { label: string; active: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 px-1">
      <span
        className={`w-2 h-2 rounded-full ${
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
