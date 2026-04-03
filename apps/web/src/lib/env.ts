const hasValue = (value: string | undefined) => Boolean(value && value.trim().length > 0);

export function getServerEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const hasSupabaseAuth = hasValue(supabaseUrl) && hasValue(supabaseAnonKey);
  const hasSupabaseAdmin = hasValue(supabaseUrl) && hasValue(supabaseServiceRoleKey);

  return {
    appUrl,
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    hasSupabase: hasSupabaseAdmin,
    hasSupabaseAdmin,
    hasSupabaseAuth,
  };
}
