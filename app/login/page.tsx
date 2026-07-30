"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeftIcon } from "@/app/components/icons";

const CAPTION = {
  idle: "floating along",
  email: "watching along",
  typing: "watching along",
  password: "giving you privacy",
  hover: "ready when you are",
  submit: "checking",
  success: "welcome back",
  error: "let's try again",
} as const;

type PipState = keyof typeof CAPTION;

// @supabase/ssr always uses the PKCE flow and can't be configured out of it,
// even for plain email/password auth that never exchanges a code. Every
// signIn/signUp call leaves behind a uniquely-named "code-verifier" cookie
// that's never cleaned up, so repeated logins in one browser silently grow
// the Cookie header until requests start failing with HTTP 431. Since this
// app has no OAuth/magic-link flow to consume them, they're safe to sweep
// before every attempt.
function clearPkceVerifierCookies() {
  document.cookie.split(";").forEach((entry) => {
    const name = entry.split("=")[0].trim();
    if (name.includes("code-verifier")) {
      document.cookie = `${name}=; path=/; max-age=0`;
    }
  });
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [pipState, setPipState] = useState<PipState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function handleTextInput() {
    setPipState("typing");
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setPipState("email"), 1100);
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);
    clearPkceVerifierCookies();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "https://www.googleapis.com/auth/calendar.readonly",
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setPipState("submit");

    const email = emailRef.current?.value.trim() ?? "";
    const password = passwordRef.current?.value ?? "";

    clearPkceVerifierCookies();

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      setPipState("error");
      return;
    }

    setPipState("success");
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 900);
  }

  const inputClass =
    "rounded-xl border border-[#034F46]/10 bg-[#FFFFEB]/40 px-5 py-3.5 text-base text-[#034F46] placeholder:text-[#034F46]/35 focus:outline-none focus:ring-2 focus:ring-[#034F46]/20";

  return (
    <div className="hero-gradient relative flex h-screen overflow-hidden">
      <Script type="module" src="/mascot-companion/mascot-companion.js" strategy="afterInteractive" />

      <Link
        href="/"
        className="absolute left-6 top-6 z-10 flex items-center gap-1.5 text-sm font-semibold text-[#034F46]/60 transition hover:text-[#034F46] md:left-8 md:top-8"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back
      </Link>

      {/* Mascot panel */}
      <div className="relative hidden w-1/2 flex-col items-center justify-center md:flex">
        <mascot-companion state={pipState} size={300} assets="/mascot-companion/" suppressHydrationWarning />
        <span className="absolute bottom-16 text-xs font-semibold uppercase tracking-[0.14em] text-[#034F46]/45">
          {CAPTION[pipState]}
        </span>
      </div>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center px-8 md:w-1/2">
        <div className="flex w-full max-w-md flex-col gap-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 text-xl font-semibold tracking-tight text-[#034F46]">
            <Image src="/logo.png" alt="Memento" width={44} height={44} className="h-11 w-auto" priority />
            <span>Memento</span>
          </Link>

          <h1 className="text-4xl font-bold tracking-tight text-[#034F46]">Welcome back</h1>

          {/* Email / password form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <label className="flex flex-col gap-1.5 text-base font-medium text-[#034F46]">
              Email
              <input
                ref={emailRef}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                suppressHydrationWarning
                onFocus={() => setPipState("email")}
                onBlur={() => setPipState("idle")}
                onChange={handleTextInput}
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-base font-medium text-[#034F46]">
              Password
              <input
                ref={passwordRef}
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                required
                minLength={6}
                suppressHydrationWarning
                onFocus={() => setPipState("password")}
                onBlur={() => setPipState("idle")}
                className={inputClass}
              />
            </label>

            {error && <p className="text-sm font-medium text-[#a34158]">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              onMouseEnter={() => setPipState((s) => (s === "idle" ? "hover" : s))}
              onMouseLeave={() => setPipState((s) => (s === "hover" ? "idle" : s))}
              className="mt-1 rounded-full bg-[#034F46] px-5 py-3.5 text-base font-semibold text-[#FFFFEB] transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Login"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[#034F46]/10" />
            <span className="text-sm text-[#034F46]/40">or</span>
            <div className="h-px flex-1 bg-[#034F46]/10" />
          </div>

          {/* Google — handles both sign-in and sign-up */}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="flex items-center justify-center gap-3 rounded-full border border-[#034F46]/15 bg-white px-5 py-3.5 text-base font-medium text-[#034F46] shadow-sm transition hover:bg-[#034F46]/5 disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            <p className="text-center text-sm text-[#034F46]/50">
              New to Memento?{" "}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="font-semibold text-[#034F46] underline-offset-2 transition hover:underline disabled:opacity-50"
              >
                Sign up using Google
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
