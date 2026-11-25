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
    // 1. Always fetch live multi-cloud health (no early return!)
    fetch("/api/cloud/status")
      .then((r) => r.json())
      .then((data) => {
        if (data?.services) setCloudStatus(data.services);
      })
      .catch(() => {});

    // 2. Check Supabase browser auth session
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
    <header className="border-b border-zinc-800/80 bg-[#09090b]/90 backdrop-blur-md sticky top-0 z-50 text-zinc-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        {/* Brand & Primary Nav */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 rounded px-1 transition"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-emerald-400 shrink-0"
              aria-hidden="true"
            >
              <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="1.75" />
              <path
                d="M7.5 12C7.5 10.3431 8.84315 9 10.5 9C12.1569 9 13.5 10.3431 13.5 12C13.5 13.6569 14.8431 15 16.5 15C18.1569 15 19.5 13.6569 19.5 12"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
              <circle cx="7.5" cy="12" r="1.25" fill="currentColor" />
            </svg>
            <span className="font-semibold tracking-tight text-sm text-white">UNIFLOW</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-xs font-medium">
            <Link
              href="/"
              className={`px-2.5 py-1.5 rounded-md transition-colors ${
                pathname === "/" ? "text-white bg-zinc-800/80" : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
              }`}
            >
              Overview
            </Link>
            <Link
              href="/projects"
              className={`px-2.5 py-1.5 rounded-md transition-colors ${
                pathname === "/projects"
                  ? "text-white bg-zinc-800/80"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
              }`}
            >
              Workspaces
            </Link>
            <Link
              href="/projects/new"
              className={`px-2.5 py-1.5 rounded-md transition-colors ${
                pathname === "/projects/new"
                  ? "text-white bg-zinc-800/80"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
              }`}
            >
              New Project
            </Link>
          </nav>
        </div>

        {/* Live Cloud Telemetry Strip + Session */}
        <div className="flex items-center gap-3 text-xs">
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900/90 border border-zinc-800 font-mono text-[11px]">
            <StatusDot
              label="Supabase"
              active={Boolean(cloudStatus?.supabase.configured)}
              tooltip={cloudStatus?.supabase.configured ? "Supabase PostgreSQL Connected" : "Local Store Fallback"}
            />
            <span className="text-zinc-700">/</span>
            <StatusDot
              label="Groq"
              active={Boolean(cloudStatus?.groq.configured)}
              tooltip={cloudStatus?.groq.configured ? `Groq ${cloudStatus.groq.model}` : "Groq Offline"}
            />
            <span className="text-zinc-700">/</span>
            <StatusDot
              label="Azure SQL"
              active={Boolean(cloudStatus?.azureSql.configured)}
              tooltip={cloudStatus?.azureSql.configured ? "Azure SQL Evidence Store Ready" : "Simulated Ledger"}
            />
            <span className="text-zinc-700">/</span>
            <StatusDot
              label="Azure Blob"
              active={Boolean(cloudStatus?.azureBlob.configured)}
              tooltip={cloudStatus?.azureBlob.configured ? "Azure Blob Storage Connected" : "In-Memory Blob"}
            />
          </div>

          {userEmail ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-zinc-300 bg-zinc-900 px-2.5 py-1 rounded-md border border-zinc-800 max-w-[160px] truncate">
                {userEmail}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-xs text-zinc-400 hover:text-rose-400 font-medium px-2 py-1 transition"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-200 hover:text-white border border-zinc-800 hover:border-zinc-700 bg-zinc-900 px-3 py-1.5 rounded-md transition font-medium"
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
    <span title={tooltip} className="inline-flex items-center gap-1.5 text-zinc-300 px-1 cursor-default">
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-400" : "bg-zinc-600"}`} />
      <span className={active ? "text-zinc-200" : "text-zinc-500"}>{label}</span>
    </span>
  );
}
