import { createFileRoute, Link } from "@tanstack/react-router";
import { SectionHeading, SiteShell } from "@/components/site-shell";
import { seasonState } from "@/data/season";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/method")({
  head: () => ({
    meta: [
      { title: "Method — data sources, model design and known limits" },
      {
        name: "description",
        content:
          "How F1 InsightX builds its numbers: timing and telemetry sources, the offline pipeline, model spreads, and the limits you should read them with.",
      },
      { property: "og:title", content: "Method — sources, model and limits" },
      {
        property: "og:description",
        content: "Data sources, the offline pipeline, model spreads and known model limits.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Method,
});

const sources = [
  { name: "Session timing", detail: "Lap, sector and speed-trap times for every session since 2018." },
  { name: "Car telemetry", detail: "Throttle, brake, gear and speed traces sampled per lap." },
  { name: "Weather", detail: "Track and air temperature, humidity, wind and rainfall per session." },
  { name: "Tyre and stint logs", detail: "Compound, stint length and pit-lane deltas per driver." },
];

const limits = [
  "Projections are pace-based. Strategy calls, safety cars and incidents are not predicted.",
  "Model spread comes from historical outcomes for similar circuits, not a probability of the exact position.",
  "New circuits and regulation changes reduce the similarity weighting and widen the output range.",
  "Everything is computed offline and versioned. Nothing here updates live during a session.",
];

function Method() {
  return (
    <SiteShell>
      <h1 className="text-3xl font-black uppercase italic tracking-tighter sm:text-4xl">Method</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Every number on this site comes from one deterministic pipeline. Same inputs, same outputs,
        every time — and each page states what it was built from.
      </p>

      <section className="mt-10">
        <SectionHeading kicker="Inputs" title="Data sources" />
        <div className="grid gap-3 sm:grid-cols-2">
          {sources.map((s) => (
            <div key={s.name} className="rounded-lg border border-border bg-card/50 p-4">
              <p className="text-xs font-bold uppercase">{s.name}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{s.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <SectionHeading kicker="Pipeline" title="Four stages" />
        <ol className="space-y-2">
          {[
            "Ingest — pull session, telemetry and weather data, then freeze it as a versioned snapshot.",
            "Normalise — clean out-laps, traffic laps and red-flag runs so pace comparisons are like-for-like.",
            "Model — fit per-circuit pace, degradation and pit-loss models, then produce projections with spreads.",
            "Publish — write the read-only artefacts this site renders; each carries its run timestamp.",
          ].map((step, i) => (
            <li key={step} className="flex gap-3 bg-card/40 p-3">
              <span className="num text-xs font-bold text-primary">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-xs text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
        <p className="num mt-3 text-[11px] text-muted-foreground">
          Last run {fmtDateTime(seasonState.pipelineRunISO)} · complete through R
          {seasonState.resultsThrough.round}
        </p>
      </section>

      <section className="mt-10">
        <SectionHeading kicker="Honesty" title="Known limits" />
        <ul className="space-y-2">
          {limits.map((l) => (
            <li key={l} className="border-l-2 border-warning pl-3 text-xs text-muted-foreground">
              {l}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10">
        <Link
          to="/"
          className="bg-primary px-4 py-2 text-xs font-black uppercase italic text-primary-foreground"
        >
          Back to race control
        </Link>
      </div>
    </SiteShell>
  );
}
