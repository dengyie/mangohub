export default function DashboardSkeleton() {
  return (
    <div
      className="dashboard-skeleton container mx-auto space-y-4 px-4"
      role="status"
      aria-busy="true"
      aria-label="Loading monitoring dashboard"
    >
      <span className="sr-only">Fetching live server data</span>

      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="dashboard-skeleton__status-dot" aria-hidden="true" />
          <span className="text-xs font-medium tracking-wide text-muted-foreground">
            Preparing your dashboard
          </span>
        </div>
        <div className="mango-skeleton h-3 w-20 rounded-full" aria-hidden="true" />
      </div>

      <div className="dashboard-skeleton__map relative w-full overflow-hidden rounded-2xl border border-border/60">
        <div className="dashboard-skeleton__map-grid" aria-hidden="true" />
        <div className="dashboard-skeleton__map-orbit dashboard-skeleton__map-orbit--outer" aria-hidden="true" />
        <div className="dashboard-skeleton__map-orbit dashboard-skeleton__map-orbit--inner" aria-hidden="true" />
        <div className="dashboard-skeleton__map-core" aria-hidden="true">
          <span className="dashboard-skeleton__map-pulse" />
        </div>
        <div className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="mango-skeleton h-4 w-32 rounded-full" aria-hidden="true" />
            <div className="mango-skeleton h-3 w-48 rounded-full" aria-hidden="true" />
          </div>
          <div className="mango-skeleton h-8 w-24 rounded-lg" aria-hidden="true" />
        </div>
      </div>

      <div
        className="grid w-full gap-4 py-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(284px, 1fr))" }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="dashboard-skeleton__card rounded-[14px] border border-border/60 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="mango-skeleton h-10 w-10 shrink-0 rounded-xl" aria-hidden="true" />
                <div className="min-w-0 space-y-2">
                  <div className="mango-skeleton h-3.5 w-28 rounded-full" aria-hidden="true" />
                  <div className="mango-skeleton h-2.5 w-20 rounded-full" aria-hidden="true" />
                </div>
              </div>
              <div className="mango-skeleton h-6 w-14 rounded-full" aria-hidden="true" />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((__, metricIndex) => (
                <div key={metricIndex} className="space-y-2 rounded-lg bg-muted/35 p-3">
                  <div className="mango-skeleton h-2.5 w-12 rounded-full" aria-hidden="true" />
                  <div className="mango-skeleton h-4 w-16 rounded-full" aria-hidden="true" />
                </div>
              ))}
            </div>
            <div className="mango-skeleton mt-4 h-2.5 w-2/3 rounded-full" aria-hidden="true" />
          </div>
        ))}
      </div>
    </div>
  );
}
