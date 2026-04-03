import { redirect } from "next/navigation";
import { ProfilePageShell } from "@/components/account/profile-page-shell";
import { StatePanel } from "@/components/ui/state-panel";
import { ACCOUNT_CONSTRUCTOR_OPTIONS, ACCOUNT_DRIVER_OPTIONS } from "@/lib/account/options";
import { ensureProfileFromUserMetadata, getAuthProviderLabel, getUserProfileByIdWithClient } from "@/lib/account/profile";
import { getSupabaseServerClient } from "@/lib/auth/supabase-server";
import { getServerEnv } from "@/lib/env";
import { logServerError } from "@/lib/errors/logger";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile | F1 InsightX",
  robots: {
    index: false,
    follow: false,
  },
};

function readMetadataString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export default async function ProfilePage() {
  const { hasSupabaseAdmin, hasSupabaseAuth } = getServerEnv();
  const supabase = await getSupabaseServerClient();
  if (!supabase || !hasSupabaseAuth) {
    return (
      <main className="subpage-shell account-page">
        <section className="workspace-panel">
          <div className="workspace-panel__eyebrow">Profile</div>
          <div className="workspace-panel__headline">Supabase Auth is not configured yet.</div>
          <p className="lab-copy">Add the required public auth settings before using account routes.</p>
        </section>
      </main>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/account");
  }

  let profile = null;
  if (hasSupabaseAdmin) {
    try {
      profile = await getUserProfileByIdWithClient(supabase, user.id);
      if (!profile) {
        profile = await ensureProfileFromUserMetadata(user);
      }
    } catch (error) {
      logServerError("page:profile:load-profile", error, { userId: user.id });
      return (
        <main className="subpage-shell account-page">
          <StatePanel
            eyebrow="Profile"
            title="Your account loaded, but the profile record could not be read."
            message="Try refreshing the page. If the problem keeps returning, sign out and sign back in."
            tone="error"
            actionHref="/account"
            actionLabel="Go to account"
          />
        </main>
      );
    }
  }

  const fallbackProfile = {
    username: readMetadataString(user.user_metadata?.username),
    usernameIsCustom: false,
    usernameLastChangedAt: null,
    usernameLockedUntil: null,
    profileLastChangedAt: null,
    profileLockedUntil: null,
    favoriteConstructorId: readMetadataString(user.user_metadata?.favorite_constructor_id),
    favoriteDriverId: readMetadataString(user.user_metadata?.favorite_driver_id),
    avatarType:
      user.user_metadata?.avatar_type === "driver_image" || user.user_metadata?.avatar_type === "constructor_logo"
        ? user.user_metadata.avatar_type
        : "constructor_logo",
    onboardingCompleted: false,
  } as const;

  return (
    <ProfilePageShell
      userId={user.id}
      email={user.email ?? ""}
      provider={getAuthProviderLabel(user)}
      hasProfilePersistence={hasSupabaseAdmin}
      constructors={ACCOUNT_CONSTRUCTOR_OPTIONS}
      drivers={ACCOUNT_DRIVER_OPTIONS}
      initialProfile={
        profile
          ? {
              username: profile.username,
              usernameIsCustom: profile.usernameIsCustom,
              usernameLastChangedAt: profile.usernameLastChangedAt,
              usernameLockedUntil: profile.usernameLockedUntil,
              profileLastChangedAt: profile.profileLastChangedAt,
              profileLockedUntil: profile.profileLockedUntil,
              favoriteConstructorId: profile.favoriteConstructorId,
              favoriteDriverId: profile.favoriteDriverId,
              avatarType: profile.avatarType,
              onboardingCompleted: profile.onboardingCompleted,
            }
          : fallbackProfile
      }
    />
  );
}
