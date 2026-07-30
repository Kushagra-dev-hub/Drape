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
type Mode = "signin" | "signup";

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

const COPY: Record<Mode, { heading: string; cta: string; toggleHint: string; toggleLabel: string }> = {
  signin: {
    heading: "Welcome back",
    cta: "Login",
    toggleHint: "New to Memento?",
    toggleLabel: "Sign up",
  },
  signup: {
    heading: "Create your account",
    cta: "Create account",
    toggleHint: "Already have an account?",
    toggleLabel: "Login",
  },
};

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("signin");
  const [pipState, setPipState] = useState<PipState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const copy = COPY[mode];
  const isSignup = mode === "signup";

  function selectMode(m: Mode) {
    setMode(m);
    setPipState("idle");
    setError(null);
  }

  function handleTextInput() {
    setPipState("typing");
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setPipState("email"), 1100);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setPipState("submit");

    const email = emailRef.current?.value.trim() ?? "";
    const password = passwordRef.current?.value ?? "";

    clearPkceVerifierCookies();

    const { error: authError } = isSignup
      ? await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: nameRef.current?.value.trim() ?? "" } },
        })
      : await supabase.auth.signInWithPassword({ email, password });

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

      <div className="relative hidden w-1/2 flex-col items-center justify-center md:flex">
        <mascot-companion state={pipState} size={300} assets="/mascot-companion/" suppressHydrationWarning />
        <span className="absolute bottom-16 text-xs font-semibold uppercase tracking-[0.14em] text-[#034F46]/45">
          {CAPTION[pipState]}
        </span>
      </div>

      <div className="flex w-full justify-center px-8 py-16 md:w-1/2">
        <div className={`flex w-full max-w-md flex-col ${isSignup ? "gap-6 pt-2" : "gap-10 pt-6"}`}>
          <Link href="/" className="flex items-center gap-3 text-xl font-semibold tracking-tight text-[#034F46]">
            <Image src="/logo.png" alt="Memento" width={44} height={44} className="h-11 w-auto" priority />
            <span>Memento</span>
          </Link>

          <div className="flex gap-8">
            <button
              type="button"
              onClick={() => selectMode("signin")}
              className={`-mb-px border-b-2 pb-3 text-base font-semibold transition ${
                mode === "signin"
                  ? "border-[#034F46] text-[#034F46]"
                  : "border-transparent text-[#034F46]/40 hover:text-[#034F46]/70"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => selectMode("signup")}
              className={`-mb-px border-b-2 pb-3 text-base font-semibold transition ${
                mode === "signup"
                  ? "border-[#034F46] text-[#034F46]"
                  : "border-transparent text-[#034F46]/40 hover:text-[#034F46]/70"
              }`}
            >
              Sign up
            </button>
          </div>

          <h1 className={`text-4xl font-bold tracking-tight text-[#034F46] ${isSignup ? "mt-3" : "mt-8"}`}>
            {copy.heading}
          </h1>

          <form onSubmit={handleSubmit} className={`flex flex-col ${isSignup ? "gap-3" : "gap-5"}`}>
            {mode === "signup" && (
              <label className="flex flex-col gap-1.5 text-base font-medium text-[#034F46]">
                Name
                <input
                  ref={nameRef}
                  type="text"
                  autoComplete="name"
                  placeholder="Jane Doe"
                  required
                  onFocus={() => setPipState("email")}
                  onBlur={() => setPipState("idle")}
                  onChange={handleTextInput}
                  className={inputClass}
                />
              </label>
            )}

            <label className="flex flex-col gap-1.5 text-base font-medium text-[#034F46]">
              Email
              <input
                ref={emailRef}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
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
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder="••••••••"
                required
                minLength={6}
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
              className={`rounded-full bg-[#034F46] px-5 py-3.5 text-base font-semibold text-[#FFFFEB] transition hover:brightness-110 disabled:opacity-60 ${
                isSignup ? "mt-1" : "mt-3"
              }`}
            >
              {copy.cta}
            </button>
          </form>

          <p className="text-center text-base text-[#034F46]/60">
            {copy.toggleHint}{" "}
            <button
              type="button"
              onClick={() => selectMode(mode === "signin" ? "signup" : "signin")}
              className="font-semibold text-[#034F46] hover:underline"
            >
              {copy.toggleLabel}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
