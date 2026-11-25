"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { CommandPalette } from "@/components/ui/command-palette";
import { Project } from "@/lib/supabase/models";

interface CloudServices {
  supabase: { configured: boolean; status: string };
  groq: { configured: boolean; status: string; model: string };
  azureBlob: { configured: boolean; status: string };
  azureSql: { configured: boolean; status: string };
}

export function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = React.useState<CloudServices | null>(null);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [projects, setProjects] = React.useState<Project[]>([]);

  React.useEffect(() => {
    fetch("/api/cloud/status")
      .then((r) => r.json())
      .then((data) => {
        if (data?.services) setCloudStatus(data.services);
      })
      .catch(() => {});

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
  }, []);

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUserEmail(null);
    router.push("/login");
  }

  return (
    <>
      <header className="border-b border-white/[0.07] bg-[#0b0a09]/75 backdrop-blur-2xl sticky top-0 z-50 text-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          {/* Brand & Segmented Nav */}
          <div className="flex items-center gap-5">
            <Link
              href="/"
              className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 rounded-lg px-1 transition"
            >
              <div className="w-7 h-7 rounded-full bg-white/[0.08] border border-white/[0.14] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)] flex items-center justify-center text-[#f3e7d3]">
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
              <span className="font-semibold tracking-[0.06em] text-xs text-white uppercase">
                UNIFLOW
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1 p-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-xs font-medium">
              <Link
                href="/"
                className={`px-3 py-1 rounded-full transition-all duration-150 ${
                  pathname === "/"
                    ? "bg-white/[0.12] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                Overview
              </Link>
              <Link
                href="/projects"
                className={`px-3 py-1 rounded-full transition-all duration-150 ${
                  pathname === "/projects"
                    ? "bg-white/[0.12] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                Workspaces
              </Link>
              <Link
                href="/projects/new"
                className={`px-3 py-1 rounded-full transition-all duration-150 ${
                  pathname === "/projects/new"
                    ? "bg-white/[0.12] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
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
            className="hidden sm:flex items-center justify-between gap-6 px-3.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] text-xs text-zinc-400 hover:text-zinc-200 transition w-56 lg:w-64"
          >
            <span className="flex items-center gap-2 truncate">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="M20 20L16.5 16.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span>Search anything...</span>
            </span>
            <kbd className="font-mono text-[10px] text-zinc-400 bg-black/40 border border-white/[0.08] px-1.5 py-0.5 rounded">
              ⌘K
            </kbd>
          </button>

          {/* Right: Live Cloud Telemetry + Session */}
          <div className="flex items-center gap-3 text-xs">
            <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.07] font-mono text-[11px]">
              <StatusDot
                label="Supabase"
                active={Boolean(cloudStatus?.supabase.configured)}
                tooltip={cloudStatus?.supabase.configured ? "Supabase PostgreSQL Connected" : "Local Store Fallback"}
              />
              <StatusDot
                label="Groq"
                active={Boolean(cloudStatus?.groq.configured)}
                tooltip={cloudStatus?.groq.configured ? `Groq ${cloudStatus.groq.model}` : "Groq Offline"}
              />
              <StatusDot
                label="Azure SQL"
                active={Boolean(cloudStatus?.azureSql.configured)}
                tooltip={cloudStatus?.azureSql.configured ? "Azure SQL Evidence Store Ready" : "Simulated Ledger"}
              />
              <StatusDot
                label="Azure Blob"
                active={Boolean(cloudStatus?.azureBlob.configured)}
                tooltip={cloudStatus?.azureBlob.configured ? "Azure Blob Storage Connected" : "In-Memory Blob"}
              />
            </div>

            {userEmail ? (
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-zinc-300 bg-white/[0.05] px-3 py-1 rounded-full border border-white/[0.08] max-w-[140px] truncate">
                  {userEmail}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-xs text-zinc-400 hover:text-white font-medium px-2 py-1 transition"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="w-7 h-7 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.14] flex items-center justify-center text-[11px] font-semibold text-[#f3e7d3] transition"
                title="Sign in / Developer Session"
              >
                A
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

function StatusDot({ label, active, tooltip }: { label: string; active: boolean; tooltip: string }) {
  return (
    <span title={tooltip} className="inline-flex items-center gap-1.5 px-1 cursor-default">
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          active ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" : "bg-zinc-600"
        }`}
      />
      <span className={active ? "text-zinc-200" : "text-zinc-500"}>{label}</span>
    </span>
  );
}
