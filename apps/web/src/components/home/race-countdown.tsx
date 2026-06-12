"use client";

import { useEffect, useState } from "react";

type RaceCountdownProps = {
  scheduledAt: string | null | undefined;
  initialLabel: string;
};

function getCountdownLabel(value: string | null | undefined) {
  if (!value) {
    return "Race time pending";
  }

  const raceTime = new Date(value).getTime();
  if (Number.isNaN(raceTime)) {
    return "Race time pending";
  }

  const diffMs = raceTime - Date.now();
  if (diffMs <= 0) {
    return "Race window active";
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${seconds}s to lights out`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s to lights out`;
  }

  return `${minutes}m ${seconds}s to lights out`;
}

export function RaceCountdown({ scheduledAt, initialLabel }: RaceCountdownProps) {
  const [label, setLabel] = useState(initialLabel);

  useEffect(() => {
    const updateLabel = () => setLabel(getCountdownLabel(scheduledAt));

    updateLabel();
    const interval = window.setInterval(updateLabel, 1000);

    return () => window.clearInterval(interval);
  }, [scheduledAt]);

  return <time dateTime={scheduledAt ?? undefined}>{label}</time>;
}
