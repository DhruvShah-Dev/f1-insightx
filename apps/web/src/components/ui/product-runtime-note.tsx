import type { RuntimeSourceMetadata } from "@/lib/server/runtime-source";

type ProductRuntimeNoteProps = {
  runtime: RuntimeSourceMetadata | null | undefined;
  className?: string;
  primaryLabel?: string;
  degradedLabel?: string;
};

function formatRuntimeTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function ProductRuntimeNote({
  runtime,
  className,
  primaryLabel = "Primary product view",
  degradedLabel = "Fallback snapshot",
}: ProductRuntimeNoteProps) {
  if (!runtime || runtime.mode === "unavailable") {
    return null;
  }

  const updatedLabel = formatRuntimeTimestamp(runtime.generatedAt);
  const modeLabel = runtime.mode === "degraded" ? degradedLabel : primaryLabel;
  const detailLabel = updatedLabel ? `Updated ${updatedLabel}` : modeLabel;
  const titleParts = [
    runtime.sourceLabel ? `Source ${runtime.sourceLabel}` : null,
    runtime.buildVersion ? `Build ${runtime.buildVersion}` : null,
  ].filter(Boolean);

  return (
    <div
      className={["product-runtime-note", runtime.mode === "degraded" ? "product-runtime-note--degraded" : "", className]
        .filter(Boolean)
        .join(" ")}
      title={titleParts.length > 0 ? titleParts.join(" · ") : undefined}
    >
      {runtime.mode === "degraded" ? (
        <span className="product-runtime-note__badge">Fallback</span>
      ) : null}
      <span className="product-runtime-note__text">{detailLabel}</span>
    </div>
  );
}
