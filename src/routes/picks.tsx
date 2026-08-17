import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { SectionHeading, SiteShell, Stat } from "@/components/site-shell";
import { DriverAvatar, TeamBadge } from "@/components/driver-avatar";
import { team } from "@/data/teams";
import { fmtDateTime, fmtNum } from "@/lib/format";
import { getPicksBoard, type PickChallenge, type PickEntrant } from "@/lib/f1.functions";


const picksQuery = queryOptions({
  queryKey: ["picks-board"],
  queryFn: () => getPicksBoard({ data: {} }),
  staleTime: 5 * 60_000,
});

export const Route = createFileRoute("/picks")({
  loader: ({ context }) => context.queryClient.ensureQueryData(picksQuery),
  head: () => ({
    meta: [
      { title: "Pit Wall Picks — F1 prediction card & scoring" },
      {
        name: "description",
        content:
          "Place your card for the next 2026 F1 round: qualifying top three, podium, two drawn positions, fastest lap and fastest pit stop. Scored against stored results, 3 points exact, 1 point within a place.",
      },
      { property: "og:title", content: "Pit Wall Picks — F1 prediction card" },
      {
        property: "og:description",
        content: "Ten markets, house odds from live 2026 form, scored automatically once results land.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => (
    <SiteShell>
      <p role="alert" className="text-sm text-destructive">
        Picks table closed: {error.message}
      </p>
    </SiteShell>
  ),
  component: Picks,
});

type Market = {
  id: string;
  group: "Qualifying" | "Race" | "Drawn" | "Specials";
  label: string;
  hint: string;
  payout: number;
};

const STORAGE = "f1ix.picks.v1";
type Card = Record<string, string>;
type Store = Record<string, Card>;

function marketsFor(ch: PickChallenge): Market[] {
  const drawn: Market[] = ch.randomPositions.map((p) => ({
    id: `random-${p}`,
    group: "Drawn" as const,
    label: `P${p} finisher`,
    hint: "drawn position from the challenge card",
    payout: 6,
  }));
  return [
    { id: "q1", group: "Qualifying", label: "Pole", hint: "qualifying P1", payout: 3 },
    { id: "q2", group: "Qualifying", label: "Front row #2", hint: "qualifying P2", payout: 4 },
    { id: "q3", group: "Qualifying", label: "Qualifying P3", hint: "second row inside", payout: 5 },
    { id: "r1", group: "Race", label: "Race winner", hint: "chequered flag P1", payout: 3 },
    { id: "r2", group: "Race", label: "Runner up", hint: "race P2", payout: 4 },
    { id: "r3", group: "Race", label: "Third place", hint: "race P3", payout: 5 },
    ...drawn,
    {
      id: "fastest-lap",
      group: "Specials",
      label: "Fastest lap",
      hint: "quickest single race lap",
      payout: 5,
    },
    {
      id: "fastest-pit",
      group: "Specials",
      label: "Fastest pit stop",
      hint: "shortest stationary time",
      payout: 8,
    },
  ];
}

function actualFor(ch: PickChallenge, marketId: string): string | null {
  const r = ch.results;
  if (!r) return null;
  if (marketId === "q1") return r.qualifying[0] ?? null;
  if (marketId === "q2") return r.qualifying[1] ?? null;
  if (marketId === "q3") return r.qualifying[2] ?? null;
  if (marketId === "r1") return r.race[0] ?? null;
  if (marketId === "r2") return r.race[1] ?? null;
  if (marketId === "r3") return r.race[2] ?? null;
  if (marketId === "fastest-lap") return r.fastestLapDriverId;
  if (marketId === "fastest-pit") return r.fastestPitDriverId;
  if (marketId.startsWith("random-")) {
    const p = Number(marketId.split("-")[1]);
    return r.randomPositions.find((x) => x.position === p)?.driverId ?? null;
  }
  return null;
}

/** Mirrors the stored scoring rule: 3 for exact, 1 for within one place, else 0. */
function scoreMarket(
  ch: PickChallenge,
  marketId: string,
  picked: string | undefined,
): { points: number; actual: string | null } | null {
  if (!ch.results || !picked) return null;
  const actual = actualFor(ch, marketId);
  if (!actual) return null;
  if (actual === picked) return { points: 3, actual };
  if (marketId === "fastest-lap" || marketId === "fastest-pit") return { points: 0, actual };
  const target = neighbourTargets(ch, marketId);
  return { points: target.includes(picked) ? 1 : 0, actual };
}

function neighbourTargets(ch: PickChallenge, marketId: string): string[] {
  const r = ch.results;
  if (!r) return [];
  const list = marketId.startsWith("q") ? r.qualifying : r.race;
  const idx = marketId.startsWith("random-")
    ? -1
    : Number(marketId.slice(1)) - 1;
  if (idx < 0) return [];
  return [list[idx - 1], list[idx + 1]].filter((x): x is string => Boolean(x));
}

function Picks() {
  const { data } = useSuspenseQuery(picksQuery);
  const [store, setStore] = useState<Store>({});
  const [raceId, setRaceId] = useState<string>(data.activeRaceId ?? "");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) setStore(JSON.parse(raw) as Store);
    } catch {
      /* first visit */
    }
    setHydrated(true);
  }, []);

  const persist = (next: Store) => {
    setStore(next);
    try {
      localStorage.setItem(STORAGE, JSON.stringify(next));
    } catch {
      /* storage blocked */
    }
  };

  const challenge =
    data.challenges.find((c) => c.raceId === raceId) ??
    data.challenges.find((c) => c.raceId === data.activeRaceId) ??
    data.challenges[data.challenges.length - 1];

  const ledger = useMemo(
    () =>
      data.challenges
        .filter((c) => c.results && store[c.raceId])
        .map((c) => {
          const cd = store[c.raceId] ?? {};
          const ms = marketsFor(c);
          const pts = ms.reduce((a, m) => a + (scoreMarket(c, m.id, cd[m.id])?.points ?? 0), 0);
          return { round: c.round, name: c.raceName, points: pts, cards: ms.length };
        })
        .sort((a, b) => b.round - a.round),
    [data.challenges, store],
  );
  const bankroll = ledger.reduce((a, x) => a + x.points, 0);

  if (!challenge) {
    return (
      <SiteShell>
        <p className="text-sm text-muted-foreground">No pick challenges stored for this season.</p>
      </SiteShell>
    );
  }

  const markets = marketsFor(challenge);
  const card = store[challenge.raceId] ?? {};
  const filled = markets.filter((m) => card[m.id]).length;
  const locked = challenge.lockAtISO ? Date.now() > Date.parse(challenge.lockAtISO) : false;
  const settled = Boolean(challenge.results);

  const byId = new Map(data.entrants.map((e) => [e.driverId, e]));
  const set = (marketId: string, driverId: string) =>
    persist({
      ...store,
      [challenge.raceId]: { ...card, [marketId]: driverId },
    });

  const scored = markets.map((m) => ({ m, s: scoreMarket(challenge, m.id, card[m.id]) }));
  const total = scored.reduce((a, x) => a + (x.s?.points ?? 0), 0);
  const maxPoints = scored.filter((x) => x.s).length * 3;

  return (
    <SiteShell>
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-[radial-gradient(120%_140%_at_50%_-20%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_65%)] p-5 sm:p-7">
        <div
          aria-hidden
          className="pw-drift pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, currentColor 0 1px, transparent 1px 14px)",
          }}
        />
        <div
          aria-hidden
          className="pw-glow pointer-events-none absolute -left-16 -top-24 size-56 rounded-full bg-primary/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pw-glow pointer-events-none absolute -bottom-28 right-0 size-64 rounded-full bg-positive/20 blur-3xl [animation-delay:1.4s]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 overflow-hidden"
        >
          <div className="pw-sweep h-full w-24 bg-gradient-to-r from-transparent via-primary/25 to-transparent blur-xl" />
        </div>
        <p className="label-xs pw-ticker relative">Pit wall table · house rules</p>
        <h1 className="pw-flip-in relative mt-1 text-3xl font-black uppercase italic tracking-tighter sm:text-4xl">
          Pit Wall Picks
        </h1>
        <p className="pw-ticker relative mt-2 max-w-2xl text-sm text-muted-foreground [animation-delay:0.12s]">
          Ten markets per round. Odds are derived from the live {data.season} championship form after
          round {data.standingsRound} — they are a form indicator, not a betting line. Cards stay on
          this device and score themselves as soon as the official results land.
        </p>
        <div className="relative mt-5 grid gap-3 sm:grid-cols-4">
          <Stat label="Round" value={`R${challenge.round}`} note={challenge.raceName} />
          <Stat
            label="Card status"
            value={settled ? "Settled" : locked ? "Locked" : "Open"}
            note={
              challenge.lockAtISO
                ? `${settled ? "Results in" : "Locks"} ${fmtDateTime(challenge.lockAtISO)}`
                : "No lock time stored"
            }
          />
          <Stat label="Markets filled" value={`${filled}/${markets.length}`} />
          <Stat
            label="Bankroll"
            value={String(bankroll)}
            unit="pts"
            note={`${ledger.length} settled card${ledger.length === 1 ? "" : "s"}`}
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="label-xs" htmlFor="round">
            Round
          </label>
          <select
            id="round"
            value={challenge.raceId}
            onChange={(e) => setRaceId(e.target.value)}
            className="mt-2 border border-border bg-background px-2 py-2 text-sm font-bold uppercase text-foreground"
          >
            {data.challenges.map((c) => (
              <option key={c.raceId} value={c.raceId}>
                R{c.round} {c.raceName}
                {c.results ? " · settled" : ""}
              </option>
            ))}
          </select>
        </div>
        {filled ? (
          <button
            type="button"
            onClick={() => {
              const next = { ...store };
              delete next[challenge.raceId];
              persist(next);
            }}
            className="num rounded-sm border border-border px-3 py-2 text-[11px] font-black uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
          >
            Clear card
          </button>
        ) : null}
        {settled ? (
          <span className="num ml-auto rounded-sm border border-positive/30 bg-positive/10 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-positive">
            Scored {total} / {maxPoints} pts
          </span>
        ) : null}
      </div>

      {!hydrated ? (
        <p className="num mt-10 text-center text-xs text-muted-foreground">Dealing card…</p>
      ) : (
        <section className="mt-8">
          <SectionHeading
            kicker="Your card"
            title="Ten markets"
            action={
              <span className="num text-[10px] text-muted-foreground">
                3 pts exact · 1 pt within a place
              </span>
            }
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {scored.map(({ m, s }, i) => {
              const pickedId = card[m.id];
              const picked = pickedId ? byId.get(pickedId) : undefined;
              const t = team(picked?.team);
              const actual = s?.actual ? byId.get(s.actual) : undefined;
              return (
                <div
                  key={m.id}
                  className="pw-card pw-flip-in rounded-lg border border-border bg-card/50 p-3 hover:pw-card-hover hover:border-primary/40"
                  style={{
                    animationDelay: `${i * 45}ms`,
                    ...(picked ? { borderLeft: `4px solid ${t.color}` } : {}),
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide">{m.label}</p>
                      <p className="num text-[10px] text-muted-foreground">{m.hint}</p>
                    </div>
                    <span className="num shrink-0 rounded-sm border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                      {m.group}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <span key={pickedId ?? "empty"} className="pw-chip-pop">
                      <DriverAvatar
                        code={picked?.code ?? "—"}
                        teamName={picked?.team}
                        name={picked?.name}
                      />
                    </span>

                    <div className="min-w-0 flex-1">
                      <select
                        aria-label={m.label}
                        value={pickedId ?? ""}
                        disabled={locked}
                        onChange={(e) => set(m.id, e.target.value)}
                        className="w-full border border-border bg-background px-2 py-2 text-sm font-bold uppercase text-foreground disabled:opacity-60"
                      >
                        <option value="">— select driver —</option>
                        {data.entrants.map((e) => (
                          <option key={e.driverId} value={e.driverId}>
                            {e.code} — {e.name} ({e.odds.toFixed(1)})
                          </option>
                        ))}
                      </select>
                      {picked ? (
                        <div className="mt-1.5">
                          <TeamBadge teamName={picked.team} showName />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {s ? (
                    <div className="mt-2 flex items-center justify-between">
                      <span className="num flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        Result
                        {actual ? (
                          <DriverAvatar
                            code={actual.code}
                            teamName={actual.team}
                            name={actual.name}
                            size="sm"
                          />
                        ) : (
                          "—"
                        )}
                      </span>
                      <span
                        className={`num pw-chip-pop rounded-sm px-1.5 py-0.5 text-[10px] font-black uppercase ${
                          s.points === 3
                            ? "bg-positive/15 text-positive"
                            : s.points === 1
                              ? "bg-primary/15 text-primary"
                              : "bg-destructive/15 text-destructive"
                        }`}
                      >
                        {s.points} pts
                      </span>
                    </div>
                  ) : settled ? (
                    <p className="num mt-2 text-[11px] text-muted-foreground">
                      Result {byId.get(actualFor(challenge, m.id) ?? "")?.code ?? "—"} · no pick made
                    </p>
                  ) : locked ? (
                    <p className="num mt-2 text-[11px] text-muted-foreground">
                      Card locked — awaiting stored result
                    </p>
                  ) : picked ? (
                    <p className="num mt-2 text-[11px] text-muted-foreground">
                      {picked.code} · P{picked.standingPosition} in the championship ·{" "}
                      {picked.points} pts
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-12">
        <SectionHeading kicker="House odds" title={`Form board after R${data.standingsRound}`} />
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left">
            <thead className="bg-card/60">
              <tr>
                <th className="label-xs px-3 py-2">#</th>
                <th className="label-xs px-3 py-2">Driver</th>
                <th className="label-xs px-3 py-2">Team</th>
                <th className="label-xs px-3 py-2 text-right">Points</th>
                <th className="label-xs px-3 py-2 text-right">Wins</th>
                <th className="label-xs px-3 py-2 text-right">Odds</th>
              </tr>
            </thead>
            <tbody>
              {data.entrants.map((e: PickEntrant, i: number) => {
                return (
                  <tr
                    key={e.driverId}
                    className="pw-ticker border-t border-border/60 transition-colors hover:bg-primary/5"
                    style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                  >
                    <td className="num px-3 py-1.5 text-xs text-muted-foreground">
                      {e.standingPosition}
                    </td>
                    <td className="px-3 py-1.5 text-xs font-bold uppercase">
                      <span className="flex items-center gap-2">
                        <DriverAvatar code={e.code} teamName={e.team} name={e.name} size="sm" />
                        <span className="truncate">
                          {e.code} <span className="text-muted-foreground">{e.name}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-xs">
                      <TeamBadge teamName={e.team} showName />
                    </td>

                    <td className="num px-3 py-1.5 text-right text-xs font-bold">{e.points}</td>
                    <td className="num px-3 py-1.5 text-right text-xs">{e.wins}</td>
                    <td className="num px-3 py-1.5 text-right text-xs font-bold text-primary">
                      {fmtNum(e.odds, 1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {ledger.length ? (
        <section className="mt-12">
          <SectionHeading kicker="Ledger" title="Settled cards" />
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {ledger.map((l, i) => (
              <li
                key={l.round}
                className="pw-ticker flex items-center gap-3 px-3 py-2 transition-colors hover:bg-primary/5"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <span className="num text-[11px] text-muted-foreground">R{l.round}</span>
                <span className="text-xs font-bold uppercase">{l.name}</span>
                <span className="num ml-auto text-xs font-black text-primary">{l.points} pts</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </SiteShell>
  );
}
