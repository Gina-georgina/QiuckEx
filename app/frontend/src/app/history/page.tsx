"use client";

import { Suspense } from "react";
import PaymentHistoryContent from "./PaymentHistoryContent";
import { TransactionTableSkeleton } from "@/components/skeletons/Skeletons";

export default function PaymentHistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-6 py-10">
          <TransactionTableSkeleton />
        </div>
      }
    >
      <PaymentHistoryContent />
    </Suspense>
  );
}
