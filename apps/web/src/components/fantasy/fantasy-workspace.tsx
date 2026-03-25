"use client";

import { useEffect, useMemo, useState } from "react";
import { FantasyCharts } from "@/components/fantasy/fantasy-charts";
import { TeamBadge } from "@/components/ui/team-badge";
import { TeamCarCard } from "@/components/ui/team-car-card";

type DatasetResponse = {
  ok: boolean;
  data?: {
    season: number;
    round: number | null;
    pricingSource: string;
    drivers: Array<{
      id: string;
      name: string;
      constructorId: string;
      constructorName: string;
      recentPoints: number;
      averageFinish: number;
      overtakeScore: number;
      reliabilityScore: number;
      price: number;
      projectedScore: number;
      valueScore: number;
      volatility: number;
    }>;
    constructors: Array<{
      id: string;
      name: string;
      recentPoints: number;
      averageFinish: number;
      reliabilityScore: number;
      price: number;
      projectedScore: number;
      valueScore: number;
      volatility: number;
    }>;
  };
};

type RecommendResponse = {
  ok: boolean;
  data?: {
    season: number;
    round: number | null;
    pricingSource: string;
    budget: number;
    primaryStyle: "safe" | "balanced" | "aggressive";
    primary: Lineup;
    alternatives: Lineup[];
  };
  error?: {
    message: string;
  };
};

type Lineup = {
  style: "safe" | "balanced" | "aggressive";
  drivers: Array<{
    id: string;
    name: string;
    constructorId: string;
    constructorName: string;
    price: number;
    projectedScore: number;
    valueScore: number;
  }>;
  constructors: Array<{
    id: string;
    name: string;
    price: number;
    projectedScore: number;
    valueScore: number;
  }>;
  captainId: string;
  totalPrice: number;
  expectedScore: number;
  rationale: string[];
};

type Props = {
  season: number;
};

export function FantasyWorkspace({ season }: Props) {
  const [dataset, setDataset] = useState<DatasetResponse["data"] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [budget, setBudget] = useState(110);
  const [riskProfile, setRiskProfile] = useState<"safe" | "balanced" | "aggressive">("balanced");
  const [scoringFocus, setScoringFocus] = useState<"points" | "value" | "differential">("points");
  const [lockCaptain, setLockCaptain] = useState(false);
  const [preferredDriverIds, setPreferredDriverIds] = useState<string[]>([]);
  const [preferredConstructorIds, setPreferredConstructorIds] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendResponse["data"] | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    async function load() {
      try {
        const response = await fetch(`/api/fantasy-builder/dataset?season=${season}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as DatasetResponse;
        if (active && payload.ok && payload.data) {
          setDataset(payload.data);
          setPreferredDriverIds(payload.data.drivers.slice(0, 2).map((driver) => driver.id));
          setPreferredConstructorIds(payload.data.constructors.slice(0, 1).map((constructor) => constructor.id));
        }
      } catch {
        if (active) {
          setError("Fantasy dataset could not be loaded.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [season]);

  const topDrivers = useMemo(() => dataset?.drivers.slice(0, 12) ?? [], [dataset]);
  const topConstructors = useMemo(() => dataset?.constructors.slice(0, 8) ?? [], [dataset]);
  const minimumBudget = useMemo(() => {
    if (!dataset) {
      return 0;
    }

    const drivers = [...dataset.drivers].sort((left, right) => left.price - right.price).slice(0, 5);
    const constructors = [...dataset.constructors]
      .sort((left, right) => left.price - right.price)
      .slice(0, 2);

    return Number(
      (
        drivers.reduce((total, driver) => total + driver.price, 0) +
        constructors.reduce((total, constructor) => total + constructor.price, 0)
      ).toFixed(1),
    );
  }, [dataset]);

  useEffect(() => {
    if (minimumBudget > 0 && budget < minimumBudget) {
      setBudget(Math.ceil(minimumBudget));
    }
  }, [budget, minimumBudget]);

  async function buildLineup() {
    setIsOptimizing(true);
    setError(null);

    try {
      const response = await fetch("/api/fantasy-builder/recommend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          season,
          round: dataset?.round ?? undefined,
          budget,
          preferredDriverIds,
          preferredConstructorIds,
          excludedIds: [],
          riskProfile,
          scoringFocus,
          lockCaptain,
        }),
      });

      const payload = (await response.json()) as RecommendResponse;
      if (!payload.ok || !payload.data) {
        setError(payload.error?.message ?? "Recommendation failed.");
        setRecommendations(null);
        return;
      }

      setRecommendations(payload.data);
    } catch {
      setError("Recommendation failed.");
      setRecommendations(null);
    } finally {
      setIsOptimizing(false);
    }
  }

  function toggleDriver(driverId: string) {
    setPreferredDriverIds((current) =>
      current.includes(driverId)
        ? current.filter((id) => id !== driverId)
        : [...current, driverId].slice(0, 5),
    );
  }

  function toggleConstructor(constructorId: string) {
    setPreferredConstructorIds((current) =>
      current.includes(constructorId)
        ? current.filter((id) => id !== constructorId)
        : [...current, constructorId].slice(0, 2),
    );
  }

  return (
    <div className="lab-layout">
      <section className="lab-controls">
        <div className="workspace-panel">
          <div className="workspace-panel__eyebrow">Lineup constraints</div>
          <div className="workspace-panel__headline">
            Build a five-driver, two-constructor lineup around budget, value, and volatility.
          </div>
          {preferredConstructorIds[0] ? (
            <div className="panel-hero">
              <TeamCarCard
                teamId={preferredConstructorIds[0]}
                title={dataset?.constructors.find((constructor) => constructor.id === preferredConstructorIds[0])?.name}
                subtitle="Repo-backed team media with premium fallback"
              />
              <div>
                <div className="section-meta">Constructor visual</div>
                <p className="section-copy">
                  Team media is driven by one shared asset manifest.
                </p>
              </div>
            </div>
          ) : null}

          <div className="result-summary fantasy-summary">
            <div>
              <span>Dataset round</span>
              <strong>{dataset?.round ?? "-"}</strong>
            </div>
            <div>
              <span>Pricing source</span>
              <strong>{dataset?.pricingSource ?? "loading"}</strong>
            </div>
            <div>
              <span>Min viable budget</span>
              <strong>{minimumBudget > 0 ? minimumBudget : "-"}</strong>
            </div>
          </div>

          <div className="control-block">
            <label className="control-label">
              Budget <span>{budget}</span>
            </label>
            <input
              className="control-range"
              type="range"
              min={minimumBudget > 0 ? Math.ceil(minimumBudget) : 65}
              max={120}
              value={budget}
              onChange={(event) => setBudget(Number(event.target.value))}
            />
          </div>

          <div className="lab-grid-two">
            <div className="control-block">
              <label className="control-label">Risk profile</label>
              <div className="segmented-row">
                {(["safe", "balanced", "aggressive"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`segment ${riskProfile === value ? "segment--active" : ""}`}
                    onClick={() => setRiskProfile(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-block">
              <label className="control-label">Scoring focus</label>
              <div className="segmented-row">
                {(["points", "value", "differential"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`segment ${scoringFocus === value ? "segment--active" : ""}`}
                    onClick={() => setScoringFocus(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="control-block">
            <label className="control-label">
              Captain mode <span>{lockCaptain ? "Top projection only" : "Style-aware"}</span>
            </label>
            <button
              type="button"
              className={`segment ${lockCaptain ? "segment--active" : ""}`}
              onClick={() => setLockCaptain((current) => !current)}
            >
              {lockCaptain ? "Locked" : "Flexible"}
            </button>
          </div>

          <div className="control-block">
            <div className="control-label">
              Preferred drivers <span>{preferredDriverIds.length} selected</span>
            </div>
            <div className="driver-grid">
              {topDrivers.map((driver) => (
                <button
                  key={driver.id}
                  type="button"
                  className={`driver-chip ${preferredDriverIds.includes(driver.id) ? "driver-chip--active" : ""}`}
                  onClick={() => toggleDriver(driver.id)}
                >
                  <div>
                    <strong>{driver.name}</strong>
                    <span>
                      {driver.constructorName} | ${driver.price} | {driver.projectedScore} proj
                    </span>
                  </div>
                  <TeamBadge teamId={driver.constructorId} compact />
                </button>
              ))}
            </div>
          </div>

          <div className="control-block">
            <div className="control-label">
              Preferred constructors <span>{preferredConstructorIds.length} selected</span>
            </div>
            <div className="chip-row">
              {topConstructors.map((constructor) => (
                <button
                  key={constructor.id}
                  type="button"
                  className={`chip ${preferredConstructorIds.includes(constructor.id) ? "chip--active" : ""}`}
                  onClick={() => toggleConstructor(constructor.id)}
                >
                  <TeamBadge
                    teamId={constructor.id}
                    label={`${constructor.name} $${constructor.price}`}
                    compact
                  />
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="hero__cta hero__cta--primary"
            onClick={() => void buildLineup()}
            disabled={isLoading || isOptimizing || !dataset}
          >
            {isOptimizing ? "Optimizing lineup" : "Build lineup"}
          </button>

          <p className="lab-footnote">
            Pricing is derived from historical form, not the official fantasy game.
          </p>
        </div>
      </section>

      <section className="lab-results">
        <div className="workspace-panel workspace-panel--dark">
          <div className="workspace-panel__eyebrow">Recommendation</div>
          <div className="workspace-panel__headline">
            {recommendations
              ? `${recommendations.primaryStyle} lineup recommendation`
              : "Generate a lineup to compare roster styles."}
          </div>

          {error ? <p className="lab-error">{error}</p> : null}
          {isLoading ? <div className="loading-block">Loading fantasy dataset...</div> : null}
          {!isLoading && dataset && !recommendations ? (
            <div className="status-banner">
              {dataset.drivers.length} drivers and {dataset.constructors.length} constructors are ready for optimization.
            </div>
          ) : null}

          {recommendations ? (
            <>
              <LineupView lineup={recommendations.primary} />
              <FantasyCharts
                primary={recommendations.primary}
                alternatives={recommendations.alternatives}
              />
              {recommendations.alternatives.length > 0 ? (
                <div className="alternative-stack">
                  {recommendations.alternatives.map((lineup) => (
                    <LineupMini key={lineup.style} lineup={lineup} />
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="placeholder-stack">
              <p className="lab-copy">
                The optimizer searches valid lineups under your budget, then scores them by risk profile
                and scoring focus.
              </p>
              <div className="result-summary">
                <div>
                  <span>Optimization</span>
                  <strong>Combinatorial search</strong>
                </div>
                <div>
                  <span>Captain</span>
                  <strong>Multiplier included</strong>
                </div>
                <div>
                  <span>Pricing</span>
                  <strong>Derived, not official</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function LineupView({ lineup }: { lineup: Lineup }) {
  return (
    <div className="lineup-block">
      <div className="result-summary">
        <div>
          <span>Total price</span>
          <strong>{lineup.totalPrice}</strong>
        </div>
        <div>
          <span>Expected score</span>
          <strong>{lineup.expectedScore}</strong>
        </div>
        <div>
          <span>Captain</span>
          <strong>{lineup.drivers.find((driver) => driver.id === lineup.captainId)?.name ?? lineup.captainId}</strong>
        </div>
      </div>

      <div className="result-table">
        {lineup.drivers.map((driver) => (
          <article key={driver.id} className="result-row">
            <div className="result-row__rank">{driver.id === lineup.captainId ? "C" : "D"}</div>
            <div className="result-row__main">
              <div className="result-row__head">
                <div>
                  <h3>{driver.name}</h3>
                  <p>${driver.price} | {driver.projectedScore} projected</p>
                  <div className="mt-3">
                    <TeamBadge teamId={driver.constructorId} compact />
                  </div>
                </div>
                <div className="result-row__metrics">
                  <span>value {driver.valueScore.toFixed(3)}</span>
                </div>
              </div>
            </div>
          </article>
        ))}
        {lineup.constructors.map((constructor) => (
          <article key={constructor.id} className="result-row">
            <div className="result-row__rank">T</div>
            <div className="result-row__main">
              <div className="result-row__head">
                <div>
                  <h3>{constructor.name}</h3>
                  <p>${constructor.price} | {constructor.projectedScore} projected</p>
                </div>
                <div className="result-row__metrics">
                  <span>value {constructor.valueScore.toFixed(3)}</span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <ul className="result-notes">
        {lineup.rationale.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function LineupMini({ lineup }: { lineup: Lineup }) {
  return (
    <div className="workspace-panel">
      <div className="workspace-panel__eyebrow">{lineup.style} alternative</div>
      <div className="workspace-panel__headline">
        {lineup.expectedScore} projected points at {lineup.totalPrice} budget.
      </div>
      <p className="lab-copy">
        Captain: {lineup.drivers.find((driver) => driver.id === lineup.captainId)?.name ?? lineup.captainId}
      </p>
    </div>
  );
}
