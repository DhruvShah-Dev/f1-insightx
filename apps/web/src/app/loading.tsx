export default function Loading() {
  return (
    <main className="app-loading-shell" aria-live="polite" aria-busy="true">
      <section className="app-loading-panel">
        <div className="app-loading-panel__mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div>
          <p className="subpage-eyebrow">F1 InsightX</p>
          <h1>Loading race intelligence.</h1>
        </div>
      </section>
    </main>
  );
}
