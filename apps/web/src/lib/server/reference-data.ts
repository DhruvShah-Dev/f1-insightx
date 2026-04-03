import { getSupabaseAdminClient } from "@/lib/server/supabase";
import { compareSeasonRoundDesc } from "@/lib/server/utils";
import { parseBoolean, parseNumber, readCuratedCsv } from "@/lib/server/csv";

type ReferenceFilters = {
  search?: string;
  limit: number;
};

type RacesFilters = {
  season?: number;
  limit: number;
};

export type Driver = {
  id: string;
  driverCode: string | null;
  permanentNumber: number | null;
  firstName: string;
  lastName: string;
  fullName: string;
  nationality: string | null;
  dateOfBirth: string | null;
};

export type Constructor = {
  id: string;
  constructorCode: string | null;
  name: string;
  nationality: string | null;
};

export type Circuit = {
  id: string;
  circuitCode: string | null;
  name: string;
  location: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
};

export type Race = {
  id: string;
  season: number;
  round: number;
  raceName: string;
  officialName: string | null;
  circuitId: string;
  scheduledAt: string;
  sprintWeekend: boolean;
};

type SupabaseDriverRow = {
  id: string;
  driver_code: string | null;
  permanent_number: number | null;
  first_name: string;
  last_name: string;
  full_name: string;
  nationality: string | null;
  date_of_birth: string | null;
};

type SupabaseConstructorRow = {
  id: string;
  constructor_code: string | null;
  name: string;
  nationality: string | null;
};

type SupabaseCircuitRow = {
  id: string;
  circuit_code: string | null;
  name: string;
  location: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
};

type SupabaseRaceRow = {
  id: string;
  season: number;
  round: number;
  race_name: string;
  official_name: string | null;
  circuit_id: string;
  scheduled_at: string;
  sprint_weekend: boolean;
};

async function loadDriversFromCsv(filters: ReferenceFilters): Promise<Driver[]> {
  const rows = await readCuratedCsv("drivers.csv");
  const search = filters.search?.toLowerCase();

  return rows
    .filter((row) => {
      if (!search) {
        return true;
      }

      return [row.id, row.driver_code, row.first_name, row.last_name, row.full_name]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(search));
    })
    .slice(0, filters.limit)
    .map((row) => ({
      id: row.id,
      driverCode: row.driver_code || null,
      permanentNumber: parseNumber(row.permanent_number),
      firstName: row.first_name,
      lastName: row.last_name,
      fullName: row.full_name,
      nationality: row.nationality || null,
      dateOfBirth: row.date_of_birth || null,
    }));
}

async function loadConstructorsFromCsv(filters: ReferenceFilters): Promise<Constructor[]> {
  const rows = await readCuratedCsv("constructors.csv");
  const search = filters.search?.toLowerCase();

  return rows
    .filter((row) => {
      if (!search) {
        return true;
      }

      return [row.id, row.constructor_code, row.name]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(search));
    })
    .slice(0, filters.limit)
    .map((row) => ({
      id: row.id,
      constructorCode: row.constructor_code || null,
      name: row.name,
      nationality: row.nationality || null,
    }));
}

async function loadCircuitsFromCsv(filters: ReferenceFilters): Promise<Circuit[]> {
  const rows = await readCuratedCsv("circuits.csv");
  const search = filters.search?.toLowerCase();

  return rows
    .filter((row) => {
      if (!search) {
        return true;
      }

      return [row.id, row.circuit_code, row.name, row.location, row.country]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(search));
    })
    .slice(0, filters.limit)
    .map((row) => ({
      id: row.id,
      circuitCode: row.circuit_code || null,
      name: row.name,
      location: row.location || null,
      country: row.country || null,
      lat: parseNumber(row.lat),
      lng: parseNumber(row.lng),
    }));
}

async function loadRacesFromCsv(filters: RacesFilters): Promise<Race[]> {
  const rows = await readCuratedCsv("races.csv");

  return rows
    .filter((row) => !filters.season || Number(row.season) === filters.season)
    .map((row) => ({
      id: row.id,
      season: Number(row.season),
      round: Number(row.round),
      raceName: row.race_name,
      officialName: row.official_name || null,
      circuitId: row.circuit_id,
      scheduledAt: row.scheduled_at,
      sprintWeekend: parseBoolean(row.sprint_weekend),
    }))
    .sort(compareSeasonRoundDesc)
    .slice(0, filters.limit);
}

export async function listDrivers(filters: ReferenceFilters) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return loadDriversFromCsv(filters);
  }

  let query = supabase
    .from("drivers")
    .select("id, driver_code, permanent_number, first_name, last_name, full_name, nationality, date_of_birth")
    .order("last_name")
    .order("first_name")
    .limit(filters.limit);

  if (filters.search) {
    query = query.or(`full_name.ilike.%${filters.search}%,driver_code.ilike.%${filters.search}%,id.ilike.%${filters.search}%`);
  }

  try {
    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to query drivers: ${error.message}`);
    }

    const rows = data as SupabaseDriverRow[];
    return rows.map((row) => ({
      id: row.id,
      driverCode: row.driver_code,
      permanentNumber: row.permanent_number,
      firstName: row.first_name,
      lastName: row.last_name,
      fullName: row.full_name,
      nationality: row.nationality,
      dateOfBirth: row.date_of_birth,
    }));
  } catch {
    return loadDriversFromCsv(filters);
  }
}

export async function listConstructors(filters: ReferenceFilters) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return loadConstructorsFromCsv(filters);
  }

  let query = supabase
    .from("constructors")
    .select("id, constructor_code, name, nationality")
    .order("name")
    .limit(filters.limit);

  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,constructor_code.ilike.%${filters.search}%,id.ilike.%${filters.search}%`);
  }

  try {
    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to query constructors: ${error.message}`);
    }

    const rows = data as SupabaseConstructorRow[];
    return rows.map((row) => ({
      id: row.id,
      constructorCode: row.constructor_code,
      name: row.name,
      nationality: row.nationality,
    }));
  } catch {
    return loadConstructorsFromCsv(filters);
  }
}

export async function listCircuits(filters: ReferenceFilters) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return loadCircuitsFromCsv(filters);
  }

  let query = supabase
    .from("circuits")
    .select("id, circuit_code, name, location, country, lat, lng")
    .order("country")
    .order("name")
    .limit(filters.limit);

  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,country.ilike.%${filters.search}%,location.ilike.%${filters.search}%,id.ilike.%${filters.search}%`);
  }

  try {
    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to query circuits: ${error.message}`);
    }

    const rows = data as SupabaseCircuitRow[];
    return rows.map((row) => ({
      id: row.id,
      circuitCode: row.circuit_code,
      name: row.name,
      location: row.location,
      country: row.country,
      lat: row.lat,
      lng: row.lng,
    }));
  } catch {
    return loadCircuitsFromCsv(filters);
  }
}

export async function listRaces(filters: RacesFilters) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return loadRacesFromCsv(filters);
  }

  let query = supabase
    .from("races")
    .select("id, season, round, race_name, official_name, circuit_id, scheduled_at, sprint_weekend")
    .order("season", { ascending: false })
    .order("round", { ascending: false })
    .limit(filters.limit);

  if (filters.season) {
    query = query.eq("season", filters.season);
  }

  try {
    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to query races: ${error.message}`);
    }

    const rows = data as SupabaseRaceRow[];
    return rows.map((row) => ({
      id: row.id,
      season: row.season,
      round: row.round,
      raceName: row.race_name,
      officialName: row.official_name,
      circuitId: row.circuit_id,
      scheduledAt: row.scheduled_at,
      sprintWeekend: row.sprint_weekend,
    }));
  } catch {
    return loadRacesFromCsv(filters);
  }
}

export async function listAvailableSeasons() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    const rows = await readCuratedCsv("races.csv");
    return [...new Set(rows.map((row) => Number(row.season)))].sort((a, b) => b - a);
  }

  try {
    const { data, error } = await supabase.from("races").select("season").order("season", { ascending: false });
    if (error) {
      throw new Error(`Failed to query seasons: ${error.message}`);
    }

    return [...new Set((data as Array<{ season: number }>).map((row) => row.season))];
  } catch {
    const rows = await readCuratedCsv("races.csv");
    return [...new Set(rows.map((row) => Number(row.season)))].sort((a, b) => b - a);
  }
}
