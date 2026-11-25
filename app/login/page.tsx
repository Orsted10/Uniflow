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
    <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-6 sm:p-7 shadow-2xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white tracking-tight">
          {isSignUp ? "Create your workspace account" : "Sign in to UNIFLOW"}
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          PostgreSQL Row-Level Security &amp; isolated execution environments
        </p>
      </div>

      {!isSupabaseConfigured ? (
        <div className="p-3 mb-5 bg-amber-950/30 border border-amber-800/50 text-amber-200 text-xs rounded-lg space-y-2">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Local Developer Mode
          </div>
          <p className="text-[11px] leading-relaxed text-amber-300/80">
            Supabase credentials are not detected in <code>.env.local</code>. You can explore all compiler workflows using isolated in-memory tenant state.
          </p>
          <button
            type="button"
            onClick={() => router.push(redirectPath)}
            className="w-full text-center bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold py-1.5 rounded-md text-xs transition"
          >
            Continue as Local Developer →
          </button>
        </div>
      ) : (
        <div className="p-2.5 mb-5 bg-emerald-950/30 border border-emerald-800/50 text-emerald-300 text-xs rounded-lg flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Supabase Auth connected with Row-Level Security</span>
        </div>
      )}

      {errorMsg && (
        <ErrorPanel message={errorMsg} onDismiss={() => setErrorMsg(null)} className="mb-4" />
      )}

      {successMsg && (
        <div className="p-3 mb-4 bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 rounded-lg text-xs">
          {successMsg}
        </div>
      )}

      <div className="flex border-b border-zinc-800 mb-5 text-xs font-medium">
        <button
          type="button"
          onClick={() => {
            setMode("password");
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className={`pb-2.5 px-3 border-b-2 transition ${
            mode === "password"
              ? "border-emerald-400 text-white font-semibold"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Email &amp; Password
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("magic_link");
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className={`pb-2.5 px-3 border-b-2 transition ${
            mode === "magic_link"
              ? "border-emerald-400 text-white font-semibold"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Magic Link
        </button>
      </div>

      {mode === "password" ? (
        <form onSubmit={handlePasswordAuth} className="space-y-4 text-xs">
          <div>
            <label htmlFor="email" className="block font-medium text-zinc-300 mb-1.5">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-zinc-800 bg-zinc-950 rounded-md px-3 py-2 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-xs"
            />
          </div>

          <div>
            <label htmlFor="password" className="block font-medium text-zinc-300 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-zinc-800 bg-zinc-950 rounded-md px-3 py-2 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold py-2 rounded-md transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-50"
          >
            {loading ? "Processing..." : isSignUp ? "Sign Up with Email" : "Sign In"}
          </button>

          <div className="pt-2 text-center text-[11px] text-zinc-400">
            {isSignUp ? (
              <span>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setIsSignUp(false)}
                  className="text-emerald-400 hover:text-emerald-300 underline font-medium"
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
                  className="text-emerald-400 hover:text-emerald-300 underline font-medium"
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
            <label htmlFor="magicEmail" className="block font-medium text-zinc-300 mb-1.5">
              Email Address
            </label>
            <input
              id="magicEmail"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="developer@example.com"
              className="w-full border border-zinc-800 bg-zinc-950 rounded-md px-3 py-2 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold py-2 rounded-md transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-50"
          >
            {loading ? "Sending Magic Link..." : "Send Magic Sign-in Link"}
          </button>

          <p className="text-[11px] text-zinc-500 text-center">
            We will send a passwordless login link to your email.
          </p>
        </form>
      )}

      <div className="mt-6 pt-4 border-t border-zinc-800/80 text-center text-[11px] text-zinc-400">
        <Link href="/projects" className="text-zinc-300 hover:text-white underline font-medium">
          Explore Workspaces →
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans">
      <TopBar />

      <main className="max-w-md mx-auto px-4 py-12 w-full flex-1 flex flex-col justify-center">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Sign In", current: true }]} className="mb-6" />

        <React.Suspense
          fallback={
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-8 text-center text-xs text-zinc-400">
              Loading authentication...
            </div>
          }
        >
          <LoginForm />
        </React.Suspense>
      </main>
    </div>
  );
}
