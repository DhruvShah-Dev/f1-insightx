import { getServerEnv } from "@/lib/env";

export function LiveStatus() {
  const env = getServerEnv();
  const mode = env.hasSupabase ? "supabase" : "local-curated-csv";
  const referenceData = env.hasSupabase ? "supabase" : "filesystem";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="status-chip">{mode}</span>
      <span className="status-chip status-chip--muted">{referenceData}</span>
    </div>
  );
}
