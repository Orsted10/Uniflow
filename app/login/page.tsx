"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TopBar } from "@/components/shell/topbar";
import { HeroBackdrop } from "@/components/ui/hero-backdrop";
import { ErrorPanel } from "@/components/ui/error-panel";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/projects";
  const urlError = searchParams.get("error");

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [mode, setMode] = React.useState<"password" | "magic_link">("password");
  const [isSignUp, setIsSignUp] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [activeUserEmail, setActiveUserEmail] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(
    urlError === "auth_exchange_failed"
      ? "Authentication link expired or invalid. Please sign in again."
      : null
  );
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  React.useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setActiveUserEmail(user.email);
    });
  }, []);

  async function handleGoogleSignIn() {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!isSupabaseConfigured) {
      setErrorMsg("Supabase is not configured in .env.local.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setErrorMsg("Supabase client could not be initialized.");
      return;
    }

    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            redirectPath
          )}`,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setGoogleLoading(false);
    }
  }

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
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
              redirectPath
            )}`,
          },
        });
        if (error) throw error;
        if (data.session) {
          router.push(redirectPath);
          return;
        }
        setSuccessMsg("Account created! Check your inbox to confirm your email, or sign in directly.");
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
      setSuccessMsg(`Magic login link sent to ${email.trim()}. Check your inbox.`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setActiveUserEmail(null);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center w-full">
      {/* Left Editorial Column */}
      <div className="lg:col-span-6 space-y-5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/55 backdrop-blur-md border border-white/[0.12] text-[11px] font-mono text-zinc-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Supabase Auth &bull; PostgreSQL RLS</span>
        </div>

        <h1 className="font-editorial text-[42px] sm:text-[54px] font-normal tracking-[-0.02em] text-[#fdfaf5] leading-[1.03] drop-shadow-[0_2px_18px_rgba(0,0,0,0.65)]">
          Enter your{" "}
          <span className="relative inline-block">
            <span className="font-brush text-[50px] sm:text-[62px] text-[#f4845f] font-bold tracking-normal leading-none pr-1">
              isolated
            </span>
            <svg
              viewBox="0 0 180 14"
              fill="none"
              aria-hidden="true"
              className="absolute -bottom-1 left-0 w-full h-3 text-[#f4845f]/85"
            >
              <path
                d="M3 10.5C45 4.2 118 2.8 176 7.5"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </span>{" "}
          compiler workspace.
        </h1>

        <p className="text-[15px] text-[#e5ddd2] leading-[1.6] max-w-md drop-shadow-[0_1px_10px_rgba(0,0,0,0.8)]">
          Every project, normalized contract AST, and mapping review decision is protected by
          PostgreSQL Row-Level Security so tenant data never leaks across workspaces.
        </p>

        <div className="pt-2 flex flex-wrap gap-3">
          <div className="apple-glass rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-teal-400" />
            <span className="text-zinc-200 font-medium">Google OAuth 2.0</span>
          </div>
          <div className="apple-glass rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-violet-400" />
            <span className="text-zinc-200 font-medium">Magic Link &amp; Password</span>
          </div>
        </div>
      </div>

      {/* Right Frosted Glass Auth Card */}
      <div className="lg:col-span-6 flex justify-center lg:justify-end">
        <div className="apple-glass rounded-2xl p-6 sm:p-8 w-full max-w-md space-y-5">
          {activeUserEmail ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-white tracking-tight">
                  Session Active
                </h2>
                <p className="text-xs text-zinc-400">
                  Signed in as <span className="font-mono text-emerald-300">{activeUserEmail}</span>
                </p>
              </div>
              <div className="flex flex-col gap-2.5 pt-2">
                <Link
                  href="/projects"
                  className="champagne-pill w-full text-center text-xs font-semibold py-2.5 rounded-full transition"
                >
                  Open Workspaces →
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full text-xs font-medium py-2.5 rounded-full border border-white/[0.14] bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 transition"
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-xl font-semibold text-white tracking-tight">
                  {isSignUp ? "Create your account" : "Sign in to UNIFLOW"}
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  {isSignUp
                    ? "Start compiling contract migrations with Supabase RLS."
                    : "Authenticate to access your projects and Azure certification ledger."}
                </p>
              </div>

              {errorMsg && (
                <ErrorPanel message={errorMsg} onDismiss={() => setErrorMsg(null)} />
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-950/50 border border-emerald-500/30 text-emerald-200 rounded-xl text-xs leading-relaxed">
                  {successMsg}
                </div>
              )}

              {/* Google OAuth Primary Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || loading}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-full bg-white text-zinc-950 hover:bg-zinc-200 disabled:opacity-50 font-semibold text-xs transition shadow-sm"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                <span>{googleLoading ? "Connecting to Google..." : "Continue with Google"}</span>
              </button>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-white/[0.08]" />
                <span className="shrink mx-3 text-[11px] font-mono text-zinc-500">or with email</span>
                <div className="flex-grow border-t border-white/[0.08]" />
              </div>

              {/* Segmented Pill Toggle */}
              <div className="flex p-0.5 rounded-full bg-black/55 border border-white/[0.09] text-xs font-medium">
                <button
                  type="button"
                  onClick={() => {
                    setMode("password");
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`flex-1 py-1.5 rounded-full transition ${
                    mode === "password"
                      ? "bg-[#f3e7d3] text-[#141210] font-semibold shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("magic_link");
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`flex-1 py-1.5 rounded-full transition ${
                    mode === "magic_link"
                      ? "bg-[#f3e7d3] text-[#141210] font-semibold shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Magic Link
                </button>
              </div>

              {mode === "password" ? (
                <form onSubmit={handlePasswordAuth} className="space-y-3.5 text-xs">
                  <div>
                    <label htmlFor="email" className="block font-medium text-zinc-300 mb-1.5">
                      Email Address
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full border border-white/[0.12] bg-black/55 rounded-xl px-3.5 py-2.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#f3e7d3]/50 font-mono text-xs"
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
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full border border-white/[0.12] bg-black/55 rounded-xl px-3.5 py-2.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#f3e7d3]/50 font-mono text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || googleLoading}
                    className="champagne-pill w-full font-semibold py-2.5 rounded-full transition disabled:opacity-50"
                  >
                    {loading
                      ? "Authenticating..."
                      : isSignUp
                      ? "Create Account →"
                      : "Sign In →"}
                  </button>

                  <div className="pt-1 text-center text-[11px] text-zinc-400">
                    {isSignUp ? (
                      <span>
                        Already have an account?{" "}
                        <button
                          type="button"
                          onClick={() => setIsSignUp(false)}
                          className="text-[#f4845f] hover:text-[#f9a88b] underline font-medium"
                        >
                          Sign In
                        </button>
                      </span>
                    ) : (
                      <span>
                        New to UNIFLOW?{" "}
                        <button
                          type="button"
                          onClick={() => setIsSignUp(true)}
                          className="text-[#f4845f] hover:text-[#f9a88b] underline font-medium"
                        >
                          Create an account
                        </button>
                      </span>
                    )}
                  </div>
                </form>
              ) : (
                <form onSubmit={handleMagicLink} className="space-y-3.5 text-xs">
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
                      placeholder="you@company.com"
                      className="w-full border border-white/[0.12] bg-black/55 rounded-xl px-3.5 py-2.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#f3e7d3]/50 font-mono text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || googleLoading}
                    className="champagne-pill w-full font-semibold py-2.5 rounded-full transition disabled:opacity-50"
                  >
                    {loading ? "Sending Link..." : "Send Magic Link →"}
                  </button>

                  <p className="text-[11px] text-zinc-400 text-center">
                    We will email you a passwordless sign-in link.
                  </p>
                </form>
              )}

              <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-zinc-400">
                <Link href="/" className="hover:text-zinc-200 transition">
                  ← Back to Overview
                </Link>
                <Link href="/projects" className="text-zinc-200 hover:text-white font-medium transition">
                  Explore Workspaces →
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#090807] text-[#f5f2eb] flex flex-col font-sans relative overflow-x-hidden">
      <HeroBackdrop />
      <TopBar />

      <main className="relative z-10 max-w-[1440px] mx-auto px-5 sm:px-8 lg:px-10 py-12 w-full flex-1 flex items-center">
        <React.Suspense
          fallback={
            <div className="apple-glass rounded-2xl p-8 text-center text-xs text-zinc-400 mx-auto">
              Loading authentication...
            </div>
          }
        >
          <LoginContent />
        </React.Suspense>
      </main>
    </div>
  );
}
