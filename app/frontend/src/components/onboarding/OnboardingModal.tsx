"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { checkUsernameAvailability, type UsernameAvailabilityResult } from "@/lib/api";
import { trackEvent } from "@/lib/trackEvent";

export const ONBOARDED_STORAGE_KEY = "quickex-onboarded";

const STEPS = ["What is QuickEx?", "Connect your wallet", "Claim your username"] as const;

const WALLETS = [
  {
    name: "Freighter",
    description: "Browser extension wallet by the Stellar Development Foundation.",
    installUrl: "https://www.freighter.app/",
  },
  {
    name: "Lobstr",
    description: "Mobile and web wallet for Stellar assets.",
    installUrl: "https://lobstr.co/",
  },
] as const;

const FEATURES = [
  "Get paid with a short link like quickex.to/you",
  "Funds settle directly to your Stellar wallet — no middleman",
  "Built-in scam alerts and payment history",
];

function readOnboarded(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDED_STORAGE_KEY) === "true";
  } catch {
    return true; // storage blocked: don't nag on every visit
  }
}

function markOnboarded() {
  try {
    window.localStorage.setItem(ONBOARDED_STORAGE_KEY, "true");
  } catch {
    // ignore
  }
}

export function OnboardingModal({ initialUsername = "" }: { initialUsername?: string }) {
  const router = useRouter();
  const titleId = useId();
  const descId = useId();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [wallet, setWallet] = useState<string | null>(null);
  const [username, setUsername] = useState(initialUsername);
  const [availability, setAvailability] = useState<UsernameAvailabilityResult | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!readOnboarded()) setOpen(true);
  }, []);

  const close = useCallback(
    (reason: "completed" | "skipped") => {
      markOnboarded();
      setOpen(false);
      trackEvent(reason === "completed" ? "onboarding_completed" : "onboarding_skipped", { step: step + 1 });
    },
    [step],
  );

  const skip = useCallback(() => close("skipped"), [close]);
  const containerRef = useFocusTrap<HTMLDivElement>(open, skip);

  useEffect(() => {
    if (step !== 2 || !username.trim()) {
      setAvailability(null);
      return;
    }
    const controller = new AbortController();
    setChecking(true);
    const timer = window.setTimeout(async () => {
      const result = await checkUsernameAvailability(username.trim(), controller.signal);
      if (!controller.signal.aborted) {
        setAvailability(result);
        setChecking(false);
      }
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      setChecking(false);
    };
  }, [step, username]);

  // Move focus to the first control whenever the step changes.
  useEffect(() => {
    if (!open) return;
    containerRef.current?.querySelector<HTMLElement>("[data-step-focus]")?.focus();
  }, [open, step, containerRef]);

  if (!open) return null;

  const confirm = () => {
    close("completed");
    router.push(`/generator?username=${encodeURIComponent(username.trim())}`);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-lg rounded-t-3xl border border-border bg-card p-6 shadow-2xl sm:rounded-3xl sm:p-8"
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <ol className="flex gap-2" aria-label="Onboarding progress">
            {STEPS.map((label, i) => (
              <li
                key={label}
                aria-current={i === step ? "step" : undefined}
                className={`h-1.5 w-10 rounded-full ${i <= step ? "bg-indigo-500" : "bg-border"}`}
              >
                <span className="sr-only">
                  Step {i + 1}: {label}
                  {i < step ? " (done)" : ""}
                </span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={skip}
            className="text-sm font-medium text-subtle underline-offset-4 hover:text-foreground hover:underline"
          >
            Skip
          </button>
        </div>

        <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">
          Step {step + 1} of {STEPS.length}
        </p>
        <h2 id={titleId} className="mt-1 text-2xl font-bold">
          {STEPS[step]}
        </h2>

        <div id={descId} className="mt-4" aria-live="polite">
          {step === 0 && (
            <>
              <p className="text-muted">
                QuickEx turns your Stellar wallet into a simple payment link anyone can use.
              </p>
              <ul className="mt-4 space-y-2">
                {FEATURES.map((f) => (
                  <li key={f} className="flex gap-2 text-sm">
                    <span aria-hidden="true" className="text-emerald-400">
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </>
          )}

          {step === 1 && (
            <fieldset>
              <legend className="text-muted">Pick the wallet you use. Don&apos;t have one? Install it first.</legend>
              <div className="mt-4 space-y-3">
                {WALLETS.map((w, i) => (
                  <label
                    key={w.name}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                      wallet === w.name ? "border-indigo-500 bg-indigo-500/10" : "border-border"
                    }`}
                  >
                    <input
                      type="radio"
                      name="onboarding-wallet"
                      value={w.name}
                      checked={wallet === w.name}
                      onChange={() => setWallet(w.name)}
                      className="mt-1"
                      {...(i === 0 ? { "data-step-focus": true } : {})}
                    />
                    <span className="flex-1">
                      <span className="block font-semibold">{w.name}</span>
                      <span className="block text-sm text-subtle">{w.description}</span>
                    </span>
                    <a
                      href={w.installUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-indigo-400 hover:underline"
                    >
                      Install<span className="sr-only"> {w.name} (opens in new tab)</span>
                    </a>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {step === 2 && (
            <div>
              <label htmlFor="onboarding-username" className="text-muted">
                Choose the name people will pay you at.
              </label>
              <div className="mt-3 flex items-center rounded-2xl border border-border bg-background px-4 focus-within:border-indigo-500">
                <span className="text-subtle" aria-hidden="true">
                  quickex.to/
                </span>
                <input
                  id="onboarding-username"
                  data-step-focus
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  autoComplete="username"
                  aria-describedby="onboarding-username-status"
                  className="w-full bg-transparent py-3 outline-none"
                />
              </div>
              <p
                id="onboarding-username-status"
                role="status"
                className={`mt-2 min-h-5 text-sm ${
                  availability?.status === "available" ? "text-emerald-400" : "text-subtle"
                }`}
              >
                {checking ? "Checking availability…" : availability?.message ?? ""}
              </p>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            className="rounded-xl border border-border px-5 py-3 font-semibold disabled:invisible"
          >
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              {...(step === 0 ? { "data-step-focus": true } : {})}
              className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-500"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={confirm}
              disabled={availability?.status !== "available"}
              className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              Claim username
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
