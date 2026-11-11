"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function TopBar() {
  const router = useRouter();
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = React.useState<{
    supabase: { configured: boolean };
    groq: { configured: boolean; model: string };
    azureBlob: { configured: boolean };
    azureSql: { configured: boolean };
  } | null>(null);

  React.useEffect(() => {
    // Check Supabase session
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

    // Fetch multi-cloud health
    fetch("/api/cloud/status")
      .then((r) => r.json())
      .then((data) => setCloudStatus(data.services))
      .catch(() => {});
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
    <header className="border-b border-slate-800/80 bg-[#0b0f17]/95 backdrop-blur-md sticky top-0 z-50 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Brand & Nav Links */}
        <div className="flex items-center space-x-6">
          <Link
            href="/"
            className="flex items-center space-x-2.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500 rounded px-1 transition"
          >
            <div className="w-7 h-7 rounded bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center font-bold text-sm tracking-widest shadow-xs">
              ∞
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="font-bold tracking-tight text-sm sm:text-base text-white">
                UNIFLOW <span className="text-teal-400">∞</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800/60 border border-slate-700/60 px-1.5 py-0.5 rounded hidden sm:inline-block">
                Compiler v1.0
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center space-x-4 text-xs font-medium text-slate-400">
            <Link href="/projects" className="hover:text-white transition-colors">
              Projects
            </Link>
            <Link href="/projects/new" className="hover:text-white transition-colors">
              + New Workspace
            </Link>
          </nav>
        </div>

        {/* Live Multi-Cloud HUD */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="hidden lg:flex items-center space-x-2 font-mono text-[11px]">
            <span
              title="Supabase PostgreSQL System of Record"
              className={`inline-flex items-center px-2 py-0.5 rounded border ${
                cloudStatus?.supabase.configured
                  ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/60"
                  : "bg-slate-800/60 text-slate-400 border-slate-700/60"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                  cloudStatus?.supabase.configured ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                }`}
              ></span>
              Postgres
            </span>
            <span
              title={`Groq LLM Advisory Engine (${cloudStatus?.groq.model || "120B"})`}
              className={`inline-flex items-center px-2 py-0.5 rounded border ${
                cloudStatus?.groq.configured
                  ? "bg-sky-950/60 text-sky-400 border-sky-800/60"
                  : "bg-slate-800/60 text-slate-400 border-slate-700/60"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                  cloudStatus?.groq.configured ? "bg-sky-400" : "bg-slate-500"
                }`}
              ></span>
              Groq 120B
            </span>
            <span
              title="Azure SQL Execution Evidence Store"
              className={`inline-flex items-center px-2 py-0.5 rounded border ${
                cloudStatus?.azureSql.configured
                  ? "bg-teal-950/60 text-teal-400 border-teal-800/60"
                  : "bg-slate-800/60 text-slate-400 border-slate-700/60"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                  cloudStatus?.azureSql.configured ? "bg-teal-400" : "bg-slate-500"
                }`}
              ></span>
              Azure SQL
            </span>
            <span
              title="Azure Blob Storage (Specs & Reports)"
              className={`inline-flex items-center px-2 py-0.5 rounded border ${
                cloudStatus?.azureBlob.configured
                  ? "bg-cyan-950/60 text-cyan-400 border-cyan-800/60"
                  : "bg-slate-800/60 text-slate-400 border-slate-700/60"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                  cloudStatus?.azureBlob.configured ? "bg-cyan-400" : "bg-slate-500"
                }`}
              ></span>
              Azure Blob
            </span>
          </div>

          {/* User Auth or Quick Demo Access */}
          {userEmail ? (
            <div className="flex items-center space-x-2">
              <span className="font-mono text-[11px] text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700/80 max-w-[160px] truncate">
                {userEmail}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-xs text-rose-400 hover:text-rose-300 hover:underline font-medium px-2 py-1 transition"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center space-x-1.5 text-xs text-slate-300 hover:text-white border border-slate-700/80 hover:border-slate-600 bg-slate-800/60 px-2.5 py-1 rounded transition"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span className="font-mono text-[11px]">Developer Session</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
