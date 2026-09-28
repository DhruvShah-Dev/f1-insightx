import { Link } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { Calendar, DashFlag, FastArrowRight, Timer } from "iconoir-react/regular";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { SiteShell } from "@/components/site-shell";
import { team } from "@/data/teams";
import { supabase } from "@/integrations/supabase/client";
import { fmtDateTime } from "@/lib/format";
import { getPicksBoard, type PickChallenge, type PickEntrant } from "@/lib/f1.functions";

type Board = Awaited<ReturnType<typeof getPicksBoard>>;
type Group = "Race" | "Qualifying" | "Sprint" | "Positions" | "Speed";
type Slot = { id: string; group: Group; label: string; compact: string };
type Card = Record<string, string>;
type Cards = Record<string, Card>;

const storageKey = (id: string) => `f1ix.picks.v1.${id}`;
const groups: Group[] = ["Race", "Qualifying", "Sprint", "Positions", "Speed"];

function slotsFor(challenge: PickChallenge): Slot[] {
  return [
    { id: "r1", group: "Race", label: "Race winner", compact: "P1" },
    { id: "r2", group: "Race", label: "Second place", compact: "P2" },
    { id: "r3", group: "Race", label: "Third place", compact: "P3" },
    { id: "q1", group: "Qualifying", label: "Pole position", compact: "P1" },
    { id: "q2", group: "Qualifying", label: "Qualifying second", compact: "P2" },
    { id: "q3", group: "Qualifying", label: "Qualifying third", compact: "P3" },
    ...(challenge.hasSprint
      ? [
          { id: "sq1", group: "Sprint" as const, label: "Sprint pole", compact: "Pole" },
          { id: "s1", group: "Sprint" as const, label: "Sprint winner", compact: "Winner" },
        ]
      : []),
    ...challenge.randomPositions.map((position) => ({
      id: `random-${position}`,
      group: "Positions" as const,
      label: `P${position} finisher`,
      compact: `P${position}`,
    })),
    { id: "fastest-lap", group: "Speed", label: "Fastest lap", compact: "Lap" },
    { id: "fastest-pit", group: "Speed", label: "Fastest pit stop", compact: "Pit" },
  ];
}

function resultFor(challenge: PickChallenge, id: string): string | null {
  const result = challenge.results;
  if (!result) return null;
  if (id === "sq1") return result.sprintQualifyingP1;
  if (id === "s1") return result.sprintRaceP1;
  if (id === "fastest-lap") return result.fastestLapDriverId;
  if (id === "fastest-pit") return result.fastestPitDriverId;
  if (id.startsWith("random-"))
    return result.randomPositions.find((item) => item.position === Number(id.slice(7)))?.driverId ?? null;
  const position = Number(id.slice(1)) - 1;
  if (id.startsWith("q")) return result.qualifying[position] ?? null;
  if (id.startsWith("r")) return result.race[position] ?? null;
  return null;
}

function pointsFor(challenge: PickChallenge, id: string, picked?: string): number {
  if (!picked || !challenge.results) return 0;
  const actual = resultFor(challenge, id);
  if (actual === picked) return 3;
  if (id.startsWith("q") || /^r[123]$/.test(id)) {
    const list = id.startsWith("q") ? challenge.results.qualifying : challenge.results.race;
    const index = Number(id.slice(1)) - 1;
    if (list[index - 1] === picked || list[index + 1] === picked) return 1;
  }
  return 0;
}

function DriverImage({ driver, className = "" }: { driver: PickEntrant; className?: string }) {
  return (
    <img
      className={className}
      src={`/assets/drivers/2026/headshots/${driver.code.toLowerCase()}.png`}
      alt=""
      loading="lazy"
      onError={(event) => { event.currentTarget.style.visibility = "hidden"; }}
    />
  );
}

function TeamImage({ name, className = "" }: { name: string; className?: string }) {
  const identity = team(name);
  return identity.logoPng ? <img className={className} src={identity.logoPng} alt="" loading="lazy" /> : null;
}

export function PicksExperience({ data }: { data: Board }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cards, setCards] = useState<Cards>({});
  const [hydrated, setHydrated] = useState(false);
  const [raceId, setRaceId] = useState(data.activeRaceId ?? "");
  const [slotId, setSlotId] = useState("r1");
  const [filter, setFilter] = useState<"all" | "top">("all");

  useEffect(() => {
    const rail = document.querySelector<HTMLElement>(".picks-rounds__rail");
    const active = rail?.querySelector<HTMLElement>(".picks-round.is-active");
    if (rail && active) {
      rail.scrollTo({ left: active.offsetLeft - rail.offsetLeft - rail.clientWidth / 2 + active.clientWidth / 2, behavior: "smooth" });
    }
  }, [raceId]);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: auth }) => {
      setSession(auth.session);
      setAuthReady(true);
    }).catch(() => setAuthReady(true));
    const { data: auth } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setAuthReady(true);
    });
    return () => auth.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    try {
      const raw = session?.user ? localStorage.getItem(storageKey(session.user.id)) : null;
      setCards(raw ? (JSON.parse(raw) as Cards) : {});
    } catch {
      setCards({});
    }
    setHydrated(true);
  }, [authReady, session?.user]);

  const challenge = data.challenges.find((entry) => entry.raceId === raceId)
    ?? data.challenges.find((entry) => entry.raceId === data.activeRaceId)
    ?? data.challenges.at(-1);
  const ledger = useMemo(() => data.challenges
    .filter((entry) => entry.results && cards[entry.raceId])
    .map((entry) => ({
      race: entry,
      points: slotsFor(entry).reduce((sum, slot) => sum + pointsFor(entry, slot.id, cards[entry.raceId]?.[slot.id]), 0),
    }))
    .sort((a, b) => b.race.round - a.race.round), [cards, data.challenges]);

  if (!challenge) return <SiteShell><p>No pick rounds are available.</p></SiteShell>;

  const slots = slotsFor(challenge);
  const active = slots.find((slot) => slot.id === slotId) ?? slots[0]!;
  const card = cards[challenge.raceId] ?? {};
  const filled = slots.filter((slot) => card[slot.id]).length;
  const locked = challenge.lockAtISO ? Date.now() >= Date.parse(challenge.lockAtISO) : false;
  const scored = Boolean(challenge.results);
  const editable = Boolean(session?.user) && !locked && !scored;
  const selected = data.entrants.find((driver) => driver.driverId === card[active.id]);
  const visibleDrivers = filter === "top" ? data.entrants.filter((driver) => driver.standingPosition <= 10) : data.entrants;
  const racePoints = slots.reduce((sum, slot) => sum + pointsFor(challenge, slot.id, card[slot.id]), 0);
  const seasonPoints = ledger.reduce((sum, item) => sum + item.points, 0);

  function save(next: Cards) {
    if (!session?.user) return;
    setCards(next);
    try { localStorage.setItem(storageKey(session.user.id), JSON.stringify(next)); } catch { /* storage unavailable */ }
  }

  function choose(driverId: string) {
    if (!editable) return;
    const nextCard = { ...card, [active.id]: driverId };
    save({ ...cards, [challenge!.raceId]: nextCard });
    const nextSlot = slots.find((slot) => !nextCard[slot.id]);
    if (nextSlot) setSlotId(nextSlot.id);
  }

  function clear() {
    if (!editable) return;
    const next = { ...cards };
    delete next[challenge!.raceId];
    save(next);
    setSlotId("r1");
  }

  return (
    <SiteShell fullWidth>
      <div className="picks-page">
        <header className="picks-intro">
          <div>
            <p className="picks-kicker">F1 InsightX / Picks</p>
            <h1>Call the race<span>.</span></h1>
            <p>Pick drivers. Earn points. Climb the board.</p>
          </div>
          <div className="picks-intro__score" aria-label="Season points">
            <span>Season points</span>
            <strong>{seasonPoints.toString().padStart(2, "0")}</strong>
          </div>
        </header>

        <section className="picks-rounds" aria-label="Choose a race">
          <div className="picks-section-line">
            <h2>Rounds</h2>
            <span>{data.season}</span>
          </div>
          <div className="picks-rounds__rail">
            {data.challenges.map((item) => (
              <button key={item.raceId} type="button" aria-pressed={item.raceId === challenge.raceId}
                className={`picks-round ${item.raceId === challenge.raceId ? "is-active" : ""}`}
                onClick={() => { setRaceId(item.raceId); setSlotId("r1"); }}>
                <span>{String(item.round).padStart(2, "0")}</span>
                <strong>{item.raceName}</strong>
                <small>{item.results ? "Scored" : item.lockAtISO && Date.now() >= Date.parse(item.lockAtISO) ? "Locked" : "Open"}</small>
              </button>
            ))}
          </div>
        </section>

        <div className="picks-race-head">
          <div>
            <span className="picks-kicker">Round {String(challenge.round).padStart(2, "0")}</span>
            <h2>{challenge.raceName}</h2>
          </div>
          <div className="picks-race-head__meta">
            <span><Calendar aria-hidden />{challenge.scheduledAtISO ? fmtDateTime(challenge.scheduledAtISO) : "Date pending"}</span>
            <span><Timer aria-hidden />{scored ? "Results in" : locked ? "Picks locked" : challenge.lockAtISO ? `Locks ${fmtDateTime(challenge.lockAtISO)}` : "Open"}</span>
          </div>
        </div>

        <div className="picks-workspace">
          <aside className="picks-slots" aria-label="Pick categories">
            <div className="picks-section-line"><h2>Your picks</h2><span>{filled}/{slots.length}</span></div>
            <div className="picks-progress" aria-label={`${filled} of ${slots.length} picks made`}><span style={{ width: `${filled / slots.length * 100}%` }} /></div>
            {groups.map((group) => {
              const groupSlots = slots.filter((slot) => slot.group === group);
              if (!groupSlots.length) return null;
              return <div className="picks-slot-group" key={group}>
                <h3>{group}</h3>
                {groupSlots.map((slot) => {
                  const driver = data.entrants.find((entry) => entry.driverId === card[slot.id]);
                  return <button type="button" key={slot.id} aria-pressed={active.id === slot.id}
                    onClick={() => setSlotId(slot.id)} className={`picks-slot ${active.id === slot.id ? "is-active" : ""}`}>
                    <span className="picks-slot__position">{slot.compact}</span>
                    <span className="picks-slot__copy"><strong>{slot.label}</strong><small>{driver?.name ?? "Choose driver"}</small></span>
                    {driver ? <DriverImage driver={driver} className="picks-slot__photo" /> : <FastArrowRight aria-hidden className="picks-slot__arrow" />}
                  </button>;
                })}
              </div>;
            })}
          </aside>

          <section className="picks-picker" aria-labelledby="picks-active-title">
            <div className="picks-picker__head">
              <div><span className="picks-kicker">{active.group} / {active.compact}</span><h2 id="picks-active-title">{active.label}</h2></div>
              <div className="picks-picker__filters" aria-label="Filter drivers">
                <button type="button" className={filter === "all" ? "is-active" : ""} onClick={() => setFilter("all")}>All</button>
                <button type="button" className={filter === "top" ? "is-active" : ""} onClick={() => setFilter("top")}>Top 10</button>
              </div>
            </div>
            {!editable && <div className="picks-notice">{!hydrated ? "Loading picks…" : !session ? <><Link to="/account">Sign in</Link> to save your picks.</> : scored ? "This round is scored." : "Picks are locked."}</div>}
            <div className="picks-drivers">
              {visibleDrivers.map((driver) => {
                const identity = team(driver.team);
                const picked = selected?.driverId === driver.driverId;
                const used = ["Race", "Qualifying", "Positions"].includes(active.group) && slots.some((slot) => slot.group === active.group && slot.id !== active.id && card[slot.id] === driver.driverId);
                return <button type="button" key={driver.driverId} onClick={() => choose(driver.driverId)} disabled={!editable || used}
                  aria-pressed={picked} title={used ? "Already picked in this group" : driver.name}
                  className={`picks-driver ${picked ? "is-picked" : ""} ${used ? "is-used" : ""}`}
                  style={{ "--team-color": identity.color } as CSSProperties}>
                  <span className="picks-driver__image"><DriverImage driver={driver} /></span>
                  <span className="picks-driver__identity"><strong>{driver.name}</strong><small><TeamImage name={driver.team} />{identity.name}</small></span>
                  <span className="picks-driver__mark">{picked ? "✓" : "+"}</span>
                </button>;
              })}
            </div>
          </section>

          <aside className="picks-summary" aria-label="Pick card">
            <div className="picks-summary__top">
              <span className="picks-kicker">Your card</span>
              <strong>{scored ? `${racePoints} pts` : `${filled} / ${slots.length}`}</strong>
            </div>
            <div className="picks-summary__rows">
              {slots.map((slot) => {
                const driver = data.entrants.find((entry) => entry.driverId === card[slot.id]);
                return <button type="button" key={slot.id} onClick={() => setSlotId(slot.id)} className={active.id === slot.id ? "is-active" : ""}>
                  <span>{slot.compact}</span><strong>{driver?.name ?? "—"}</strong>
                  {driver && <DriverImage driver={driver} className="picks-summary__photo" />}
                  {scored && <em>{pointsFor(challenge, slot.id, card[slot.id])}</em>}
                </button>;
              })}
            </div>
            <div className="picks-summary__bottom">
              <span>{editable ? "Saved automatically" : scored ? "Final score" : locked ? "Locked" : "Sign in to play"}</span>
              {editable && filled > 0 && <button type="button" onClick={clear}>Clear</button>}
            </div>
          </aside>
        </div>

        {ledger.length > 0 && <section className="picks-results">
          <div className="picks-section-line"><h2>Previous rounds</h2><span>{ledger.length}</span></div>
          {ledger.map(({ race, points }) => <button type="button" key={race.raceId} onClick={() => { setRaceId(race.raceId); setSlotId("r1"); }}>
            <span>{String(race.round).padStart(2, "0")}</span><strong>{race.raceName}</strong><em>{points} pts</em><DashFlag aria-hidden />
          </button>)}
        </section>}
      </div>
    </SiteShell>
  );
}
