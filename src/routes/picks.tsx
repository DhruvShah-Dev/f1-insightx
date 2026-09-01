import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import {
  CalendarDays,
  Check,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Flag,
  Gauge,
  Lock,
  Medal,
  MousePointer2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Timer,
  Trophy,
  UserRound,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { DriverAvatar, TeamBadge } from "@/components/driver-avatar";
import { SiteShell } from "@/components/site-shell";
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
      { title: "Picks - F1 InsightX" },
      {
        name: "description",
        content:
          "Choose your race picks, save a card, and review scores when official results are stored.",
      },
      { property: "og:title", content: "Picks - F1 InsightX" },
      {
        property: "og:description",
        content: "Build a race pick card with driver selections for the selected Grand Prix.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => (
    <SiteShell fullWidth>
      <p role="alert" className="text-sm text-destructive">
        Picks unavailable: {error.message}
      </p>
    </SiteShell>
  ),
  component: Picks,
});

type PickGroup = "Race" | "Qualifying" | "Sprint" | "Positions" | "Speed";

type PickSlot = {
  id: string;
  group: PickGroup;
  title: string;
  shortTitle: string;
  helper: string;
};

type PickCard = Record<string, string>;
type SavedCards = Record<string, PickCard>;
type SlotScore = { points: number; actual: string | null } | null;

const GROUPS: PickGroup[] = ["Race", "Qualifying", "Sprint", "Positions", "Speed"];
const storageKey = (userId: string) => `f1ix.picks.v1.${userId}`;

function groupIcon(group: PickGroup): LucideIcon {
  if (group === "Race") return Trophy;
  if (group === "Qualifying") return Gauge;
  if (group === "Sprint") return Zap;
  if (group === "Positions") return CircleDot;
  return Timer;
}

function groupColor(group: PickGroup) {
  if (group === "Race") return "var(--flag-a)";
  if (group === "Qualifying") return "var(--flag-b)";
  if (group === "Sprint") return "var(--flag-c)";
  if (group === "Positions") return "var(--ink)";
  return "var(--accent)";
}

function pickSlotsFor(challenge: PickChallenge): PickSlot[] {
  return [
    { id: "r1", group: "Race", title: "Race winner", shortTitle: "Winner", helper: "Race P1" },
    { id: "r2", group: "Race", title: "Second place", shortTitle: "P2", helper: "Race P2" },
    { id: "r3", group: "Race", title: "Third place", shortTitle: "P3", helper: "Race P3" },
    {
      id: "q1",
      group: "Qualifying",
      title: "Pole position",
      shortTitle: "Pole",
      helper: "Qualifying P1",
    },
    {
      id: "q2",
      group: "Qualifying",
      title: "Qualifying second",
      shortTitle: "Q2",
      helper: "Qualifying P2",
    },
    {
      id: "q3",
      group: "Qualifying",
      title: "Qualifying third",
      shortTitle: "Q3",
      helper: "Qualifying P3",
    },
    ...(challenge.hasSprint
      ? [
          {
            id: "sq1",
            group: "Sprint" as const,
            title: "Sprint pole",
            shortTitle: "Sprint pole",
            helper: "Sprint qualifying P1",
          },
          {
            id: "s1",
            group: "Sprint" as const,
            title: "Sprint winner",
            shortTitle: "Sprint win",
            helper: "Sprint race P1",
          },
        ]
      : []),
    ...challenge.randomPositions.map((position) => ({
      id: `random-${position}`,
      group: "Positions" as const,
      title: `P${position} finisher`,
      shortTitle: `P${position}`,
      helper: "Final race result",
    })),
    {
      id: "fastest-lap",
      group: "Speed",
      title: "Fastest lap",
      shortTitle: "Fastest lap",
      helper: "Race lap",
    },
    {
      id: "fastest-pit",
      group: "Speed",
      title: "Fastest pit stop",
      shortTitle: "Pit stop",
      helper: "Shortest stop",
    },
  ];
}

function actualFor(challenge: PickChallenge, slotId: string): string | null {
  const result = challenge.results;
  if (!result) return null;
  if (slotId === "sq1") return result.sprintQualifyingP1;
  if (slotId === "s1") return result.sprintRaceP1;
  if (slotId === "q1") return result.qualifying[0] ?? null;
  if (slotId === "q2") return result.qualifying[1] ?? null;
  if (slotId === "q3") return result.qualifying[2] ?? null;
  if (slotId === "r1") return result.race[0] ?? null;
  if (slotId === "r2") return result.race[1] ?? null;
  if (slotId === "r3") return result.race[2] ?? null;
  if (slotId === "fastest-lap") return result.fastestLapDriverId;
  if (slotId === "fastest-pit") return result.fastestPitDriverId;
  if (slotId.startsWith("random-")) {
    const position = Number(slotId.split("-")[1]);
    return result.randomPositions.find((entry) => entry.position === position)?.driverId ?? null;
  }
  return null;
}

function neighbourTargets(challenge: PickChallenge, slotId: string): string[] {
  const result = challenge.results;
  if (!result || slotId.startsWith("random-")) return [];
  const list = slotId.startsWith("q") ? result.qualifying : result.race;
  const index = Number(slotId.slice(1)) - 1;
  if (!Number.isFinite(index) || index < 0) return [];
  return [list[index - 1], list[index + 1]].filter((value): value is string => Boolean(value));
}

function scorePick(
  challenge: PickChallenge,
  slotId: string,
  picked: string | undefined,
): SlotScore {
  if (!challenge.results || !picked) return null;
  const actual = actualFor(challenge, slotId);
  if (!actual) return null;
  if (actual === picked) return { points: 3, actual };
  if (["fastest-lap", "fastest-pit", "sq1", "s1"].includes(slotId)) {
    return { points: 0, actual };
  }
  return { points: neighbourTargets(challenge, slotId).includes(picked) ? 1 : 0, actual };
}

function scoreText(score: SlotScore, hasResult: boolean) {
  if (!hasResult) return "Open";
  if (!score) return "0 pts";
  return `${score.points} pts`;
}

function RaceChooser({
  challenges,
  activeRaceId,
  onChange,
}: {
  challenges: PickChallenge[];
  activeRaceId: string;
  onChange: (raceId: string) => void;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
      {challenges.map((challenge, index) => {
        const active = challenge.raceId === activeRaceId;
        const theme = countryTheme(
          countryForRace({
            circuitId: challenge.circuitId,
            circuit: challenge.circuit,
            raceName: challenge.raceName,
          }),
        );
        const color = theme.flag[0] ?? theme.accent;
        return (
          <button
            key={challenge.raceId}
            type="button"
            onClick={() => onChange(challenge.raceId)}
            aria-pressed={active}
            className={`pw-ticker pw-card group overflow-hidden rounded-lg border text-left ${
              active ? "border-white text-white" : "border-border bg-card hover:border-primary"
            }`}
            style={{
              animationDelay: `${index * 24}ms`,
              backgroundColor: active ? color : undefined,
            }}
          >
            <span aria-hidden className="flex h-2">
              {theme.flag.map((flagColor, flagIndex) => (
                <span
                  key={`${challenge.raceId}-${flagColor}-${flagIndex}`}
                  className="flex-1"
                  style={{ backgroundColor: flagColor }}
                />
              ))}
            </span>
            <span className="grid grid-cols-[1fr_auto] gap-3 p-3">
              <span className="min-w-0">
                <span className="num block text-[10px] uppercase">Round {challenge.round}</span>
                <span className="mt-1 block truncate text-sm font-black uppercase italic">
                  {challenge.raceName}
                </span>
              </span>
              <span className="grid size-8 place-items-center rounded-sm bg-background text-foreground">
                {challenge.results ? <Check className="size-4" /> : <Flag className="size-4" />}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SlotRail({
  slots,
  card,
  challenge,
  activeSlotId,
  onSelect,
}: {
  slots: PickSlot[];
  card: PickCard;
  challenge: PickChallenge;
  activeSlotId: string;
  onSelect: (slotId: string) => void;
}) {
  return (
    <div className="grid gap-2">
      {slots.map((slot, index) => {
        const active = slot.id === activeSlotId;
        const picked = Boolean(card[slot.id]);
        const score = scorePick(challenge, slot.id, card[slot.id]);
        const Icon = groupIcon(slot.group);
        const color = groupColor(slot.group);
        return (
          <button
            key={slot.id}
            type="button"
            onClick={() => onSelect(slot.id)}
            aria-pressed={active}
            className={`pw-ticker pw-card grid min-h-16 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border p-3 text-left ${
              active
                ? "border-white bg-white text-[#07110c]"
                : "border-border bg-card hover:border-primary"
            }`}
            style={{
              animationDelay: `${index * 18}ms`,
              borderLeft: `6px solid ${color}`,
            }}
          >
            <span
              className="grid size-9 place-items-center rounded-sm"
              style={{
                backgroundColor: color,
                color: slot.group === "Qualifying" ? "#07110c" : "#ffffff",
              }}
            >
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black uppercase italic">
                {slot.title}
              </span>
              <span className="num mt-1 block text-[10px] uppercase text-muted-foreground">
                {picked ? "Picked" : slot.helper}
              </span>
            </span>
            <span className="flex items-center gap-2">
              {picked ? <Check className="size-4" /> : <ChevronRight className="size-4" />}
              <span className="num text-[10px] font-black uppercase">
                {scoreText(score, Boolean(challenge.results))}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PickProgress({ slots, card }: { slots: PickSlot[]; card: PickCard }) {
  const filled = slots.filter((slot) => card[slot.id]).length;
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="label-xs text-white">Progress</p>
          <p className="num mt-1 text-4xl font-black text-white">
            {filled}/{slots.length}
          </p>
        </div>
        <p className="max-w-40 text-right text-xs font-bold uppercase text-white">
          {filled === slots.length ? "Card complete" : "Make every pick before lock"}
        </p>
      </div>
      <div className="mt-4 grid grid-cols-5 gap-1">
        {GROUPS.map((group) => {
          const groupSlots = slots.filter((slot) => slot.group === group);
          if (!groupSlots.length) return null;
          const done = groupSlots.filter((slot) => card[slot.id]).length;
          const Icon = groupIcon(group);
          return (
            <div key={group} className="rounded-sm bg-white p-2 text-[#07110c]">
              <Icon className="size-4" />
              <p className="mt-2 truncate text-[10px] font-black uppercase">{group}</p>
              <p className="num text-[10px] uppercase">
                {done}/{groupSlots.length}
              </p>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex h-3 overflow-hidden rounded-sm bg-white">
        {slots.map((slot) => (
          <span
            key={slot.id}
            className="h-full flex-1 border-r border-[#07110c] last:border-r-0"
            style={{ backgroundColor: card[slot.id] ? groupColor(slot.group) : "var(--border)" }}
          />
        ))}
      </div>
    </div>
  );
}

function DriverGrid({
  entrants,
  activeSlot,
  pickedId,
  canEdit,
  onPick,
}: {
  entrants: PickEntrant[];
  activeSlot: PickSlot;
  pickedId: string | undefined;
  canEdit: boolean;
  onPick: (driverId: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 2xl:grid-cols-5">
      {entrants.map((entrant, index) => {
        const constructor = team(entrant.team);
        const picked = pickedId === entrant.driverId;
        return (
          <button
            key={entrant.driverId}
            type="button"
            disabled={!canEdit}
            onClick={() => onPick(entrant.driverId)}
            className={`pw-ticker pw-card min-h-32 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:border-muted disabled:text-muted-foreground ${
              picked
                ? "border-white bg-white text-[#07110c]"
                : "border-border bg-background hover:border-primary"
            }`}
            style={{
              animationDelay: `${Math.min(index, 19) * 16}ms`,
              borderTop: `5px solid ${constructor.color}`,
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
                #{entrant.standingPosition}
                <span className="block text-muted-foreground">{entrant.points} pts</span>
              </span>
            </span>
            <span className="mt-3 block truncate text-sm font-black uppercase italic">
              {entrant.name}
            </span>
            <span className="mt-2 flex items-center justify-between gap-2">
              <TeamBadge teamName={entrant.team} showName />
              {picked ? <Check className="size-4" /> : <MousePointer2 className="size-4" />}
            </span>
          </button>
        );
      })}
      {!canEdit ? (
        <div className="col-span-full rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-bold text-foreground">
            {activeSlot.title} can be picked when you are signed in and the card is open.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ReviewCard({
  slots,
  card,
  challenge,
  byId,
  activeSlotId,
  onSelect,
}: {
  slots: PickSlot[];
  card: PickCard;
  challenge: PickChallenge;
  byId: Map<string, PickEntrant>;
  activeSlotId: string;
  onSelect: (slotId: string) => void;
}) {
  const hasResult = Boolean(challenge.results);
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <p className="label-xs">Your card</p>
          <h2 className="text-lg font-black uppercase italic">Saved picks</h2>
        </div>
        <ClipboardCheck className="size-5 text-primary" />
      </div>
      <div className="divide-y divide-border">
        {slots.map((slot) => {
          const picked = card[slot.id] ? byId.get(card[slot.id]!) : undefined;
          const actualId = actualFor(challenge, slot.id);
          const actual = actualId ? byId.get(actualId) : undefined;
          const score = scorePick(challenge, slot.id, card[slot.id]);
          const active = slot.id === activeSlotId;
          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => onSelect(slot.id)}
              className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3 text-left transition-colors ${
                active ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-xs font-black uppercase">
                  {slot.shortTitle}
                </span>
                <span
                  className={`num mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] uppercase ${
                    active ? "text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  <span>{picked ? picked.code : "Empty"}</span>
                  {hasResult ? <span>Result {actual?.code ?? "-"}</span> : null}
                </span>
              </span>
              <span className="num rounded-sm border border-border px-2 py-1 text-[10px] font-black uppercase">
                {hasResult ? scoreText(score, true) : picked ? "Set" : "Pick"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ResultLedger({
  ledger,
}: {
  ledger: { round: number; name: string; points: number; slots: number }[];
}) {
  if (!ledger.length) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-primary" />
          <p className="text-xs font-black uppercase">No scored cards yet</p>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Scores appear here after official results are stored.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <p className="label-xs">Results</p>
          <h2 className="text-lg font-black uppercase italic">Scored cards</h2>
        </div>
        <Medal className="size-5 text-primary" />
      </div>
      <div className="divide-y divide-border">
        {ledger.map((entry, index) => (
          <div
            key={entry.round}
            className="pw-ticker grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3"
            style={{ animationDelay: `${index * 24}ms` }}
          >
            <span className="num text-[10px] font-black uppercase text-muted-foreground">
              R{entry.round}
            </span>
            <span className="min-w-0 truncate text-xs font-black uppercase">{entry.name}</span>
            <span className="num text-xs font-black text-primary">{entry.points} pts</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Picks() {
  const { data } = useSuspenseQuery(picksQuery);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [savedCards, setSavedCards] = useState<SavedCards>({});
  const [raceId, setRaceId] = useState<string>(data.activeRaceId ?? "");
  const [activeSlotId, setActiveSlotId] = useState<string>("r1");
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
      setSavedCards({});
      setHydrated(true);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey(session.user.id));
      setSavedCards(raw ? (JSON.parse(raw) as SavedCards) : {});
    } catch {
      setSavedCards({});
    }
    setHydrated(true);
  }, [authReady, session?.user]);

  const persist = (next: SavedCards) => {
    if (!session?.user) return;
    setSavedCards(next);
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
        .filter((entry) => entry.results && savedCards[entry.raceId])
        .map((entry) => {
          const card = savedCards[entry.raceId] ?? {};
          const slots = pickSlotsFor(entry);
          const points = slots.reduce(
            (acc, slot) => acc + (scorePick(entry, slot.id, card[slot.id])?.points ?? 0),
            0,
          );
          return { round: entry.round, name: entry.raceName, points, slots: slots.length };
        })
        .sort((a, b) => b.round - a.round),
    [data.challenges, savedCards],
  );

  if (!challenge) {
    return (
      <SiteShell>
        <p className="text-sm text-muted-foreground">No pick rounds are available.</p>
      </SiteShell>
    );
  }

  const theme = countryTheme(
    countryForRace({
      circuitId: challenge.circuitId,
      circuit: challenge.circuit,
      raceName: challenge.raceName,
    }),
  );
  const flagA = theme.flag[0] ?? theme.accent;
  const flagB = theme.flag[1] ?? "#ffffff";
  const flagC = theme.flag.at(-1) ?? theme.accent;
  const slots = pickSlotsFor(challenge);
  const activeSlot = slots.find((slot) => slot.id === activeSlotId) ?? slots[0]!;
  const card = savedCards[challenge.raceId] ?? {};
  const filled = slots.filter((slot) => card[slot.id]).length;
  const locked = challenge.lockAtISO ? Date.now() > Date.parse(challenge.lockAtISO) : false;
  const scored = Boolean(challenge.results);
  const signedIn = Boolean(session?.user);
  const canEdit = signedIn && !locked && !scored;
  const byId = new Map(data.entrants.map((entrant) => [entrant.driverId, entrant]));
  const activeDriver = card[activeSlot.id] ? byId.get(card[activeSlot.id]!) : undefined;
  const totalScore = slots.reduce(
    (acc, slot) => acc + (scorePick(challenge, slot.id, card[slot.id])?.points ?? 0),
    0,
  );

  const setPick = (slotId: string, driverId: string) => {
    if (!canEdit) return;
    const nextCard = { ...card, [slotId]: driverId };
    persist({ ...savedCards, [challenge.raceId]: nextCard });
    const nextEmpty = slots.find((slot) => !nextCard[slot.id] && slot.id !== slotId);
    if (nextEmpty) setActiveSlotId(nextEmpty.id);
  };

  const clearCard = () => {
    const next = { ...savedCards };
    delete next[challenge.raceId];
    persist(next);
    setActiveSlotId(slots[0]?.id ?? "r1");
  };

  return (
    <SiteShell fullWidth>
      <div
        className="race-page-enter"
        style={
          {
            "--primary": theme.accent,
            "--ring": theme.accent,
            "--accent": theme.accent,
            "--flag-a": flagA,
            "--flag-b": flagB,
            "--flag-c": flagC,
            "--ink": "#07110c",
          } as CSSProperties
        }
      >
        <section className="relative min-h-[520px] overflow-hidden rounded-lg border border-border bg-card">
          <div aria-hidden className="absolute inset-0 grid grid-cols-1 md:grid-cols-3">
            <span style={{ backgroundColor: flagA }} />
            <span style={{ backgroundColor: flagB }} />
            <span style={{ backgroundColor: flagC }} />
          </div>
          <div className="relative grid min-h-[520px] gap-6 p-5 sm:p-8 xl:grid-cols-[minmax(0,1fr)_25rem]">
            <div className="flex max-w-4xl flex-col justify-between gap-8">
              <div>
                <div className="inline-flex items-center gap-2 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#07110c]">
                  <Flag className="size-3.5" />
                  {theme.label}
                </div>
                <h1 className="mt-6 max-w-3xl text-5xl font-black uppercase italic leading-none text-[#07110c] sm:text-7xl">
                  Make Your Picks
                </h1>
                <p className="mt-4 max-w-xl text-base font-bold text-[#07110c] sm:text-lg">
                  Pick drivers for {challenge.raceName}. Your card locks before race weekend.
                </p>
              </div>

              <div className="grid max-w-3xl gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-white p-4 text-[#07110c]">
                  <p className="label-xs text-[#07110c]">Race</p>
                  <p className="mt-2 text-lg font-black uppercase italic">{challenge.raceName}</p>
                </div>
                <div className="rounded-lg bg-white p-4 text-[#07110c]">
                  <p className="label-xs text-[#07110c]">Status</p>
                  <p className="mt-2 text-lg font-black uppercase italic">
                    {scored ? "Scored" : locked ? "Locked" : "Open"}
                  </p>
                </div>
                <div className="rounded-lg bg-white p-4 text-[#07110c]">
                  <p className="label-xs text-[#07110c]">Card</p>
                  <p className="num mt-2 text-3xl font-black">
                    {filled}/{slots.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="home-section-enter self-end overflow-hidden rounded-lg border border-white bg-[#07110c] text-white">
              <img
                src="/images/raceweek-pitlane-italy.png"
                alt=""
                className="h-48 w-full object-cover"
              />
              <div className="p-4">
                <PickProgress slots={slots} card={card} />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="label-xs">Race</p>
              <h2 className="text-2xl font-black uppercase italic">Choose a round</h2>
            </div>
            {challenge.lockAtISO ? (
              <p className="num text-right text-[11px] uppercase text-muted-foreground">
                Locks {fmtDateTime(challenge.lockAtISO)}
              </p>
            ) : null}
          </div>
          <RaceChooser
            challenges={data.challenges}
            activeRaceId={challenge.raceId}
            onChange={(nextRaceId) => {
              setRaceId(nextRaceId);
              setActiveSlotId("r1");
            }}
          />
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-[24rem_minmax(0,1fr)_24rem]">
          <aside className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="label-xs">Pick</p>
                  <h2 className="text-xl font-black uppercase italic">Choose a slot</h2>
                </div>
                <Sparkles className="size-5 text-primary" />
              </div>
              <div className="mt-4">
                <SlotRail
                  slots={slots}
                  card={card}
                  challenge={challenge}
                  activeSlotId={activeSlot.id}
                  onSelect={setActiveSlotId}
                />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                {canEdit ? (
                  <ShieldCheck className="size-4 text-primary" />
                ) : (
                  <Lock className="size-4 text-primary" />
                )}
                <p className="text-xs font-black uppercase">
                  {scored
                    ? `Score: ${totalScore} pts`
                    : locked
                      ? "Card locked"
                      : canEdit
                        ? "Ready to pick"
                        : "Sign in to save"}
                </p>
              </div>
              <div className="mt-3 grid gap-2">
                {!signedIn && authReady ? (
                  <Link
                    to="/account"
                    className="inline-flex items-center justify-center gap-2 rounded-sm bg-primary px-3 py-2 text-xs font-black uppercase italic text-primary-foreground"
                  >
                    <UserRound className="size-4" />
                    Sign in
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
              </div>
            </div>
          </aside>

          <main className="rounded-lg border border-border bg-card p-4">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
              <div>
                <p className="label-xs">Driver</p>
                <h2 className="text-3xl font-black uppercase italic">Pick {activeSlot.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activeDriver ? `${activeDriver.name} is selected.` : "Choose one driver."}
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-sm bg-primary px-3 py-2 text-xs font-black uppercase text-primary-foreground">
                <MousePointer2 className="size-4" />
                {activeDriver?.code ?? "Empty"}
              </span>
            </div>
            <DriverGrid
              entrants={data.entrants}
              activeSlot={activeSlot}
              pickedId={card[activeSlot.id]}
              canEdit={canEdit}
              onPick={(driverId) => setPick(activeSlot.id, driverId)}
            />
          </main>

          <aside className="space-y-4">
            <ReviewCard
              slots={slots}
              card={card}
              challenge={challenge}
              byId={byId}
              activeSlotId={activeSlot.id}
              onSelect={setActiveSlotId}
            />
            <ResultLedger ledger={ledger} />
          </aside>
        </section>

        {!hydrated ? (
          <p className="num mt-8 text-center text-xs text-muted-foreground">Checking account...</p>
        ) : null}
      </div>
    </SiteShell>
  );
}
