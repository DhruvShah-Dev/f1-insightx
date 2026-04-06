import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

let adminClient: ReturnType<typeof createClient> | null | undefined;

export function getSupabaseAdminClient() {
  const { supabaseUrl, supabaseServiceRoleKey, hasSupabase } = getServerEnv();
  if (!hasSupabase || !supabaseUrl || !supabaseServiceRoleKey) {
    adminClient = null;
    return null;
  }

  if (!adminClient) {
    adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return adminClient;
}
