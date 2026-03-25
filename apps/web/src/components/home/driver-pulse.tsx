import { TeamBadge } from "@/components/ui/team-badge";
import { TeamCarCard } from "@/components/ui/team-car-card";
import { listDrivers } from "@/lib/server/reference-data";

type Driver = {
  id: string;
  driverCode: string | null;
  permanentNumber: number | null;
  firstName: string;
  lastName: string;
  fullName: string;
  nationality: string | null;
  dateOfBirth: string | null;
};

type PulseDriver = Driver & {
  label: string;
  constructorId: string;
};

const lookups = [
  { search: "ver", label: "Title pace", constructorId: "red_bull" },
  { search: "lec", label: "One-lap threat", constructorId: "ferrari" },
  { search: "nor", label: "Trend watch", constructorId: "mclaren" },
];

export async function DriverPulse() {
  const payloads = await Promise.all(
    lookups.map(async (lookup) => {
      const [driver] = await listDrivers({ search: lookup.search, limit: 1 });
      return driver ? { ...driver, label: lookup.label, constructorId: lookup.constructorId } : null;
    }),
  );

  const drivers = payloads.filter((item): item is PulseDriver => item !== null);

  return (
    <div className="workspace-panel workspace-panel--dark">
      <div className="workspace-panel__eyebrow">Driver pulse</div>
      <div className="workspace-panel__headline">Three quick reads from the current field.</div>
      <div className="mt-6 space-y-4">
        {drivers.length === 0 ? (
          <p className="lab-copy">Driver previews appear once reference data is available for the current field.</p>
        ) : (
          drivers.map((driver) => (
            <div key={driver.id} className="border-t border-white/10 pt-4 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--text-muted)]">{driver.label}</p>
                  <h4 className="mt-2 text-2xl uppercase tracking-[0.08em] text-white">{driver.fullName}</h4>
                </div>
                <span className="rounded-full border border-white/12 px-3 py-1 font-mono text-xs uppercase tracking-[0.25em] text-[var(--text-secondary)]">
                  {driver.driverCode ?? driver.id.slice(0, 3).toUpperCase()}
                </span>
              </div>
              {driver.constructorId ? (
                <TeamCarCard
                  teamId={driver.constructorId}
                  title={driver.fullName}
                  subtitle="Constructor card"
                  compact
                />
              ) : null}
              {driver.constructorId ? (
                <div className="mt-3">
                  <TeamBadge teamId={driver.constructorId} compact />
                </div>
              ) : null}
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{driver.nationality ?? "Nationality unavailable"}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
