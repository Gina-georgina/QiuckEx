"use client";

import { useEffect, useId, useState } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { trackEvent } from "@/lib/trackEvent";

export type ScamSignalType = "no_memo" | "unusual_amount" | "unknown_username" | "other";
export type ScamConfidence = "high" | "low";

export interface ScamSignal {
  isScam: boolean;
  reason?: string;
  signal?: ScamSignalType;
  confidence?: ScamConfidence;
}

export const SIGNAL_LABELS: Record<ScamSignalType, { title: string; why: string }> = {
  no_memo: {
    title: "No memo",
    why: "Exchanges and custodial wallets usually require a memo. A missing memo can mean funds are lost or misdirected.",
  },
  unusual_amount: {
    title: "Unusual amount",
    why: "This amount is far outside what this recipient normally receives.",
  },
  unknown_username: {
    title: "Unknown username",
    why: "This username is new or has no payment history, which is common with impersonation.",
  },
  other: {
    title: "Suspicious request",
    why: "Our safety checks flagged this payment request.",
  },
};

/** Interstitial copy — kept ≤ 60 words (see issue #479). */
export const INTERSTITIAL_COPY =
  "This payment request shows signs of a scam. Payments on Stellar are final and cannot be reversed. Only continue if you know and trust the recipient and have confirmed the details through another channel.";

function signalOf(alert: ScamSignal): ScamSignalType {
  return alert.signal ?? "other";
}

export function ScamInterstitial({
  alert,
  onProceed,
  onCancel,
}: {
  alert: ScamSignal;
  onProceed: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const descId = useId();
  const checkboxId = useId();
  const [understood, setUnderstood] = useState(false);
  const signal = signalOf(alert);
  const containerRef = useFocusTrap<HTMLDivElement>(true, onCancel);

  useEffect(() => {
    trackEvent("scam_alert_shown", { signal, confidence: "high" });
  }, [signal]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
      <div
        ref={containerRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-md rounded-2xl border-2 border-red-500 bg-white p-6 text-gray-900 shadow-2xl"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-red-700">
          Scam warning · {SIGNAL_LABELS[signal].title}
        </p>
        <h2 id={titleId} className="mt-2 text-xl font-bold">
          Stop — this may be a scam
        </h2>
        <div id={descId}>
          <p className="mt-3 text-sm leading-relaxed text-gray-800">{INTERSTITIAL_COPY}</p>
          <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            <strong>Why: </strong>
            {alert.reason ?? SIGNAL_LABELS[signal].why}
          </p>
        </div>
        <label htmlFor={checkboxId} className="mt-5 flex items-start gap-3 text-sm">
          <input
            id={checkboxId}
            type="checkbox"
            checked={understood}
            onChange={(e) => setUnderstood(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          I understand this payment may be a scam and cannot be reversed.
        </label>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              trackEvent("scam_alert_dismissed", { signal, confidence: "high", action: "cancel" });
              onCancel();
            }}
            className="w-full rounded-lg bg-gray-900 px-5 py-3 font-semibold text-white hover:bg-gray-700"
          >
            Go back to safety
          </button>
          <button
            type="button"
            disabled={!understood}
            onClick={() => {
              trackEvent("scam_alert_proceeded", { signal, confidence: "high" });
              onProceed();
            }}
            className="w-full rounded-lg border border-red-600 px-5 py-3 font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            I understand the risk — proceed
          </button>
        </div>
      </div>
    </div>
  );
}

export function ScamBanner({ alert, onDismiss }: { alert: ScamSignal; onDismiss: () => void }) {
  const tooltipId = useId();
  const [showWhy, setShowWhy] = useState(false);
  const signal = signalOf(alert);

  useEffect(() => {
    trackEvent("scam_alert_shown", { signal, confidence: "low" });
  }, [signal]);

  return (
    <div role="alert" className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-amber-900">
          <span aria-hidden="true">⚠️ </span>Be careful: {SIGNAL_LABELS[signal].title.toLowerCase()}
        </p>
        <button
          type="button"
          onClick={() => {
            trackEvent("scam_alert_dismissed", { signal, confidence: "low", action: "dismiss" });
            onDismiss();
          }}
          aria-label="Dismiss warning"
          className="text-amber-900 hover:text-amber-700"
        >
          ×
        </button>
      </div>
      <p className="mt-1 text-sm text-amber-800">
        Double-check the recipient before sending funds.{" "}
        <span className="relative inline-block">
          <button
            type="button"
            aria-describedby={showWhy ? tooltipId : undefined}
            aria-expanded={showWhy}
            onClick={() => setShowWhy((s) => !s)}
            onMouseEnter={() => setShowWhy(true)}
            onMouseLeave={() => setShowWhy(false)}
            onFocus={() => setShowWhy(true)}
            onBlur={() => setShowWhy(false)}
            onKeyDown={(e) => e.key === "Escape" && setShowWhy(false)}
            className="font-medium underline underline-offset-2"
          >
            Why this warning?
          </button>
          {showWhy && (
            <span
              id={tooltipId}
              role="tooltip"
              className="absolute left-0 top-full z-10 mt-2 w-64 rounded-lg bg-gray-900 p-3 text-xs text-white shadow-lg"
            >
              {alert.reason ?? SIGNAL_LABELS[signal].why}
            </span>
          )}
        </span>
      </p>
    </div>
  );
}
