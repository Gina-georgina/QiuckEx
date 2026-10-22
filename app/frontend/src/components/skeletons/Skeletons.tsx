/**
 * Loading skeletons that mirror the layout of the loaded content so data
 * arrival causes no layout shift. All skeletons are hidden from assistive
 * tech; callers should render a visually-hidden status message alongside.
 */

function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-gray-500/20 ${className}`} />;
}

export function TransactionRowSkeleton() {
  return (
    <tr aria-hidden="true" data-testid="transaction-row-skeleton">
      <td className="px-6 py-4"><Bar className="h-4 w-28" /></td>
      <td className="px-6 py-4"><Bar className="h-5 w-16" /></td>
      <td className="px-6 py-4"><Bar className="h-4 w-20" /></td>
      <td className="px-6 py-4"><Bar className="h-4 w-24" /></td>
      <td className="px-6 py-4"><Bar className="h-4 w-20" /></td>
      <td className="px-6 py-4"><Bar className="h-4 w-20" /></td>
      <td className="px-6 py-4"><Bar className="ml-auto h-6 w-14" /></td>
    </tr>
  );
}

export function TransactionTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-3xl border border-border bg-card overflow-hidden">
      <span role="status" className="sr-only">Loading transactions…</span>
      <div className="overflow-x-auto">
        <table className="w-full text-left" aria-hidden="true">
          <thead>
            <tr className="border-b border-border">
              {Array.from({ length: 7 }, (_, i) => (
                <th key={i} className="px-6 py-4"><Bar className="h-3 w-12" /></th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Array.from({ length: rows }, (_, i) => (
              <TransactionRowSkeleton key={i} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-10" data-testid="dashboard-skeleton">
      <span role="status" className="sr-only">Loading dashboard…</span>
      <div aria-hidden="true" className="space-y-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <Bar className="h-4 w-24" />
            <Bar className="h-9 w-64" />
            <Bar className="h-4 w-80 max-w-full" />
          </div>
          <Bar className="h-10 w-32 rounded-xl" />
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-36 rounded-3xl border border-border bg-card p-6 space-y-4">
              <Bar className="h-3 w-20" />
              <Bar className="h-8 w-32" />
              <Bar className="h-3 w-24" />
            </div>
          ))}
        </div>
        <div className="rounded-3xl border border-border bg-card p-6 space-y-4">
          <Bar className="h-5 w-40" />
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <Bar className="h-4 w-1/3" />
              <Bar className="h-4 w-20" />
              <Bar className="h-5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
