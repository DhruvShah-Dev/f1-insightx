import type { CSSProperties } from "react";

export default function Loading() {
  const telemetrySteps = ["Session index", "Track model", "Race pace", "Strategy layer"];

  return (
    <main className="app-loading-shell f1-loading" aria-live="polite" aria-busy="true">
      <section className="f1-loading__stage" aria-label="Loading F1 InsightX race intelligence">
        <div className="f1-loading__backdrop" aria-hidden="true">
          <span className="f1-loading__beam f1-loading__beam--one" />
          <span className="f1-loading__beam f1-loading__beam--two" />
          <span className="f1-loading__grid" />
        </div>

        <div className="f1-loading__copy">
          <p className="subpage-eyebrow">F1 InsightX / Live race intelligence</p>
          <h1>Preparing the grid.</h1>
          <p>Building the next page from timing, strategy, and circuit context.</p>
        </div>

        <div className="f1-loading__lights" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <span key={index} style={{ "--light-index": index } as CSSProperties} />
          ))}
        </div>

        <div className="f1-loading__progress" aria-hidden="true">
          <span />
          <i />
        </div>

        <div className="f1-loading__telemetry" aria-hidden="true">
          {telemetrySteps.map((step, index) => (
            <div className="f1-loading__step" key={step} style={{ "--step-index": index } as CSSProperties}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step}</strong>
              <i />
            </div>
          ))}
        </div>

        <div className="f1-loading__preview" aria-hidden="true">
          <span className="f1-loading__preview-line f1-loading__preview-line--wide" />
          <span className="f1-loading__preview-line" />
          <span className="f1-loading__preview-map" />
          <span className="f1-loading__preview-row" />
          <span className="f1-loading__preview-row" />
        </div>
      </section>
    </main>
  );
}
