'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ScamBanner,
  ScamInterstitial,
  type ScamSignal,
} from '@/components/scam/ScamWarning';

type ScamAlert = ScamSignal;

interface PaymentPageProps {
  scamAlert?: ScamAlert;
}

const isMobile = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
    navigator.userAgent
  );
};

export default function PaymentPage({ scamAlert }: PaymentPageProps) {
  const params = useParams();
  const username = (params?.username as string) ?? '';
  const amount = (params?.amount as string) ?? '';

  const [showExplainer, setShowExplainer] = useState(false);
  const router = useRouter();
  const [alert, setAlert] = useState<ScamAlert | null>(scamAlert ?? null);
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  // Treat alerts without an explicit confidence as high: fail safe.
  const isHighConfidence = alert?.isScam === true && alert.confidence !== 'low';
  const blocked = isHighConfidence && !riskAccepted;

  useEffect(() => {
    if (scamAlert) {
      setAlert(scamAlert);
      return;
    }

    let cancelled = false;

    async function fetchScamAlert() {
      try {
        const res = await fetch(
          `/api/scam-alert?username=${encodeURIComponent(username)}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as ScamAlert;
        if (!cancelled) setAlert(data);
      } catch {
        // Silently ignore — absence of an alert is the safe default.
      }
    }

    if (username) {
      fetchScamAlert();
    }

    return () => {
      cancelled = true;
    };
  }, [username, scamAlert]);

  const handleFreighter = () => {
    if (isMobile()) {
      window.location.href = `freighter://pay?to=${encodeURIComponent(
        username
      )}&amount=${encodeURIComponent(amount)}`;
    } else {
      window.open('https://www.freighter.app/', '_blank', 'noopener,noreferrer');
    }
  };

  const handleLobstr = () => {
    window.open(
      `https://lobstr.co/`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <main className="min-h-screen bg-white px-4 py-8 sm:px-6 sm:py-12">
      {blocked && alert && (
        <ScamInterstitial
          alert={alert}
          onProceed={() => setRiskAccepted(true)}
          onCancel={() => router.push('/')}
        />
      )}
      <div className="mx-auto w-full max-w-md" aria-hidden={blocked || undefined} inert={blocked || undefined}>
        {alert?.isScam && !isHighConfidence && !bannerDismissed && (
          <ScamBanner alert={alert} onDismiss={() => setBannerDismissed(true)} />
        )}

        <h1 className="text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">
          Pay {amount} to @{username}
        </h1>

        <p className="mt-3 text-base leading-relaxed text-gray-700">
          You&apos;ll send {amount} directly to @{username}&apos;s Stellar
          wallet — no middleman, no account needed.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleFreighter}
            disabled={blocked}
            className="w-full rounded-lg bg-indigo-700 px-5 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            Pay with Freighter
          </button>

          <button
            type="button"
            onClick={handleLobstr}
            disabled={blocked}
            className="w-full rounded-lg bg-indigo-700 px-5 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            Pay with Lobstr
          </button>
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setShowExplainer(true)}
            className="text-sm font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            I don&apos;t have a wallet yet
          </button>
        </div>

        <p className="mt-8 text-center text-xs leading-relaxed text-gray-600">
          Powered by Stellar · Funds go directly to @{username}&apos;s wallet
        </p>
      </div>

      {showExplainer && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="explainer-title"
          onClick={() => setShowExplainer(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="explainer-title"
              className="text-lg font-bold text-gray-900"
            >
              What&apos;s a Stellar wallet?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-700">
              A Stellar wallet is a free app that lets you hold and send digital
              dollars and other currencies. You stay in control of your money —
              no bank account required.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-gray-700">
              To pay @{username}, install a wallet like Freighter or Lobstr,
              fund it, then come back to this page and tap a payment button.
            </p>
            <button
              type="button"
              onClick={() => setShowExplainer(false)}
              className="mt-6 w-full rounded-lg bg-indigo-700 px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </main>
  );
}