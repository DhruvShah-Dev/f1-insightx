import { apiOk } from "@/lib/api/errors";
import { getServerEnv } from "@/lib/env";

export async function GET() {
  const env = getServerEnv();

  return apiOk({
    status: "ok",
    mode: env.hasSupabase ? "supabase" : "local-curated-csv",
    services: {
      referenceData: env.hasSupabase ? "supabase" : "filesystem",
    },
  });
}
