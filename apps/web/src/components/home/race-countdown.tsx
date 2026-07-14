"use client";

import { useEffect, useState } from "react";

type RaceCountdownProps = {
  scheduledAt: string | null | undefined;
  initialLabel: string;
};

type CountdownState = {
  label: string;
  units: Array<{
    label: string;
    value: string;
  }>;
  isActive: boolean;
};

const pendingUnits = [
  { label: "Days", value: "--" },
  { label: "Hours", value: "--" },
  { label: "Mins", value: "--" },
  { label: "Secs", value: "--" },
];

const activeUnits = [
  { label: "Days", value: "00" },
  { label: "Hours", value: "00" },
  { label: "Mins", value: "00" },
  { label: "Secs", value: "00" },
];

function padUnit(value: number) {
  return value.toString().padStart(2, "0");
}

function getInitialCountdownState(initialLabel: string): CountdownState {
  if (initialLabel === "Race window active") {
    return { label: initialLabel, units: activeUnits, isActive: true };
  }

  return { label: initialLabel, units: pendingUnits, isActive: false };
}

function getCountdownState(value: string | null | undefined, fallbackLabel = "Race time pending"): CountdownState {
  if (!value) {
    return { label: fallbackLabel, units: pendingUnits, isActive: false };
  }

  const raceTime = new Date(value).getTime();
  if (Number.isNaN(raceTime)) {
    return { label: fallbackLabel, units: pendingUnits, isActive: false };
  }

  const diffMs = raceTime - Date.now();
  if (diffMs <= 0) {
    return {
      label: "Race window active",
      units: activeUnits,
      isActive: true,
    };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const units = [
    { label: "Days", value: padUnit(days) },
    { label: "Hours", value: padUnit(hours) },
    { label: "Mins", value: padUnit(minutes) },
    { label: "Secs", value: padUnit(seconds) },
  ];

  if (days > 0) {
    return { label: `${days}d ${hours}h ${minutes}m ${seconds}s to lights out`, units, isActive: false };
  }

  if (hours > 0) {
    return { label: `${hours}h ${minutes}m ${seconds}s to lights out`, units, isActive: false };
  }

  return { label: `${minutes}m ${seconds}s to lights out`, units, isActive: false };
}

export function RaceCountdown({ scheduledAt, initialLabel }: RaceCountdownProps) {
  const [countdown, setCountdown] = useState(() => getInitialCountdownState(initialLabel));

  useEffect(() => {
    const updateLabel = () => setCountdown(getCountdownState(scheduledAt, initialLabel));

    updateLabel();
    const interval = window.setInterval(updateLabel, 1000);

    return () => window.clearInterval(interval);
  }, [initialLabel, scheduledAt]);

  return (
    <time
      className={`race-countdown${countdown.isActive ? " race-countdown--active" : ""}`}
      dateTime={scheduledAt ?? undefined}
      aria-label={countdown.label}
    >
      <span className="race-countdown__status">{countdown.isActive ? "Session live" : "Lights out in"}</span>
      <span className="race-countdown__units" aria-hidden="true">
        {countdown.units.map((unit) => (
          <span className="race-countdown__unit" key={unit.label}>
            <strong>{unit.value}</strong>
            <span>{unit.label}</span>
          </span>
        ))}
      </span>
      <span className="race-countdown__sr">{countdown.label}</span>
    </time>
  );
}
