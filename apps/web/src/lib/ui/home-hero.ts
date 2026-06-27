import { getCircuitAsset } from "@/lib/ui/asset-manifest";

export function formatRaceDateUtc(value: string | null | undefined) {
  if (!value) {
    return "Schedule pending";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Schedule pending";
  }

  const datePart = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);

  return `${datePart} - ${timePart} UTC`;
}

export function formatCountdown(value: string | null | undefined, now = Date.now()) {
  if (!value) {
    return "Race time pending";
  }

  const raceTime = new Date(value).getTime();
  if (Number.isNaN(raceTime)) {
    return "Race time pending";
  }

  const diffMs = raceTime - now;
  if (diffMs <= 0) {
    return "Race window active";
  }

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = Math.floor((diffMs / (1000 * 60)) % 60);

  if (days > 0) return `${days}d ${hours}h to lights out`;
  if (hours > 0) return `${hours}h ${minutes}m to lights out`;
  return `${Math.max(minutes, 1)}m to lights out`;
}

export function getCircuitDisplayName(circuitId: string | null | undefined) {
  const circuit = getCircuitAsset(circuitId);
  return circuit.displayName || circuit.region || "Circuit pending";
}
