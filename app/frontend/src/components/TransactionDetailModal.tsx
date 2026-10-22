"use client";

import { useId } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import type { ActivityFeedItem } from "@/hooks/activityFeedApi";

export const STELLAR_EXPERT_TX_URL = "https://stellar.expert/explorer/public/tx/";

function Field({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 py-2">
      <dt className="text-xs font-bold uppercase tracking-wider text-subtle">{label}</dt>
      <dd className={`min-w-0 break-all text-sm ${mono ? "font-mono" : ""}`}>
        {value ?? <span className="opacity-40">—</span>}
      </dd>
    </div>
  );
}

export function TransactionDetailModal({
  transaction,
  onClose,
}: {
  transaction: ActivityFeedItem | null;
  onClose: () => void;
}) {
  const titleId = useId();
  const open = transaction !== null;
  const containerRef = useFocusTrap<HTMLDivElement>(open, onClose);

  if (!transaction) return null;

  const timestamp = new Date(transaction.timestamp);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      data-testid="transaction-detail-backdrop"
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-t-3xl border border-border bg-card p-6 shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-xl font-bold">
            Transaction details
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close transaction details"
            className="rounded-lg px-2 text-2xl leading-none text-subtle hover:text-foreground"
          >
            ×
          </button>
        </div>

        <dl className="mt-4 divide-y divide-border">
          <Field label="Tx hash" value={transaction.id} mono />
          <Field
            label="Amount"
            value={
              <>
                <span className="font-bold">{transaction.amount}</span> {transaction.asset}
              </>
            }
          />
          <Field label="Sender" value={transaction.source} mono />
          <Field label="Recipient" value={transaction.destination} mono />
          <Field label="Memo" value={transaction.memo} />
          <Field label="Fee" value={transaction.fee != null ? `${transaction.fee} XLM` : null} />
          <Field label="Ledger" value={transaction.ledger != null ? String(transaction.ledger) : null} />
          <Field
            label="Timestamp"
            value={
              Number.isNaN(timestamp.getTime()) ? transaction.timestamp : (
                <time dateTime={transaction.timestamp}>{timestamp.toLocaleString()}</time>
              )
            }
          />
        </dl>

        <a
          href={`${STELLAR_EXPERT_TX_URL}${encodeURIComponent(transaction.id)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-500"
        >
          View on Stellar Expert <span aria-hidden="true">↗</span>
          <span className="sr-only">(opens in new tab)</span>
        </a>
      </div>
    </div>
  );
}
