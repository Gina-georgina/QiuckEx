import React from "react";
import { Badge, type BadgeVariant } from "./Badge";

export type TransactionStatus = "pending" | "completed" | "failed";

export interface TransactionRowProps {
  counterparty: string;
  amount: string;
  asset: string;
  direction: "in" | "out";
  status: TransactionStatus;
  timestamp: string;
}

const statusVariant: Record<TransactionStatus, BadgeVariant> = {
  pending: "warning",
  completed: "success",
  failed: "danger",
};

export const TransactionRow: React.FC<TransactionRowProps> = ({
  counterparty,
  amount,
  asset,
  direction,
  status,
  timestamp,
}) => (
  <div className="flex items-center justify-between gap-4 border-b border-neutral-200 px-4 py-3">
    <div className="flex flex-col">
      <span className="font-medium text-neutral-900">{counterparty}</span>
      <time className="text-xs text-neutral-500" dateTime={timestamp}>
        {new Date(timestamp).toLocaleString()}
      </time>
    </div>
    <div className="flex items-center gap-3">
      <Badge variant={statusVariant[status]}>{status}</Badge>
      <span className={`font-semibold ${direction === "in" ? "text-green-700" : "text-neutral-900"}`}>
        {direction === "in" ? "+" : "−"}
        {amount} {asset}
      </span>
    </div>
  </div>
);

export default TransactionRow;
