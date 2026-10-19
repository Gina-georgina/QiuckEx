'use client';

import { useMemo } from 'react';

export interface Transaction {
  id: string;
  amount: string | number;
  asset?: string;
}

interface EarningsCardProps {
  transactions?: Transaction[];
  asset?: string;
}

const DEFAULT_ASSET = 'USDC';

export default function EarningsCard({
  transactions = [],
  asset = DEFAULT_ASSET,
}: EarningsCardProps) {
  const total = useMemo(() => {
    const records = Array.isArray(transactions) ? transactions : [];
    return records.reduce((sum, tx) => {
      const value = parseFloat(String(tx?.amount ?? 0));
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
  }, [transactions]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-gray-500">Total Earned</p>
      <p className="mt-2 text-3xl font-semibold text-gray-900">
        {total.toFixed(2)} {asset}
      </p>
    </div>
  );
}
