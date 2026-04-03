import type { CSSProperties } from "react";
import { getTeamAsset } from "@/lib/ui/asset-manifest";

export type ProfileTheme = {
  key: string;
  className: string;
  label: string;
  eyebrow: string;
  style: CSSProperties;
};

const DEFAULT_THEME: ProfileTheme = {
  key: "default",
  className: "account-page--theme-default",
  label: "Profile",
  eyebrow: "Profile",
  style: {
    "--profile-theme-primary": "225, 6, 0",
    "--profile-theme-secondary": "255, 255, 255",
    "--profile-theme-accent": "225, 6, 0",
  } as CSSProperties,
};

function hexToRgbTriplet(hex: string) {
  const normalized = hex.replace("#", "").trim();
  const value = normalized.length === 3
    ? normalized
        .split("")
        .map((part) => `${part}${part}`)
        .join("")
    : normalized;

  const parsed = Number.parseInt(value, 16);
  if (Number.isNaN(parsed)) {
    return "255, 255, 255";
  }

  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;
  return `${r}, ${g}, ${b}`;
}

export function getProfileTheme(constructorId?: string | null): ProfileTheme {
  if (!constructorId) {
    return DEFAULT_THEME;
  }

  const team = getTeamAsset(constructorId);
  return {
    key: team.id,
    className: "account-page--theme-constructor",
    label: team.label,
    eyebrow: `${team.label} profile`,
    style: {
      "--profile-theme-primary": hexToRgbTriplet(team.primary),
      "--profile-theme-secondary": hexToRgbTriplet(team.secondary),
      "--profile-theme-accent": hexToRgbTriplet(team.accent),
    } as CSSProperties,
  };
}
