import { CURRENT_2026_TEAM_IDS, getTeamAsset } from "@/lib/ui/asset-manifest";
import { CURRENT_2026_DRIVER_IDS, getCurrentDriverMeta } from "@/lib/ui/driver-asset-manifest";

export type AccountConstructorOption = {
  id: string;
  label: string;
  shortLabel: string;
  primary: string;
  secondary: string;
  logoDarkPath: string | null;
  logoLightPath: string | null;
  logoMonoPath: string | null;
  badgeAssetPath: string | null;
};

export type AccountDriverOption = {
  id: string;
  label: string;
  code: string;
  teamId: string;
  nationality: string;
  headshotPath: string | null;
  bodyImagePath: string | null;
  photoPath: string | null;
  fallbackPhotoPath: string;
};

export const ACCOUNT_CONSTRUCTOR_OPTIONS: AccountConstructorOption[] = CURRENT_2026_TEAM_IDS.map((teamId) => {
  const team = getTeamAsset(teamId);
  return {
    id: team.id,
    label: team.label,
    shortLabel: team.shortLabel,
    primary: team.primary,
    secondary: team.secondary,
    logoDarkPath: team.logoDarkPath ?? null,
    logoLightPath: team.logoLightPath ?? null,
    logoMonoPath: team.logoMonoPath ?? null,
    badgeAssetPath: team.badgeAssetPath,
  };
});

export const ACCOUNT_DRIVER_OPTIONS: AccountDriverOption[] = CURRENT_2026_DRIVER_IDS.map((driverId) => {
  const driver = getCurrentDriverMeta(driverId);
  return {
    id: driver.driverId,
    label: driver.displayName,
    code: driver.driverCode,
    teamId: driver.teamId,
    nationality: driver.nationality,
    headshotPath: driver.headshotPath,
    bodyImagePath: driver.bodyImagePath,
    photoPath: driver.photoPath,
    fallbackPhotoPath: driver.fallbackPhotoPath,
  };
});
