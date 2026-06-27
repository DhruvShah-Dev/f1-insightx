"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { AssetImage } from "@/components/ui/asset-image";
import { getCurrentDriverMeta } from "@/lib/ui/driver-asset-manifest";
import { getTeamMeta } from "@/lib/ui/team-meta";

type Driver = {
  id: string;
  code: string | null;
  name: string;
};

type PickEntry = {
  raceId: string;
  qualifyingTop3: [string, string, string];
  raceTop3: [string, string, string];
  randomDrivers: [string, string, string];
  fastestPitStopDriverId: string;
  fastestLapDriverId: string;
};

type ScoreGroup = Array<{ label: string; points: number | null }>;

type Score = {
  qualifying: ScoreGroup;
  race: ScoreGroup;
  specials: ScoreGroup;
  totalPoints: number;
  pending: boolean;
};

type LeaderboardEntry = {
  userId: string;
  username: string;
  points: number;
  racesEntered?: number;
};

type HistoryEntry = {
  raceId: string;
  season: number;
  round: number;
  raceName: string;
  points: number;
};

type PitWallPicksWorkspaceProps = {
  raceId: string;
  isLocked: boolean;
  persistenceAvailable: boolean;
  randomPositions: [number, number, number];
  drivers: Driver[];
  userPick: PickEntry | null;
  userScore: Score | null;
  raceLeaderboard: LeaderboardEntry[];
  overallLeaderboard: LeaderboardEntry[];
  raceHistory: HistoryEntry[];
};

const emptyTriple = ["", "", ""] as [string, string, string];

function createInitialPick(raceId: string, userPick: PickEntry | null): PickEntry {
  return userPick ?? {
    raceId,
    qualifyingTop3: [...emptyTriple],
    raceTop3: [...emptyTriple],
    randomDrivers: [...emptyTriple],
    fastestPitStopDriverId: "",
    fastestLapDriverId: "",
  };
}

function scoreLabel(points: number | null) {
  return points === null ? "Pending" : `${points} pts`;
}

function pickComplete(pick: PickEntry) {
  return [
    ...pick.qualifyingTop3,
    ...pick.raceTop3,
    ...pick.randomDrivers,
    pick.fastestPitStopDriverId,
    pick.fastestLapDriverId,
  ].every(Boolean);
}

function hasDuplicates(values: string[]) {
  const filled = values.filter(Boolean);
  return new Set(filled).size !== filled.length;
}

function chipFallback(label: string) {
  if (label === "Fastest pit stop") return "PIT";
  if (label === "Fastest lap") return "LAP";
  if (label.startsWith("Race P")) return label.replace("Race ", "");
  return label;
}

function DriverSelect(props: {
  label: string;
  value: string;
  drivers: Driver[];
  disabled: boolean;
  tone?: "chip" | "pocket" | "special";
  onChange: (value: string) => void;
}) {
  const selectedDriver = props.drivers.find((driver) => driver.id === props.value);
  const selectedDriverMeta = selectedDriver ? getCurrentDriverMeta(selectedDriver.id) : null;
  const selectedTeam = selectedDriverMeta ? getTeamMeta(selectedDriverMeta.teamId) : null;

  return (
    <label
      className={`pit-wall-field pit-wall-field--${props.tone ?? "chip"} ${props.value ? "is-filled" : ""}`}
      style={
        selectedTeam
          ? ({
              "--field-team-primary": selectedTeam.primary,
              "--field-team-secondary": selectedTeam.secondary,
            } as CSSProperties)
          : undefined
      }
    >
      <span className="pit-wall-field__preview" aria-hidden="true">
        <span className="pit-wall-field__portrait-wrap">
          {selectedDriverMeta ? (
            <AssetImage
              src={selectedDriverMeta.photoPath ?? selectedDriverMeta.fallbackPhotoPath}
              fallbackSrc={selectedDriverMeta.fallbackPhotoPath}
              alt=""
              className="pit-wall-field__portrait"
              fill
              sizes="76px"
              style={{
                objectFit: "contain",
                objectPosition: selectedDriverMeta.photoPosition ?? "center bottom",
                transform: `translateX(${selectedDriverMeta.photoTranslateX ?? 0}px) scale(${selectedDriverMeta.photoScale ?? 1})`,
              }}
            />
          ) : (
            chipFallback(props.label)
          )}
        </span>
        <span className="pit-wall-field__identity">
          <span className="pit-wall-field__label">{props.label}</span>
          <strong>{selectedDriver?.code ?? selectedDriverMeta?.driverCode ?? "Select"}</strong>
          <em>{selectedDriver?.name ?? "Choose driver"}</em>
        </span>
      </span>
      <select value={props.value} onChange={(event) => props.onChange(event.target.value)} disabled={props.disabled}>
        <option value="">Select driver</option>
        {props.drivers.map((driver) => (
          <option key={driver.id} value={driver.id}>
            {driver.code ? `${driver.code} - ${driver.name}` : driver.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ScorePanel({ score }: { score: Score | null }) {
  if (!score) {
    return (
      <div className="pit-wall-panel pit-wall-panel--quiet">
        <span>No score yet</span>
        <strong>0</strong>
      </div>
    );
  }

  return (
    <div className="pit-wall-score">
      <div className="pit-wall-score__total">
        <span>{score.pending ? "Live score" : "Final score"}</span>
        <strong>{score.totalPoints}</strong>
      </div>
      {[score.qualifying, score.race, score.specials].map((group, groupIndex) => (
        <div className="pit-wall-score__group" key={groupIndex}>
          {group.map((entry) => (
            <div key={entry.label}>
              <span>{entry.label}</span>
              <strong>{scoreLabel(entry.points)}</strong>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Leaderboard({ title, entries, overall = false }: { title: string; entries: LeaderboardEntry[]; overall?: boolean }) {
  return (
    <section className="pit-wall-board">
      <div className="pit-wall-section-heading">
        <h2>{title}</h2>
      </div>
      {entries.length > 0 ? (
        <ol className="pit-wall-leaderboard">
          {entries.map((entry, index) => (
            <li key={entry.userId}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{entry.username}</strong>
              {overall ? <small>{entry.racesEntered ?? 0} races</small> : <small>This race</small>}
              <em>{entry.points} pts</em>
            </li>
          ))}
        </ol>
      ) : (
        <p className="pit-wall-empty">No entries</p>
      )}
    </section>
  );
}

export function PitWallPicksWorkspace(props: PitWallPicksWorkspaceProps) {
  const router = useRouter();
  const [pick, setPick] = useState(() => createInitialPick(props.raceId, props.userPick));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const duplicateError = useMemo(() => {
    if (hasDuplicates(pick.qualifyingTop3)) return "Qualifying top 3 cannot repeat a driver.";
    if (hasDuplicates(pick.raceTop3)) return "Race top 3 cannot repeat a driver.";
    if (hasDuplicates(pick.randomDrivers)) return "Random position picks cannot repeat a driver.";
    return "";
  }, [pick]);
  const canSubmit = props.persistenceAvailable && !props.isLocked && pickComplete(pick) && !duplicateError && !isPending;

  const updateTriple = (key: "qualifyingTop3" | "raceTop3" | "randomDrivers", index: number, value: string) => {
    setPick((current) => {
      const next = [...current[key]] as [string, string, string];
      next[index] = value;
      return { ...current, [key]: next };
    });
  };

  const save = () => {
    setError("");
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/pit-wall-picks/entry", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pick),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.ok !== true) {
        setError(payload?.error?.message ?? "Your picks could not be saved.");
        return;
      }
      setMessage("Picks saved.");
      router.refresh();
    });
  };

  return (
    <div className="pit-wall-workspace">
      <section className="pit-wall-card pit-wall-card--form" id="race-card">
        <div className="pit-wall-section-heading">
          <span>{props.isLocked ? "Locked card" : "Open card"}</span>
          <h2>{props.userPick ? "Your picks" : "Race card"}</h2>
          <p>Complete every slot before lock. Top-three groups cannot repeat a driver.</p>
        </div>

        {!props.persistenceAvailable ? (
          <div className="pit-wall-feedback pit-wall-feedback--notice">
            Setup mode
          </div>
        ) : null}

        <div className="pit-wall-pick-grid">
          <div className="pit-wall-pick-group">
            <h3>Qualifying Top 3</h3>
            {pick.qualifyingTop3.map((value, index) => (
              <DriverSelect
                key={`q-${index}`}
                label={`Q P${index + 1}`}
                value={value}
                drivers={props.drivers}
                disabled={props.isLocked}
                tone="chip"
                onChange={(nextValue) => updateTriple("qualifyingTop3", index, nextValue)}
              />
            ))}
          </div>

          <div className="pit-wall-pick-group">
            <h3>Race Top 3</h3>
            {pick.raceTop3.map((value, index) => (
              <DriverSelect
                key={`r-${index}`}
                label={`Race P${index + 1}`}
                value={value}
                drivers={props.drivers}
                disabled={props.isLocked}
                tone="chip"
                onChange={(nextValue) => updateTriple("raceTop3", index, nextValue)}
              />
            ))}
          </div>

          <div className="pit-wall-pick-group">
            <h3>Random Positions</h3>
            {pick.randomDrivers.map((value, index) => (
              <DriverSelect
                key={`random-${index}`}
                label={`Race P${props.randomPositions[index]}`}
                value={value}
                drivers={props.drivers}
                disabled={props.isLocked}
                tone="pocket"
                onChange={(nextValue) => updateTriple("randomDrivers", index, nextValue)}
              />
            ))}
          </div>

          <div className="pit-wall-pick-group">
            <h3>Specials</h3>
            <DriverSelect
              label="Fastest pit stop"
              value={pick.fastestPitStopDriverId}
              drivers={props.drivers}
              disabled={props.isLocked}
              tone="special"
              onChange={(fastestPitStopDriverId) => setPick((current) => ({ ...current, fastestPitStopDriverId }))}
            />
            <DriverSelect
              label="Fastest lap"
              value={pick.fastestLapDriverId}
              drivers={props.drivers}
              disabled={props.isLocked}
              tone="special"
              onChange={(fastestLapDriverId) => setPick((current) => ({ ...current, fastestLapDriverId }))}
            />
          </div>
        </div>

        {duplicateError ? <div className="pit-wall-feedback pit-wall-feedback--error">{duplicateError}</div> : null}
        {error ? <div className="pit-wall-feedback pit-wall-feedback--error">{error}</div> : null}
        {message ? <div className="pit-wall-feedback pit-wall-feedback--notice">{message}</div> : null}

        {!props.isLocked ? (
          <button className="pit-wall-submit" type="button" onClick={save} disabled={!canSubmit}>
            {isPending ? "Locking..." : props.userPick ? "Update picks" : "Lock picks"}
          </button>
        ) : (
          <div className="pit-wall-feedback pit-wall-feedback--notice">Picks locked</div>
        )}
      </section>

      <ScorePanel score={props.userScore} />

      <Leaderboard title="Current Race" entries={props.raceLeaderboard} />
      <Leaderboard title="Overall Points" entries={props.overallLeaderboard} overall />

      <section className="pit-wall-board pit-wall-board--history">
        <div className="pit-wall-section-heading">
          <h2>Race history</h2>
        </div>
        {props.raceHistory.length > 0 ? (
          <ol className="pit-wall-history">
            {props.raceHistory.map((entry) => (
              <li key={entry.raceId}>
                <span>
                  {entry.season} R{entry.round}
                </span>
                <strong>{entry.raceName}</strong>
                <em>{entry.points} pts</em>
              </li>
            ))}
          </ol>
        ) : (
          <p className="pit-wall-empty">No history</p>
        )}
      </section>
    </div>
  );
}
