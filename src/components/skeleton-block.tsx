/** Shimmering placeholder blocks used while a panel's data is in flight. */
export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`pw-shimmer block rounded-sm bg-secondary/60 ${className ?? "h-4 w-full"}`}
    />
  );
}

export function SkeletonPanel({
  rows = 6,
  label = "Loading data",
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <div
      className="mt-5 rounded-xl border border-border bg-card/40 p-4"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">{label}</span>
      <SkeletonBlock className="h-3 w-24" />
      <SkeletonBlock className="mt-2 h-6 w-48" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <SkeletonBlock className="h-2.5 w-full" />
            <SkeletonBlock className="h-2.5 w-24" />
            <SkeletonBlock className="h-2.5 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
