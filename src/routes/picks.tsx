import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { DriverAvatar, TeamBadge } from "@/components/driver-avatar";
import { SectionHeading, SiteShell } from "@/components/site-shell";
import { RaceFlagHero } from "@/components/race-flag-hero";
import { team } from "@/data/teams";
import { supabase } from "@/integrations/supabase/client";
import { fmtDateTime } from "@/lib/format";
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
      { title: "Pit Wall Picks - F1 prediction card & scoring" },
      {
        name: "description",
        content:
          "Place your card for the next 2026 F1 round: sprint picks when available, qualifying top three, podium, drawn positions, fastest lap and fastest pit stop. Scored against stored results.",
      },
      { property: "og:title", content: "Pit Wall Picks - F1 prediction card" },
      {
        property: "og:description",
        content: "Sprint, qualifying and race picks, locked to your account and scored automatically once results land.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => (
    <SiteShell fullWidth>
      <p role="alert" className="text-sm text-destructive">
        Picks table closed: {error.message}
      </p>
    </SiteShell>
  ),
  component: Picks,
});

type Market = {
  id: string;
  group: "Sprint" | "Qualifying" | "Race" | "Drawn" | "Specials";
  label: string;
  hint: string;
  payout: number;
};

type Card = Record<string, string>;
type Store = Record<string, Card>;
type MarketScore = { points: number; actual: string | null } | null;

const CASINO_RED = "#AE1C28";
const CASINO_WHITE = "#FFFFFF";
const CASINO_BLUE = "#21468B";
const MARKET_GROUPS: Market["group"][] = ["Sprint", "Qualifying", "Race", "Drawn", "Specials"];

const storageKey = (userId: string) => `f1ix.picks.v1.${userId}`;

function groupTone(group: Market["group"]) {
  if (group === "Race") return CASINO_RED;
  if (group === "Sprint") return CASINO_WHITE;
  if (group === "Qualifying") return CASINO_BLUE;
  if (group === "Drawn") return "color-mix(in oklab, var(--casino-red) 55%, var(--casino-blue))";
  return "color-mix(in oklab, var(--casino-white) 72%, var(--casino-blue))";
}

function CasinoMark({ small = false }: { small?: boolean }) {
  return (
    <div
      className={`casino-neon relative grid place-items-center rounded-full border-2 bg-background ${
        small ? "size-9" : "size-16"
      }`}
      style={{ borderColor: CASINO_WHITE }}
      aria-label="F1 InsightX"
    >
      <span
        aria-hidden
        className="casino-wheel absolute inset-1 rounded-full border border-dashed opacity-80"
        style={{ borderColor: CASINO_RED }}
      />
      <span className={`font-display font-black italic leading-none ${small ? "text-xs" : "text-lg"}`}>
        F1<span style={{ color: CASINO_RED }}>-X</span>
      </span>
    </div>
  );
}

function ChipStat({
  label,
  value,
  note,
  tone = "red",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "red" | "blue" | "white";
}) {
  const color = tone === "blue" ? CASINO_BLUE : tone === "white" ? CASINO_WHITE : CASINO_RED;
  return (
    <div
      className="casino-deal rounded-full border-4 bg-background p-1 shadow-[0_18px_40px_-28px_rgba(255,255,255,0.55)]"
      style={{ borderColor: color }}
    >
      <div
        className="flex min-h-28 flex-col items-center justify-center rounded-full border border-dashed px-4 text-center"
        style={{ borderColor: color }}
      >
        <p className="label-xs">{label}</p>
        <p className="num mt-1 text-xl font-black" style={{ color }}>
          {value}
        </p>
        {note ? <p className="mt-1 max-w-28 text-[10px] leading-tight text-muted-foreground">{note}</p> : null}
      </div>
    </div>
  );
}

function FeltPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden border ${className}`}
      style={{
        borderColor: "color-mix(in oklab, var(--casino-white) 20%, transparent)",
        backgroundColor: "#08080A",
      }}
    >
      <div className="relative">{children}</div>
    </div>
  );
}

function marketsFor(ch: PickChallenge): Market[] {
  const drawn: Market[] = ch.randomPositions.map((p) => ({
    id: `random-${p}`,
    group: "Drawn",
    label: `P${p} finisher`,
    hint: "drawn finishing position",
    payout: 6,
  }));

  return [
    ...(ch.hasSprint
      ? [
          {
            id: "sq1",
            group: "Sprint" as const,
            label: "Sprint Q P1",
            hint: "sprint qualifying pole only",
            payout: 3,
          },
          {
            id: "s1",
            group: "Sprint" as const,
            label: "Sprint Race P1",
            hint: "sprint winner only",
            payout: 3,
          },
        ]
      : []),
    { id: "q1", group: "Qualifying", label: "Pole", hint: "qualifying P1", payout: 3 },
    { id: "q2", group: "Qualifying", label: "Front row #2", hint: "qualifying P2", payout: 4 },
    { id: "q3", group: "Qualifying", label: "Qualifying P3", hint: "qualifying P3", payout: 5 },
    { id: "r1", group: "Race", label: "Race winner", hint: "race P1", payout: 3 },
    { id: "r2", group: "Race", label: "Runner up", hint: "race P2", payout: 4 },
    { id: "r3", group: "Race", label: "Third place", hint: "race P3", payout: 5 },
    ...drawn,
    { id: "fastest-lap", group: "Specials", label: "Fastest lap", hint: "quickest race lap", payout: 5 },
    { id: "fastest-pit", group: "Specials", label: "Fastest pit stop", hint: "shortest stationary stop", payout: 8 },
  ];
}

function actualFor(ch: PickChallenge, marketId: string): string | null {
  const r = ch.results;
  if (!r) return null;
  if (marketId === "sq1") return r.sprintQualifyingP1;
  if (marketId === "s1") return r.sprintRaceP1;
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

function scoreMarket(ch: PickChallenge, marketId: string, picked: string | undefined): MarketScore {
  if (!ch.results || !picked) return null;
  const actual = actualFor(ch, marketId);
  if (!actual) return null;
  if (actual === picked) return { points: 3, actual };
  if (["fastest-lap", "fastest-pit", "sq1", "s1"].includes(marketId)) return { points: 0, actual };
  const target = neighbourTargets(ch, marketId);
  return { points: target.includes(picked) ? 1 : 0, actual };
}

function neighbourTargets(ch: PickChallenge, marketId: string): string[] {
  const r = ch.results;
  if (!r) return [];
  const list = marketId.startsWith("q") ? r.qualifying : r.race;
  const idx = marketId.startsWith("random-") ? -1 : Number(marketId.slice(1)) - 1;
  if (idx < 0) return [];
  return [list[idx - 1], list[idx + 1]].filter((x): x is string => Boolean(x));
}

function StatusBadge({ score, settled }: { score: MarketScore; settled: boolean }) {
  if (!score && !settled) return null;
  if (!score) {
    return <span className="num rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-black uppercase">open</span>;
  }
  const cls =
    score.points === 3
      ? "bg-positive/15 text-positive"
      : score.points === 1
        ? "bg-primary/15 text-primary"
        : "bg-destructive/15 text-destructive";
  return (
    <span className={`num pw-chip-pop rounded-sm px-1.5 py-0.5 text-[10px] font-black uppercase ${cls}`}>
      {score.points} pts
    </span>
  );
}

function MarketCard({
  market,
  score,
  index,
  entrants,
  byId,
  pickedId,
  canEdit,
  settled,
  locked,
  accountRequired,
  actualId,
  onPick,
}: {
  market: Market;
  score: MarketScore;
  index: number;
  entrants: PickEntrant[];
  byId: Map<string, PickEntrant>;
  pickedId: string | undefined;
  canEdit: boolean;
  settled: boolean;
  locked: boolean;
  accountRequired: boolean;
  actualId: string | null;
  onPick: (marketId: string, driverId: string) => void;
}) {
  const picked = pickedId ? byId.get(pickedId) : undefined;
  const pickedTeam = team(picked?.team);
  const actual = actualId ? byId.get(actualId) : undefined;
  const tone = picked ? pickedTeam.color : groupTone(market.group);

  return (
    <div
      className="pw-card casino-deal rounded-xl border p-3 shadow-[0_20px_55px_-42px_rgba(255,255,255,0.8)] hover:pw-card-hover"
      style={{
        animationDelay: `${index * 45}ms`,
        backgroundColor: "#101014",
        borderColor: tone,
        ...(picked ? { borderLeft: `5px solid ${pickedTeam.color}` } : {}),
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide">{market.label}</p>
          <p className="num text-[10px] text-muted-foreground">{market.hint}</p>
        </div>
        <span
          className="num shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold"
          style={{ borderColor: groupTone(market.group), color: groupTone(market.group) }}
        >
          {market.group}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <span key={pickedId ?? "empty"} className="pw-chip-pop">
          <DriverAvatar code={picked?.code ?? "-"} teamName={picked?.team} name={picked?.name} />
        </span>
        <div className="min-w-0 flex-1">
          <select
            aria-label={market.label}
            value={pickedId ?? ""}
            disabled={!canEdit}
            onChange={(e) => onPick(market.id, e.target.value)}
            className="w-full border bg-background px-2 py-2 text-sm font-bold uppercase text-foreground outline-none transition-colors focus:border-white disabled:opacity-60"
            style={{ borderColor: tone }}
          >
            <option value="">Select driver</option>
            {entrants.map((e) => (
              <option key={e.driverId} value={e.driverId}>
                {e.code} - {e.name}
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

      {score ? (
        <div className="mt-2 flex items-center justify-between">
          <span className="num flex items-center gap-1.5 text-[11px] text-muted-foreground">
            Result
            {actual ? <DriverAvatar code={actual.code} teamName={actual.team} name={actual.name} size="sm" /> : "-"}
          </span>
          <StatusBadge score={score} settled={settled} />
        </div>
      ) : settled ? (
        <p className="num mt-2 text-[11px] text-muted-foreground">Result {actual?.code ?? "-"} / no pick made</p>
      ) : accountRequired ? (
        <p className="num mt-2 text-[11px] text-muted-foreground">Sign in to lock this pick to your account</p>
      ) : locked ? (
        <p className="num mt-2 text-[11px] text-muted-foreground">Card locked / awaiting stored result</p>
      ) : picked ? (
        <p className="num mt-2 text-[11px] text-muted-foreground">
          {picked.code} / P{picked.standingPosition} in the championship / {picked.points} pts
        </p>
      ) : null}
    </div>
  );
}

function Picks() {
  const { data } = useSuspenseQuery(picksQuery);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [store, setStore] = useState<Store>({});
  const [raceId, setRaceId] = useState<string>(data.activeRaceId ?? "");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      void supabase.auth.getSession().then(({ data }) => {
        setSession(data.session);
        setAuthReady(true);
      });
      const { data: auth } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession);
        setAuthReady(true);
      });
      return () => auth.subscription.unsubscribe();
    } catch {
      setAuthReady(true);
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!session?.user) {
      setStore({});
      setHydrated(true);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey(session.user.id));
      setStore(raw ? (JSON.parse(raw) as Store) : {});
    } catch {
      setStore({});
    }
    setHydrated(true);
  }, [authReady, session?.user]);

  const persist = (next: Store) => {
    if (!session?.user) return;
    setStore(next);
    try {
      localStorage.setItem(storageKey(session.user.id), JSON.stringify(next));
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

  if (!challenge) {
    return (
      <SiteShell>
        <p className="text-sm text-muted-foreground">No pick challenges stored for this season.</p>
      </SiteShell>
    );
  }

  const scoreBank = ledger.reduce((a, x) => a + x.points, 0);
  const markets = marketsFor(challenge);
  const card = store[challenge.raceId] ?? {};
  const filled = markets.filter((m) => card[m.id]).length;
  const locked = challenge.lockAtISO ? Date.now() > Date.parse(challenge.lockAtISO) : false;
  const settled = Boolean(challenge.results);
  const signedIn = Boolean(session?.user);
  const accountRequired = authReady && !signedIn;
  const canEdit = signedIn && !locked;
  const byId = new Map(data.entrants.map((e) => [e.driverId, e]));
  const scored = markets.map((m) => ({ m, s: scoreMarket(challenge, m.id, card[m.id]) }));
  const total = scored.reduce((a, x) => a + (x.s?.points ?? 0), 0);
  const maxPoints = scored.filter((x) => x.s).length * 3;
  const grouped = MARKET_GROUPS.map((group) => ({
    group,
    items: scored.filter((x) => x.m.group === group),
  })).filter((x) => x.items.length);

  const set = (marketId: string, driverId: string) => {
    if (!canEdit) return;
    persist({
      ...store,
      [challenge.raceId]: { ...card, [marketId]: driverId },
    });
  };

  return (
    <SiteShell fullWidth>
      <div
        style={
          {
            "--casino-red": CASINO_RED,
            "--casino-white": CASINO_WHITE,
            "--casino-blue": CASINO_BLUE,
          } as CSSProperties
        }
        className="py-1"
      >
        <RaceFlagHero
          kicker="F1-X picks"
          title="Pit Wall Picks"
          meta={`${markets.length} markets this round. Cards lock to your account and score when official results land.`}
          stats={[
            { label: "Round", value: `R${challenge.round}`, note: challenge.raceName },
            {
              label: "Status",
              value: settled ? "Settled" : locked ? "Locked" : "Open",
              note: challenge.lockAtISO
                ? `${settled ? "Results in" : "Locks"} ${fmtDateTime(challenge.lockAtISO)}`
                : "No lock time stored",
            },
            { label: "Filled", value: `${filled}/${markets.length}` },
            { label: "Score bank", value: String(scoreBank), note: `${ledger.length} settled card${ledger.length === 1 ? "" : "s"}` },
          ]}
        />

        <FeltPanel className="mt-6 rounded-xl p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label-xs" htmlFor="round">
                Round
              </label>
              <select
                id="round"
                value={challenge.raceId}
                onChange={(e) => setRaceId(e.target.value)}
                className="mt-2 border bg-background px-3 py-2 text-sm font-bold uppercase text-foreground outline-none transition-colors focus:border-white"
                style={{ borderColor: CASINO_BLUE }}
              >
                {data.challenges.map((c) => (
                  <option key={c.raceId} value={c.raceId}>
                    R{c.round} {c.raceName}
                    {c.results ? " / settled" : ""}
                  </option>
                ))}
              </select>
            </div>
            {filled && canEdit ? (
              <button
                type="button"
                onClick={() => {
                  const next = { ...store };
                  delete next[challenge.raceId];
                  persist(next);
                }}
                className="num rounded-sm border px-3 py-2 text-[11px] font-black uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                style={{ borderColor: CASINO_WHITE }}
              >
                Clear card
              </button>
            ) : null}
            {accountRequired ? (
              <Link
                to="/account"
                className="num ml-auto rounded-sm border px-3 py-2 text-[11px] font-black uppercase tracking-wider transition-colors hover:bg-white hover:text-background"
                style={{ borderColor: CASINO_RED, color: CASINO_RED }}
              >
                Sign in to lock picks
              </Link>
            ) : null}
            {settled ? (
              <span
                className="num casino-neon ml-auto rounded-sm border px-3 py-2 text-[11px] font-black uppercase tracking-wider"
                style={{ borderColor: CASINO_BLUE, color: CASINO_WHITE }}
              >
                Scored {total} / {maxPoints} pts
              </span>
            ) : null}
          </div>
        </FeltPanel>

        {accountRequired ? (
          <div
            className="mt-5 border p-4"
            style={{
              borderColor: CASINO_RED,
              backgroundColor: "color-mix(in oklab, var(--casino-red) 12%, transparent)",
            }}
          >
            <p className="text-sm font-black uppercase italic">Account required</p>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              Picks are locked to a signed-in profile. Sign in with Google before selecting drivers so your card belongs
              to one account.
            </p>
          </div>
        ) : null}

        {!hydrated ? (
          <p className="num mt-10 text-center text-xs text-muted-foreground">Checking account...</p>
        ) : (
          <section className="mt-8">
            <SectionHeading
              kicker="Your card"
              title={`${markets.length} markets`}
              action={
                <span className="flex items-center gap-2">
                  <CasinoMark small />
                  <span className="num text-[10px] text-muted-foreground">3 pts exact / 1 pt within a place</span>
                </span>
              }
            />
            <div className="space-y-5">
              {grouped.map(({ group, items }, groupIndex) => (
                <div
                  key={group}
                  className="casino-deal border p-3 sm:p-4"
                  style={{
                    animationDelay: `${groupIndex * 80}ms`,
                    backgroundColor: "#0C0C10",
                    borderColor: groupTone(group),
                  }}
                >
                  <div className="mb-3 flex items-center justify-between gap-3 border-b border-border/70 pb-3">
                    <div className="flex items-center gap-3">
                      <CasinoMark small />
                      <div>
                        <p className="label-xs" style={{ color: groupTone(group) }}>
                          {group}
                        </p>
                        <h2 className="text-lg font-black uppercase italic tracking-tight">
                          {group === "Sprint" ? "Sprint P1 calls" : `${group} lane`}
                        </h2>
                      </div>
                    </div>
                    <span className="num text-[10px] font-black uppercase text-muted-foreground">
                      {items.length} pick{items.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {items.map(({ m, s }, itemIndex) => (
                      <MarketCard
                        key={m.id}
                        market={m}
                        score={s}
                        index={groupIndex * 6 + itemIndex}
                        entrants={data.entrants}
                        byId={byId}
                        pickedId={card[m.id]}
                        canEdit={canEdit}
                        settled={settled}
                        locked={locked}
                        accountRequired={accountRequired}
                        actualId={actualFor(challenge, m.id)}
                        onPick={set}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

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
      </div>
    </SiteShell>
  );
}
