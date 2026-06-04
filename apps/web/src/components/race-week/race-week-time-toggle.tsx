"use client";

import { useMemo, useState } from "react";

type RaceWeekSessionTime = {
  label: string;
  iso: string;
  status?: string;
};

type RaceWeekTimeToggleProps = {
  sessions: RaceWeekSessionTime[];
  trackTimeZone: string;
};

function formatTime(iso: string, timeZone: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Time pending";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(date);
}

export function RaceWeekTimeToggle({ sessions, trackTimeZone }: RaceWeekTimeToggleProps) {
  const [mode, setMode] = useState<"track" | "local">("track");
  const localTimeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);
  const activeTimeZone = mode === "track" ? trackTimeZone : localTimeZone;

  return (
    <div className="race-week-time-toggle">
      <div className="race-week-time-toggle__bar" role="tablist" aria-label="Weekend time zone">
        <button type="button" className={mode === "track" ? "is-active" : ""} onClick={() => setMode("track")}>
          Track time
        </button>
        <button type="button" className={mode === "local" ? "is-active" : ""} onClick={() => setMode("local")}>
          Local time
        </button>
      </div>

      <div className="race-week-time-toggle__zone">
        {mode === "track" ? "Monaco track time" : localTimeZone.replaceAll("_", " ")}
      </div>

      <div className="race-week-timetable__rail">
        {sessions.map((session) => (
          <article className={session.label === "Race" ? "race-week-timetable__slot race-week-timetable__slot--race" : "race-week-timetable__slot"} key={session.label}>
            <span>{session.status ?? "Provisional"}</span>
            <strong>{session.label}</strong>
            <em>{formatTime(session.iso, activeTimeZone)}</em>
          </article>
        ))}
      </div>
    </div>
  );
}
