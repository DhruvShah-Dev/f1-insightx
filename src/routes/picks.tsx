import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import {
  Award,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Flag,
  Gauge,
  Lock,
  Medal,
  MousePointer2,
  RotateCcw,
  ShieldCheck,
  Timer,
  Trophy,
  UserRound,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { DriverAvatar, TeamBadge } from "@/components/driver-avatar";
import { SectionHeading, SiteShell } from "@/components/site-shell";
import { RaceFlagHero } from "@/components/race-flag-hero";
import { countryForRace, countryTheme } from "@/data/country-theme";
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
        content:
          "Sprint, qualifying and race picks, locked to your account and scored automatically once results land.",
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

type MarketGroup = "Sprint" | "Qualifying" | "Race" | "Drawn" | "Specials";

type Market = {
  id: string;
  group: MarketGroup;
  label: string;
  hint: string;
  payout: number;
};

type Card = Record<string, string>;
type Store = Record<string, Card>;
type MarketScore = { points: number; actual: string | null } | null;

const MARKET_GROUPS: MarketGroup[] = ["Race", "Qualifying", "Sprint", "Drawn", "Specials"];

const storageKey = (userId: string) => `f1ix.picks.v1.${userId}`;

function marketIcon(group: MarketGroup): LucideIcon {
  if (group === "Race") return Trophy;
  if (group === "Qualifying") return Gauge;
  if (group === "Sprint") return Zap;
  if (group === "Drawn") return CircleDot;
  return Timer;
}

function groupTone(group: MarketGroup) {
  if (group === "Race") return "var(--flag-a)";
  if (group === "Qualifying") return "var(--flag-b)";
  if (group === "Sprint") return "var(--flag-c)";
  if (group === "Drawn") return "var(--page-ink)";
  return "var(--race-country-accent)";
}

function marketsFor(challenge: PickChallenge): Market[] {
  const drawn: Market[] = challenge.randomPositions.map((position) => ({
    id: `random-${position}`,
    group: "Drawn",
    label: `P${position} finisher`,
    hint: "drawn finishing position",
    payout: 6,
  }));

  return [
    { id: "r1", group: "Race", label: "Race winner", hint: "race P1", payout: 3 },
    { id: "r2", group: "Race", label: "Runner up", hint: "race P2", payout: 4 },
    { id: "r3", group: "Race", label: "Third place", hint: "race P3", payout: 5 },
    { id: "q1", group: "Qualifying", label: "Pole", hint: "qualifying P1", payout: 3 },
    { id: "q2", group: "Qualifying", label: "Front row #2", hint: "qualifying P2", payout: 4 },
    { id: "q3", group: "Qualifying", label: "Qualifying P3", hint: "qualifying P3", payout: 5 },
    ...(challenge.hasSprint
      ? [
          {
            id: "sq1",
            group: "Sprint" as const,
            label: "Sprint Q P1",
            hint: "sprint qualifying pole",
            payout: 3,
          },
          {
            id: "s1",
            group: "Sprint" as const,
            label: "Sprint Race P1",
            hint: "sprint winner",
            payout: 3,
          },
        ]
      : []),
    ...drawn,
    {
      id: "fastest-lap",
      group: "Specials",
      label: "Fastest lap",
      hint: "quickest race lap",
      payout: 5,
    },
    {
      id: "fastest-pit",
      group: "Specials",
      label: "Fastest pit stop",
      hint: "shortest stationary stop",
      payout: 8,
    },
  ];
}

function actualFor(challenge: PickChallenge, marketId: string): string | null {
  const result = challenge.results;
  if (!result) return null;
  if (marketId === "sq1") return result.sprintQualifyingP1;
  if (marketId === "s1") return result.sprintRaceP1;
  if (marketId === "q1") return result.qualifying[0] ?? null;
  if (marketId === "q2") return result.qualifying[1] ?? null;
  if (marketId === "q3") return result.qualifying[2] ?? null;
  if (marketId === "r1") return result.race[0] ?? null;
  if (marketId === "r2") return result.race[1] ?? null;
  if (marketId === "r3") return result.race[2] ?? null;
  if (marketId === "fastest-lap") return result.fastestLapDriverId;
  if (marketId === "fastest-pit") return result.fastestPitDriverId;
  if (marketId.startsWith("random-")) {
    const position = Number(marketId.split("-")[1]);
    return result.randomPositions.find((entry) => entry.position === position)?.driverId ?? null;
  }
  return null;
}

function scoreMarket(
  challenge: PickChallenge,
  marketId: string,
  picked: string | undefined,
): MarketScore {
  if (!challenge.results || !picked) return null;
  const actual = actualFor(challenge, marketId);
  if (!actual) return null;
  if (actual === picked) return { points: 3, actual };
  if (["fastest-lap", "fastest-pit", "sq1", "s1"].includes(marketId)) {
    return { points: 0, actual };
  }
  const target = neighbourTargets(challenge, marketId);
  return { points: target.includes(picked) ? 1 : 0, actual };
}

function neighbourTargets(challenge: PickChallenge, marketId: string): string[] {
  const result = challenge.results;
  if (!result) return [];
  const list = marketId.startsWith("q") ? result.qualifying : result.race;
  const index = marketId.startsWith("random-") ? -1 : Number(marketId.slice(1)) - 1;
  if (index < 0) return [];
  return [list[index - 1], list[index + 1]].filter((value): value is string => Boolean(value));
}

function scoreLabel(score: MarketScore, settled: boolean) {
  if (!settled) return "open";
  if (!score) return "missed";
  if (score.points === 3) return "exact";
  if (score.points === 1) return "near";
  return "zero";
}

function RoundRail({
  challenges,
  activeRaceId,
  onChange,
}: {
  challenges: PickChallenge[];
  activeRaceId: string;
  onChange: (raceId: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {challenges.map((challenge) => {
        const active = challenge.raceId === activeRaceId;
        const theme = countryTheme(
          countryForRace({
            circuitId: challenge.circuitId,
            circuit: challenge.circuit,
            raceName: challenge.raceName,
          }),
        );
        return (
          <button
            key={challenge.raceId}
            type="button"
            onClick={() => onChange(challenge.raceId)}
            aria-pressed={active}
            className={`pw-card group min-w-48 shrink-0 overflow-hidden rounded-lg border text-left ${
              active ? "border-white text-white" : "border-border bg-card hover:border-primary"
            }`}
            style={active ? { backgroundColor: theme.flag[0] ?? theme.accent } : undefined}
          >
            <span aria-hidden className="flex h-2">
              {theme.flag.map((color, index) => (
                <span
                  key={`${challenge.raceId}-${color}-${index}`}
                  className="flex-1"
                  style={{ backgroundColor: color }}
                />
              ))}
            </span>
            <span className="block p-3">
              <span
                className={`num block text-[10px] uppercase ${
                  active ? "text-white/78" : "text-muted-foreground"
                }`}
              >
                Round {challenge.round}
              </span>
              <span className="mt-1 block truncate text-xs font-black uppercase italic">
                {challenge.raceName}
              </span>
              <span
                className={`num mt-1 block text-[10px] uppercase ${
                  active ? "text-white/78" : "text-muted-foreground"
                }`}
              >
                {challenge.results ? "settled" : "open card"}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MarketDeck({
  markets,
  card,
  challenge,
  activeMarketId,
  onSelect,
}: {
  markets: Market[];
  card: Card;
  challenge: PickChallenge;
  activeMarketId: string;
  onSelect: (marketId: string) => void;
}) {
  return (
    <div className="grid gap-2">
      {markets.map((market, index) => {
        const Icon = marketIcon(market.group);
        const active = market.id === activeMarketId;
        const picked = Boolean(card[market.id]);
        const score = scoreMarket(challenge, market.id, card[market.id]);
        const tone = groupTone(market.group);
        return (
          <button
            key={market.id}
            type="button"
            onClick={() => onSelect(market.id)}
            aria-pressed={active}
            className={`pw-ticker pw-card grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border p-3 text-left ${
              active
                ? "border-white bg-white text-[#07110c]"
                : "border-border bg-card hover:border-primary"
            }`}
            style={{
              animationDelay: `${index * 24}ms`,
              borderLeft: `5px solid ${tone}`,
            }}
          >
            <span
              className={`grid size-9 place-items-center rounded-md border ${
                active ? "border-[#07110c]" : "border-border"
              }`}
              style={{ color: active ? "#07110c" : tone }}
            >
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-black uppercase italic">
                {market.label}
              </span>
              <span
                className={`num mt-1 block text-[10px] uppercase ${
                  active ? "text-[#07110c]/70" : "text-muted-foreground"
                }`}
              >
                {market.group} / {market.hint}
              </span>
            </span>
            <span className="flex items-center gap-2">
              {picked ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <MousePointer2 className="size-4 opacity-45" />
              )}
              <span className="num text-[10px] font-black uppercase">
                {scoreLabel(score, Boolean(challenge.results))}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function DriverPool({
  entrants,
  activeMarket,
  pickedId,
  canEdit,
  onPick,
}: {
  entrants: PickEntrant[];
  activeMarket: Market;
  pickedId: string | undefined;
  canEdit: boolean;
  onPick: (driverId: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
      {entrants.map((entrant, index) => {
        const constructor = team(entrant.team);
        const picked = entrant.driverId === pickedId;
        return (
          <button
            key={entrant.driverId}
            type="button"
            disabled={!canEdit}
            onClick={() => onPick(entrant.driverId)}
            className={`pw-ticker pw-card min-h-28 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${
              picked
                ? "border-white bg-white text-[#07110c]"
                : "border-border bg-background hover:border-primary"
            }`}
            style={{
              animationDelay: `${Math.min(index, 18) * 18}ms`,
              borderTop: `4px solid ${constructor.color}`,
            }}
          >
            <span className="flex items-start justify-between gap-2">
              <DriverAvatar
                code={entrant.code}
                teamName={entrant.team}
                name={entrant.name}
                size="lg"
              />
              <span className="num text-right text-[10px] font-black uppercase">
                P{entrant.standingPosition}
                <span className={`block ${picked ? "text-[#07110c]/62" : "text-muted-foreground"}`}>
                  {entrant.points} pts
                </span>
              </span>
            </span>
            <span className="mt-3 block truncate text-sm font-black uppercase italic">
              {entrant.name}
            </span>
            <span className="mt-1 block">
              <TeamBadge teamName={entrant.team} showName />
            </span>
          </button>
        );
      })}
      {!canEdit ? (
        <div className="col-span-full rounded-lg border border-border bg-card p-4">
          <p className="num text-[11px] uppercase text-muted-foreground">
            {activeMarket.label} cannot be edited until the card is open and you are signed in.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function PickSlip({
  markets,
  card,
  challenge,
  byId,
  activeMarketId,
  onSelect,
}: {
  markets: Market[];
  card: Card;
  challenge: PickChallenge;
  byId: Map<string, PickEntrant>;
  activeMarketId: string;
  onSelect: (marketId: string) => void;
}) {
  const settled = Boolean(challenge.results);
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="label-xs">Pick slip</p>
          <h2 className="text-sm font-black uppercase italic">Current card</h2>
        </div>
        <ClipboardList className="size-4 text-primary" />
      </div>
      <div className="divide-y divide-border">
        {markets.map((market) => {
          const picked = card[market.id] ? byId.get(card[market.id]!) : undefined;
          const actualId = actualFor(challenge, market.id);
          const actual = actualId ? byId.get(actualId) : undefined;
          const score = scoreMarket(challenge, market.id, card[market.id]);
          const active = activeMarketId === market.id;
          return (
            <button
              key={market.id}
              type="button"
              onClick={() => onSelect(market.id)}
              className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors ${
                active ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              }`}
            >
              <span className="min-w-0">
                <span className="block text-xs font-black uppercase">{market.label}</span>
                <span className="num mt-1 flex items-center gap-2 text-[10px] uppercase text-muted-foreground">
                  <span>{picked ? picked.code : "empty"}</span>
                  {settled ? <span>actual {actual?.code ?? "-"}</span> : null}
                </span>
              </span>
              <span className="num rounded-sm border border-border px-2 py-1 text-[10px] font-black uppercase">
                {settled ? `${score?.points ?? 0} pts` : picked ? "set" : "pick"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProgressStrip({ filled, total }: { filled: number; total: number }) {
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <p className="label-xs text-white/62">Card completion</p>
        <p className="num text-[11px] font-black text-white">
          {filled}/{total}
        </p>
      </div>
      <div className="mt-2 flex h-3 overflow-hidden rounded-sm bg-white">
        {Array.from({ length: total }).map((_, index) => (
          <span
            key={index}
            className="h-full flex-1 border-r border-[#07110c] last:border-r-0"
            style={{ backgroundColor: index < filled ? "var(--primary)" : "var(--border)" }}
          />
        ))}
      </div>
    </div>
  );
}

function Picks() {
  const { data } = useSuspenseQuery(picksQuery);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [store, setStore] = useState<Store>({});
  const [raceId, setRaceId] = useState<string>(data.activeRaceId ?? "");
  const [activeMarketId, setActiveMarketId] = useState<string>("r1");
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
    data.challenges.find((entry) => entry.raceId === raceId) ??
    data.challenges.find((entry) => entry.raceId === data.activeRaceId) ??
    data.challenges[data.challenges.length - 1];

  const ledger = useMemo(
    () =>
      data.challenges
        .filter((entry) => entry.results && store[entry.raceId])
        .map((entry) => {
          const savedCard = store[entry.raceId] ?? {};
          const marketList = marketsFor(entry);
          const points = marketList.reduce(
            (acc, market) =>
              acc + (scoreMarket(entry, market.id, savedCard[market.id])?.points ?? 0),
            0,
          );
          return { round: entry.round, name: entry.raceName, points, cards: marketList.length };
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

  const challengeTheme = countryTheme(
    countryForRace({
      circuitId: challenge.circuitId,
      circuit: challenge.circuit,
      raceName: challenge.raceName,
    }),
  );
  const flagStart = challengeTheme.flag[0] ?? challengeTheme.accent;
  const flagMiddle = challengeTheme.flag[1] ?? "#ffffff";
  const flagEnd = challengeTheme.flag.at(-1) ?? challengeTheme.accent;
  const markets = marketsFor(challenge);
  const activeMarket = markets.find((market) => market.id === activeMarketId) ?? markets[0]!;
  const card = store[challenge.raceId] ?? {};
  const filled = markets.filter((market) => card[market.id]).length;
  const locked = challenge.lockAtISO ? Date.now() > Date.parse(challenge.lockAtISO) : false;
  const settled = Boolean(challenge.results);
  const signedIn = Boolean(session?.user);
  const accountRequired = authReady && !signedIn;
  const canEdit = signedIn && !locked && !settled;
  const byId = new Map(data.entrants.map((entrant) => [entrant.driverId, entrant]));
  const scored = markets.map((market) => ({
    market,
    score: scoreMarket(challenge, market.id, card[market.id]),
  }));
  const total = scored.reduce((acc, entry) => acc + (entry.score?.points ?? 0), 0);
  const maxPoints = scored.filter((entry) => entry.score).length * 3;
  const scoreBank = ledger.reduce((acc, entry) => acc + entry.points, 0);

  const groupedCounts = MARKET_GROUPS.map((group) => ({
    group,
    count: markets.filter((market) => market.group === group).length,
    filled: markets.filter((market) => market.group === group && card[market.id]).length,
  })).filter((group) => group.count);

  const set = (marketId: string, driverId: string) => {
    if (!canEdit) return;
    persist({
      ...store,
      [challenge.raceId]: { ...card, [marketId]: driverId },
    });
  };

  const clearCard = () => {
    const next = { ...store };
    delete next[challenge.raceId];
    persist(next);
  };

  const heroStats = [
    { label: "Round", value: `R${challenge.round}`, note: challenge.raceName },
    {
      label: "Status",
      value: settled ? "Settled" : locked ? "Locked" : "Open",
      note: challenge.lockAtISO
        ? `${settled ? "Results in" : "Locks"} ${fmtDateTime(challenge.lockAtISO)}`
        : "No lock time stored",
    },
    { label: "Filled", value: `${filled}/${markets.length}`, note: activeMarket.label },
    {
      label: "Score bank",
      value: String(scoreBank),
      note: `${ledger.length} settled card${ledger.length === 1 ? "" : "s"}`,
    },
  ];

  return (
    <SiteShell fullWidth>
      <div
        className="py-1"
        style={
          {
            "--primary": challengeTheme.accent,
            "--ring": challengeTheme.accent,
            "--race-country-accent": challengeTheme.accent,
            "--race-country-primary": flagStart,
            "--race-country-secondary": flagMiddle,
            "--race-country-tertiary": flagEnd,
            "--flag-a": flagStart,
            "--flag-b": flagMiddle,
            "--flag-c": flagEnd,
            "--page-ink": "#07110c",
          } as CSSProperties
        }
      >
        <RaceFlagHero
          kicker={
            <span className="inline-flex items-center gap-1">
              <Flag className="size-3" />
              Pit Wall Picks
            </span>
          }
          title="Build The Card"
          meta={`${challenge.raceName} / choose a market, then assign the driver.`}
          flag={challengeTheme.flag}
          stats={heroStats}
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="overflow-hidden rounded-lg border border-white/18 bg-white text-[#07110c]">
              <img
                src="/images/raceweek-pitlane-italy.png"
                alt=""
                className="h-44 w-full object-cover"
              />
              <div className="grid grid-cols-3 divide-x divide-[#07110c]/15">
                {groupedCounts.slice(0, 3).map((group) => {
                  const Icon = marketIcon(group.group);
                  return (
                    <button
                      key={group.group}
                      type="button"
                      onClick={() => {
                        const first = markets.find((market) => market.group === group.group);
                        if (first) setActiveMarketId(first.id);
                      }}
                      className="px-3 py-3 text-left transition-colors hover:bg-[#07110c] hover:text-white"
                    >
                      <Icon className="size-4" />
                      <span className="mt-2 block text-xs font-black uppercase italic">
                        {group.group}
                      </span>
                      <span className="num text-[10px] uppercase">
                        {group.filled}/{group.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="rounded-lg border border-white bg-[#07110c] p-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="label-xs text-white/62">Active market</p>
                  <h2 className="mt-1 text-2xl font-black uppercase italic leading-none">
                    {activeMarket.label}
                  </h2>
                  <p className="num mt-2 text-[11px] uppercase text-white/68">
                    {activeMarket.group} / {activeMarket.hint}
                  </p>
                </div>
                {(() => {
                  const Icon = marketIcon(activeMarket.group);
                  return <Icon className="size-8 text-white" />;
                })()}
              </div>
              <ProgressStrip filled={filled} total={markets.length} />
            </div>
          </div>
        </RaceFlagHero>

        <section className="mt-6">
          <SectionHeading
            kicker="Race selector"
            title="Choose the round"
            action={
              <span className="num text-[10px] uppercase text-muted-foreground">
                active race controls the page colors
              </span>
            }
          />
          <RoundRail
            challenges={data.challenges}
            activeRaceId={challenge.raceId}
            onChange={setRaceId}
          />
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)_24rem]">
          <aside className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="label-xs">Markets</p>
                  <h2 className="text-lg font-black uppercase italic">Command deck</h2>
                </div>
                <Medal className="size-5 text-primary" />
              </div>
              <div className="mt-4">
                <MarketDeck
                  markets={markets}
                  card={card}
                  challenge={challenge}
                  activeMarketId={activeMarket.id}
                  onSelect={setActiveMarketId}
                />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <p className="label-xs">Card controls</p>
              <div className="mt-3 grid gap-2">
                {accountRequired ? (
                  <Link
                    to="/account"
                    className="inline-flex items-center justify-center gap-2 rounded-sm bg-primary px-3 py-2 text-xs font-black uppercase italic text-primary-foreground"
                  >
                    <UserRound className="size-4" />
                    Sign in to pick
                  </Link>
                ) : null}
                {filled && canEdit ? (
                  <button
                    type="button"
                    onClick={clearCard}
                    className="inline-flex items-center justify-center gap-2 rounded-sm border border-border px-3 py-2 text-xs font-black uppercase italic text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  >
                    <RotateCcw className="size-4" />
                    Clear card
                  </button>
                ) : null}
                <div className="rounded-sm border border-border bg-background p-3">
                  <div className="flex items-center gap-2">
                    {locked || settled ? (
                      <Lock className="size-4 text-primary" />
                    ) : (
                      <ShieldCheck className="size-4 text-primary" />
                    )}
                    <p className="text-xs font-black uppercase">
                      {settled
                        ? "Results scored"
                        : locked
                          ? "Card locked"
                          : canEdit
                            ? "Ready for picks"
                            : "Account required"}
                    </p>
                  </div>
                  <p className="num mt-2 text-[10px] uppercase text-muted-foreground">
                    {settled
                      ? `This card scored ${total}/${maxPoints || markets.length * 3}.`
                      : challenge.lockAtISO
                        ? `Lock time ${fmtDateTime(challenge.lockAtISO)}`
                        : "No lock time stored"}
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <main className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
              <div>
                <p className="label-xs">Driver pool</p>
                <h2 className="text-2xl font-black uppercase italic tracking-tight">
                  Assign {activeMarket.label}
                </h2>
                <p className="num mt-1 text-[11px] uppercase text-muted-foreground">
                  Click a driver to fill the active market.
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-sm border border-primary px-3 py-2 text-xs font-black uppercase text-primary">
                <MousePointer2 className="size-4" />
                {card[activeMarket.id] ? byId.get(card[activeMarket.id]!)?.code : "empty"}
              </span>
            </div>
            <div className="mt-4">
              <DriverPool
                entrants={data.entrants}
                activeMarket={activeMarket}
                pickedId={card[activeMarket.id]}
                canEdit={canEdit}
                onPick={(driverId) => set(activeMarket.id, driverId)}
              />
            </div>
          </main>

          <aside className="space-y-4">
            <PickSlip
              markets={markets}
              card={card}
              challenge={challenge}
              byId={byId}
              activeMarketId={activeMarket.id}
              onSelect={setActiveMarketId}
            />

            {ledger.length ? (
              <div className="rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div>
                    <p className="label-xs">Ledger</p>
                    <h2 className="text-sm font-black uppercase italic">Settled cards</h2>
                  </div>
                  <Award className="size-4 text-primary" />
                </div>
                <ul className="divide-y divide-border">
                  {ledger.map((entry, index) => (
                    <li
                      key={entry.round}
                      className="pw-ticker flex items-center gap-3 px-4 py-3"
                      style={{ animationDelay: `${index * 34}ms` }}
                    >
                      <span className="num text-[11px] text-muted-foreground">R{entry.round}</span>
                      <span className="min-w-0 flex-1 truncate text-xs font-bold uppercase">
                        {entry.name}
                      </span>
                      <span className="num text-xs font-black text-primary">
                        {entry.points} pts
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-primary" />
                  <p className="text-xs font-black uppercase">No settled cards yet</p>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  Your ledger appears after a saved card has official stored results.
                </p>
              </div>
            )}
          </aside>
        </section>

        {!hydrated ? (
          <p className="num mt-8 text-center text-xs text-muted-foreground">Checking account...</p>
        ) : null}
      </div>
    </SiteShell>
  );
}
