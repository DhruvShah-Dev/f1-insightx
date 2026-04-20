import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

type SupabaseStaticClient = SupabaseClient;

let publicClient: SupabaseStaticClient | null | undefined;
let privilegedClient: SupabaseStaticClient | null | undefined;

function buildStaticClient(supabaseUrl: string, apiKey: string) {
  return createClient(supabaseUrl, apiKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getSupabasePublicClient() {
  const { supabaseUrl, supabaseAnonKey, hasSupabaseAuth } = getServerEnv();
  if (!hasSupabaseAuth || !supabaseUrl || !supabaseAnonKey) {
    publicClient = null;
    return null;
  }

  if (!publicClient) {
    publicClient = buildStaticClient(supabaseUrl, supabaseAnonKey);
  }

  return publicClient;
}

export function getSupabasePrivilegedClient() {
  const { supabaseUrl, supabaseServiceRoleKey, hasSupabase } = getServerEnv();
  if (!hasSupabase || !supabaseUrl || !supabaseServiceRoleKey) {
    privilegedClient = null;
    return null;
  }

  if (!privilegedClient) {
    privilegedClient = buildStaticClient(supabaseUrl, supabaseServiceRoleKey);
  }

  return privilegedClient;
}

export const getSupabaseAdminClient = getSupabasePrivilegedClient;
