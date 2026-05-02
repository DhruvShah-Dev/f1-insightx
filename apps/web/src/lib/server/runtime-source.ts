export type RuntimeMode = "primary" | "degraded" | "unavailable";

export type RuntimeSourceKind = "database" | "csv-product" | "csv-canonical";

export type RuntimeSourceMetadata = {
  surface: "homepage" | "race-week" | "strategy-lab" | "analytics" | "reference";
  mode: RuntimeMode;
  sourceKind: RuntimeSourceKind | null;
  sourceLabel: string | null;
  reason: string | null;
  generatedAt: string | null;
  buildVersion: string | null;
  eventId: string | null;
  season: number | null;
  round: number | null;
};

export type RuntimeSourceResult<T> =
  | {
      mode: "primary" | "degraded";
      data: T;
      meta: RuntimeSourceMetadata;
    }
  | {
      mode: "unavailable";
      data: null;
      meta: RuntimeSourceMetadata;
    };

type RuntimeAttempt<T> = {
  load: () => Promise<T | null>;
  sourceKind: RuntimeSourceKind;
  sourceLabel: string;
  describe?: (data: T) => Partial<RuntimeSourceMetadata>;
};

function toReason(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown runtime source failure.";
}

export async function resolveRuntimeSource<T>(options: {
  surface: RuntimeSourceMetadata["surface"];
  primary: RuntimeAttempt<T>;
  degraded?: RuntimeAttempt<T>;
}): Promise<RuntimeSourceResult<T>> {
  let primaryReason: string | null = null;

  try {
    const primaryData = await options.primary.load();
    if (primaryData !== null) {
      return {
        mode: "primary",
        data: primaryData,
        meta: {
          surface: options.surface,
          mode: "primary",
          sourceKind: options.primary.sourceKind,
          sourceLabel: options.primary.sourceLabel,
          reason: null,
          generatedAt: null,
          buildVersion: null,
          eventId: null,
          season: null,
          round: null,
          ...options.primary.describe?.(primaryData),
        },
      };
    }

    primaryReason = `Primary ${options.primary.sourceLabel} returned no data.`;
  } catch (error) {
    primaryReason = toReason(error);
  }

  if (options.degraded) {
    try {
      const degradedData = await options.degraded.load();
      if (degradedData !== null) {
        return {
          mode: "degraded",
          data: degradedData,
          meta: {
            surface: options.surface,
            mode: "degraded",
            sourceKind: options.degraded.sourceKind,
            sourceLabel: options.degraded.sourceLabel,
            reason: primaryReason,
            generatedAt: null,
            buildVersion: null,
            eventId: null,
            season: null,
            round: null,
            ...options.degraded.describe?.(degradedData),
          },
        };
      }

      return {
        mode: "unavailable",
        data: null,
        meta: {
          surface: options.surface,
          mode: "unavailable",
          sourceKind: null,
          sourceLabel: null,
          reason: `Primary failed (${primaryReason ?? "unknown"}); degraded ${options.degraded.sourceLabel} returned no data.`,
          generatedAt: null,
          buildVersion: null,
          eventId: null,
          season: null,
          round: null,
        },
      };
    } catch (error) {
      return {
        mode: "unavailable",
        data: null,
        meta: {
          surface: options.surface,
          mode: "unavailable",
          sourceKind: null,
          sourceLabel: null,
          reason: `Primary failed (${primaryReason ?? "unknown"}); degraded ${options.degraded.sourceLabel} failed (${toReason(error)}).`,
          generatedAt: null,
          buildVersion: null,
          eventId: null,
          season: null,
          round: null,
        },
      };
    }
  }

  return {
    mode: "unavailable",
    data: null,
    meta: {
      surface: options.surface,
      mode: "unavailable",
      sourceKind: null,
      sourceLabel: null,
      reason: primaryReason,
      generatedAt: null,
      buildVersion: null,
      eventId: null,
      season: null,
      round: null,
    },
  };
}

export function getRuntimeData<T>(result: RuntimeSourceResult<T>): T | null {
  return result.mode === "unavailable" ? null : result.data;
}
