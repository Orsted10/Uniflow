"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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

  React.useEffect(() => {
    fetch("/api/cloud/status")
      .then((r) => r.json())
      .then((data) => {
        if (data?.services) setCloudStatus(data.services);
      })
      .catch(() => {});

    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.email) setUserEmail(user.email);
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setUserEmail(session?.user?.email || null);
      });

      return () => {
        subscription.unsubscribe();
      };
    }
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
    <header className="border-b border-white/[0.07] bg-[#050507]/75 backdrop-blur-2xl sticky top-0 z-50 text-zinc-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        {/* Brand & Segmented Nav */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 rounded-lg px-1 transition"
          >
            <div className="w-7 h-7 rounded-lg bg-white/[0.08] border border-white/[0.12] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] flex items-center justify-center text-white">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 12C5 9.79086 6.79086 8 9 8C11.2091 8 12.5 10 14.5 12C16.5 14 17.7909 16 20 16C21.1046 16 22 15.1046 22 14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle cx="5" cy="12" r="2" fill="currentColor" />
              </svg>
            </div>
            <span className="font-semibold tracking-[-0.02em] text-sm text-white">UNIFLOW</span>
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

        {/* Translucent Telemetry Capsule & Auth */}
        <div className="flex items-center gap-3 text-xs">
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.07] font-mono text-[11px]">
            <StatusDot
              label="Supabase"
              active={Boolean(cloudStatus?.supabase.configured)}
              tooltip={cloudStatus?.supabase.configured ? "Supabase PostgreSQL Connected" : "Local Store Fallback"}
            />
            <span className="text-white/15">&bull;</span>
            <StatusDot
              label="Groq"
              active={Boolean(cloudStatus?.groq.configured)}
              tooltip={cloudStatus?.groq.configured ? `Groq ${cloudStatus.groq.model}` : "Groq Offline"}
            />
            <span className="text-white/15">&bull;</span>
            <StatusDot
              label="Azure SQL"
              active={Boolean(cloudStatus?.azureSql.configured)}
              tooltip={cloudStatus?.azureSql.configured ? "Azure SQL Evidence Store Ready" : "Simulated Ledger"}
            />
            <span className="text-white/15">&bull;</span>
            <StatusDot
              label="Azure Blob"
              active={Boolean(cloudStatus?.azureBlob.configured)}
              tooltip={cloudStatus?.azureBlob.configured ? "Azure Blob Storage Connected" : "In-Memory Blob"}
            />
          </div>

          {userEmail ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-zinc-300 bg-white/[0.05] px-3 py-1 rounded-full border border-white/[0.08] max-w-[160px] truncate">
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
              className="inline-flex items-center text-xs text-zinc-100 hover:text-white border border-white/[0.1] hover:border-white/[0.2] bg-white/[0.05] hover:bg-white/[0.09] px-3.5 py-1.5 rounded-full transition font-medium"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function StatusDot({ label, active, tooltip }: { label: string; active: boolean; tooltip: string }) {
  return (
    <span title={tooltip} className="inline-flex items-center gap-1.5 px-0.5 cursor-default">
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          active ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" : "bg-zinc-600"
        }`}
      />
      <span className={active ? "text-zinc-200" : "text-zinc-500"}>{label}</span>
    </span>
  );
}
