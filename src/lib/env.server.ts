export function readSupabaseRuntimeEnv() {
  const url =
    process.env["SUPABASE_URL"] ??
    process.env["VITE_SUPABASE_URL"] ??
    process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const publishableKey =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ??
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];

  return { url, publishableKey };
}

export function hasSupabaseRuntimeEnv() {
  const { url, publishableKey } = readSupabaseRuntimeEnv();
  return Boolean(url && publishableKey);
}
