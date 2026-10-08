import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({ accessToken: z.string().min(20) });

async function verifiedAccount(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Your session expired. Sign in again and retry.");
  return { admin: supabaseAdmin, user: data.user };
}

export const exportAccountData = createServerFn({ method: "POST" })
  .validator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const { admin, user } = await verifiedAccount(data.accessToken);
    const [profile, submittedPicks] = await Promise.all([
      admin.from("user_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      admin.from("user_race_picks").select("*").eq("user_id", user.id),
    ]);
    if (profile.error || submittedPicks.error) {
      throw new Error("Account data could not be exported right now.");
    }
    return {
      exportedAt: new Date().toISOString(),
      account: { id: user.id, email: user.email, createdAt: user.created_at, provider: user.app_metadata.provider, metadata: user.user_metadata },
      profile: profile.data,
      submittedPicks: submittedPicks.data ?? [],
    };
  });

export const deleteAccountData = createServerFn({ method: "POST" })
  .validator((input) => inputSchema.extend({ confirmation: z.literal("DELETE") }).parse(input))
  .handler(async ({ data }) => {
    const { admin, user } = await verifiedAccount(data.accessToken);
    // Both user_profiles and user_race_picks reference auth.users with ON DELETE CASCADE.
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw new Error("Account deletion failed. Please try again or contact us.");
    return { deleted: true };
  });
