"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TopBar } from "@/components/shell/topbar";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ErrorPanel } from "@/components/ui/error-panel";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/projects";
  const urlError = searchParams.get("error");

  const [email, setEmail] = React.useState("developer@uniflow.internal");
  const [password, setPassword] = React.useState("password123");
  const [mode, setMode] = React.useState<"password" | "magic_link">("password");
  const [isSignUp, setIsSignUp] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(
    urlError === "auth_exchange_failed"
      ? "Authentication link expired or invalid. Please request a new link."
      : null
  );
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  async function handlePasswordAuth(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setErrorMsg("Email address is required.");
      return;
    }

    if (!isSupabaseConfigured) {
      // Fallback local mode
      router.push(redirectPath);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setErrorMsg("Supabase client could not be initialized.");
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        setSuccessMsg("Account created! Check your email to confirm registration or sign in directly.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        router.push(redirectPath);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setErrorMsg("Email address is required for magic link sign-in.");
      return;
    }

    if (!isSupabaseConfigured) {
      router.push(redirectPath);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setErrorMsg("Supabase client could not be initialized.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            redirectPath
          )}`,
        },
      });
      if (error) throw error;
      setSuccessMsg(`Magic login link dispatched to ${email.trim()}. Please inspect your inbox.`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs">
      <div className="text-center mb-6">
        <div className="w-10 h-10 rounded bg-slate-900 text-white mx-auto flex items-center justify-center font-bold text-base mb-2">
          ∞
        </div>
        <h1 className="text-lg font-semibold text-slate-900 tracking-tight">
          {isSignUp ? "Create Uniflow Account" : "Sign in to Uniflow"}
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          API Compatibility Compiler &bull; PostgreSQL Source of Truth
        </p>
      </div>

      {!isSupabaseConfigured ? (
        <div className="p-3 mb-5 bg-amber-50/80 border border-amber-200 text-amber-900 text-xs rounded-md space-y-2">
          <div className="flex items-center gap-1.5 font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Local Developer Mode (Phase 2 Offline)
          </div>
          <p className="text-[11px] leading-relaxed text-amber-800">
            Supabase credentials are not detected in <code>.env.local</code>. You can explore all compiler workflows using isolated in-memory tenant state.
          </p>
          <button
            type="button"
            onClick={() => router.push(redirectPath)}
            className="w-full text-center bg-amber-600 hover:bg-amber-700 text-white font-medium py-1.5 rounded text-xs transition"
          >
            Continue as Local Developer →
          </button>
        </div>
      ) : (
        <div className="p-2.5 mb-5 bg-emerald-50/80 border border-emerald-200 text-emerald-900 text-xs rounded-md flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Supabase Auth Connected with Row-Level Security</span>
        </div>
      )}

      {errorMsg && (
        <ErrorPanel message={errorMsg} onDismiss={() => setErrorMsg(null)} className="mb-4" />
      )}

      {successMsg && (
        <div className="p-3 mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs">
          {successMsg}
        </div>
      )}

      <div className="flex border-b border-slate-200 mb-4 text-xs font-medium">
        <button
          type="button"
          onClick={() => {
            setMode("password");
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className={`pb-2 px-3 border-b-2 transition ${
            mode === "password"
              ? "border-slate-900 text-slate-900 font-semibold"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Email & Password
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("magic_link");
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className={`pb-2 px-3 border-b-2 transition ${
            mode === "magic_link"
              ? "border-slate-900 text-slate-900 font-semibold"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Magic Link
        </button>
      </div>

      {mode === "password" ? (
        <form onSubmit={handlePasswordAuth} className="space-y-4 text-xs">
          <div>
            <label htmlFor="email" className="block font-medium text-slate-700 mb-1">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-500 font-mono text-xs"
            />
          </div>

          <div>
            <label htmlFor="password" className="block font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-500 font-mono text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2 rounded transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50"
          >
            {loading ? "Processing..." : isSignUp ? "Sign Up with Email" : "Sign In with Password"}
          </button>

          <div className="pt-2 text-center text-[11px] text-slate-500">
            {isSignUp ? (
              <span>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setIsSignUp(false)}
                  className="text-slate-900 underline font-medium"
                >
                  Sign In
                </button>
              </span>
            ) : (
              <span>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => setIsSignUp(true)}
                  className="text-slate-900 underline font-medium"
                >
                  Sign Up
                </button>
              </span>
            )}
          </div>
        </form>
      ) : (
        <form onSubmit={handleMagicLink} className="space-y-4 text-xs">
          <div>
            <label htmlFor="magicEmail" className="block font-medium text-slate-700 mb-1">
              Email Address
            </label>
            <input
              id="magicEmail"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="developer@example.com"
              className="w-full border border-slate-300 rounded px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-500 font-mono text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2 rounded transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50"
          >
            {loading ? "Sending Magic Link..." : "Send Magic Sign-in Link"}
          </button>

          <p className="text-[11px] text-slate-500 text-center">
            We will send a passwordless login link to your email.
          </p>
        </form>
      )}

      <div className="mt-6 pt-4 border-t border-slate-100 text-center text-[11px] text-slate-500">
        <Link href="/projects" className="text-slate-700 hover:text-slate-900 underline font-medium">
          Explore Demo Projects Workspace →
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <TopBar />

      <main className="max-w-md mx-auto px-4 py-12 w-full flex-1 flex flex-col justify-center">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Sign In", current: true }]} className="mb-6" />

        <React.Suspense
          fallback={
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-xs text-slate-400">
              Loading authentication...
            </div>
          }
        >
          <LoginForm />
        </React.Suspense>
      </main>

      <footer className="border-t border-slate-200 bg-white py-3 text-center text-xs text-slate-400">
        UNIFLOW ∞ — API Compatibility Compiler &bull; Phase 2 Auth & RLS
      </footer>
    </div>
  );
}
