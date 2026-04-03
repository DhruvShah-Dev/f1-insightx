import { CURRENT_2026_TEAM_IDS, getTeamAsset } from "@/lib/ui/asset-manifest";
import { CURRENT_2026_DRIVER_IDS, getCurrentDriverMeta } from "@/lib/ui/driver-asset-manifest";

export type AccountConstructorOption = {
  id: string;
  label: string;
  shortLabel: string;
  primary: string;
  secondary: string;
  badgeAssetPath: string | null;
};

export type AccountDriverOption = {
  id: string;
  label: string;
  code: string;
  teamId: string;
  nationality: string;
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
    photoPath: driver.photoPath,
    fallbackPhotoPath: driver.fallbackPhotoPath,
  };
});
