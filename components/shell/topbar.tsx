"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function TopBar() {
  const router = useRouter();
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [isConfigured, setIsConfigured] = React.useState(false);

  React.useEffect(() => {
    const configured = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    setIsConfigured(configured);

    if (configured) {
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
    <header className="border-b border-slate-200 bg-white sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <Link
            href="/"
            className="flex items-center space-x-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 rounded px-1"
          >
            <div className="w-7 h-7 rounded bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-widest shadow-xs">
              ∞
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="font-semibold text-slate-900 tracking-tight text-base">UNIFLOW ∞</span>
              <span className="text-[10px] font-mono uppercase bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 hidden sm:inline-block">
                Compiler
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center space-x-4 text-xs font-medium text-slate-600">
            <Link href="/projects" className="hover:text-slate-900 transition-colors">
              Projects
            </Link>
            <Link href="/projects/new" className="hover:text-slate-900 transition-colors">
              + New Project
            </Link>
          </nav>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="hidden lg:flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
              Postgres Source of Truth
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 text-[11px] font-medium border border-sky-200">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mr-1.5"></span>
              RLS Isolated
            </span>
          </div>

          {userEmail ? (
            <div className="flex items-center space-x-2">
              <span className="font-mono text-[11px] text-slate-700 bg-slate-100 px-2.5 py-1 rounded border border-slate-200 max-w-[160px] truncate">
                {userEmail}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-xs text-rose-600 hover:text-rose-700 hover:underline font-medium px-2 py-1"
              >
                Sign Out
              </button>
            </div>
          ) : isConfigured ? (
            <Link
              href="/login"
              className="inline-flex items-center space-x-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 bg-slate-50 px-2.5 py-1 rounded transition"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span className="font-mono text-[11px]">Sign In</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center space-x-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 bg-slate-50 px-2.5 py-1 rounded transition"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="font-mono text-[11px]">Tenant: Isolated Dev</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
