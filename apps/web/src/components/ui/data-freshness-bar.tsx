"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export type DataFreshnessInfo = {
  /** Stable key so a new pipeline run re-shows a bar the visitor dismissed. */
  version: string;
  tone: "ok" | "warning";
  resultsThrough: string;
  nextRace: string | null;
  generatedLabel: string | null;
  ageLabel: string | null;
  note: string | null;
};

const STORAGE_KEY = "f1ix:data-freshness-dismissed";

export function DataFreshnessBar({ info }: { info: DataFreshnessInfo }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    setDismissed(stored === info.version);
  }, [info.version]);

  if (dismissed) {
    return null;
  }

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, info.version);
    } catch {
      // Storage can be blocked; hiding for this page view is still correct.
    }
    setDismissed(true);
  };

  return (
    <aside className={`data-freshness data-freshness--${info.tone}`} aria-label="Data freshness">
      <p className="data-freshness__label">Data freshness</p>
      <p className="data-freshness__text">
        <strong>Standings complete through {info.resultsThrough}</strong>
        {info.nextRace ? <span> · Race-week pages look ahead to {info.nextRace}</span> : null}
        {info.generatedLabel ? <span> · Snapshot {info.generatedLabel}</span> : null}
        {info.ageLabel ? <span> ({info.ageLabel})</span> : null}
        {info.note ? <span className="data-freshness__note"> · {info.note}</span> : null}
      </p>
      {/* The three dates in this strip legitimately differ; saying why turns an
          apparent contradiction into context. */}
      <p className="data-freshness__explainer">
        Standings and analysis follow completed results; race-week signals run ahead to the next round.
      </p>
      <span className="data-freshness__actions">
        <Link className="data-freshness__link" href="/race-analysis">
          Latest analysis
        </Link>
        <button className="data-freshness__dismiss" type="button" onClick={dismiss}>
          Dismiss
        </button>
      </span>
    </aside>
  );
}
