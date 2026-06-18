"use client";

import { useEffect, useMemo, useState } from "react";

type PicksCountdownProps = {
  lockAt: string;
};

function countdownUnits(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return [
      { label: "DD", value: String(days) },
      { label: "HH", value: String(hours).padStart(2, "0") },
      { label: "MM", value: String(minutes).padStart(2, "0") },
      { label: "SS", value: String(seconds).padStart(2, "0") },
    ];
  }

  return [
    { label: "HH", value: String(hours).padStart(2, "0") },
    { label: "MM", value: String(minutes).padStart(2, "0") },
    { label: "SS", value: String(seconds).padStart(2, "0") },
  ];
}

export function PicksCountdown({ lockAt }: PicksCountdownProps) {
  const lockTime = useMemo(() => new Date(lockAt).getTime(), [lockAt]);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const intervalId = window.setInterval(update, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const isValid = Number.isFinite(lockTime);
  const remaining = isValid && now !== null ? lockTime - now : null;
  const isLocked = remaining !== null && remaining <= 0;
  const units = remaining !== null && remaining > 0 ? countdownUnits(remaining) : null;

  return (
    <div className={`pit-wall-countdown ${isLocked ? "pit-wall-countdown--locked" : ""}`}>
      <span>Countdown</span>
      {isLocked ? (
        <strong className="pit-wall-countdown__locked" suppressHydrationWarning>
          Locked
        </strong>
      ) : (
        <div className="pit-wall-countdown__units" suppressHydrationWarning>
          {(units ?? [
            { label: "HH", value: "--" },
            { label: "MM", value: "--" },
            { label: "SS", value: "--" },
          ]).map((unit) => (
            <div className="pit-wall-countdown__unit" key={unit.label}>
              <strong>{unit.value}</strong>
              <em>{unit.label}</em>
            </div>
          ))}
        </div>
      )}
      <small>{isLocked ? "Locked" : "until lock"}</small>
    </div>
  );
}
