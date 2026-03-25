const hasValue = (value: string | undefined) => Boolean(value && value.trim().length > 0);

export function getServerEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return {
    supabaseUrl,
    supabaseServiceRoleKey,
    hasSupabase: hasValue(supabaseUrl) && hasValue(supabaseServiceRoleKey),
  };
}
