import {
  getCurrentConstructorStandingsSnapshot,
  getCurrentDriverStandingsSnapshot,
} from "@/lib/server/f1-platform";
import { getCurrentDriverMeta } from "@/lib/ui/driver-asset-manifest";

export type DriverStanding = {
  driverId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  teamId: string;
  teamName: string;
  points: number;
  standingPosition: number;
  code: string | null;
  nationality: string | null;
};

export type CurrentSeasonDriverStandings = {
  season: number;
  latestRaceId: string;
  latestRaceName: string;
  latestRaceDate: string;
  items: DriverStanding[];
};

export type ConstructorStanding = {
  constructorId: string;
  constructorName: string;
  points: number;
  standingPosition: number;
  wins: number;
};

export async function getCurrentSeasonDriverStandings(): Promise<CurrentSeasonDriverStandings | null> {
  const snapshot = await getCurrentDriverStandingsSnapshot();
  if (!snapshot) {
    return null;
  }

  return {
    season: snapshot.season,
    latestRaceId: snapshot.race.id,
    latestRaceName: snapshot.race.raceName,
    latestRaceDate: snapshot.race.scheduledAt,
    items: snapshot.items.map((item) => {
      const meta = getCurrentDriverMeta(item.driverId);
      const parts = item.driverName.trim().split(/\s+/);
      const firstName = meta.firstName || parts.slice(0, -1).join(" ") || parts[0] || item.driverName;
      const lastName = meta.lastName || parts.at(-1) || item.driverName;

      return {
        driverId: item.driverId,
        firstName,
        lastName,
        displayName: meta.displayName !== "Driver" ? meta.displayName : item.driverName,
        teamId: item.constructorId,
        teamName: meta.currentTeamName !== "Constructor" ? meta.currentTeamName : item.constructorName,
        points: item.points,
        standingPosition: item.standingPosition,
        code: meta.driverCode !== "DRV" ? meta.driverCode : null,
        nationality: meta.nationality !== "Nationality pending" ? meta.nationality : item.nationality,
      };
    }),
  };
}

export async function getCurrentSeasonConstructorStandings(): Promise<{
  season: number;
  latestRaceId: string;
  latestRaceName: string;
  latestRaceDate: string;
  items: ConstructorStanding[];
} | null> {
  const snapshot = await getCurrentConstructorStandingsSnapshot();
  if (!snapshot) {
    return null;
  }

  return {
    season: snapshot.season,
    latestRaceId: snapshot.race.id,
    latestRaceName: snapshot.race.raceName,
    latestRaceDate: snapshot.race.scheduledAt,
    items: snapshot.items.map((item) => ({
      constructorId: item.constructorId,
      constructorName: item.constructorName,
      points: item.points,
      standingPosition: item.standingPosition,
      wins: item.wins,
    })),
  };
}
