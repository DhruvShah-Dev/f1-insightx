import { AccountAuthPanel } from "@/components/account/account-auth-panel";
import { ProfilePageContent } from "@/components/account/profile-page-content";
import { AppHeader } from "@/components/ui/app-header";
import { SiteFooter } from "@/components/ui/site-footer";
import { StatePanel } from "@/components/ui/state-panel";
import { getSupabaseServerClient } from "@/lib/auth/supabase-server";
import { mapAuthErrorCode } from "@/lib/auth/navigation";
import { getServerEnv } from "@/lib/env";
import { logServerError } from "@/lib/errors/logger";
import type { User } from "@supabase/supabase-js";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile Access | F1 InsightX",
  robots: {
    index: false,
    follow: false,
  },
};

type AccountPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readErrorMessage(value: string | string[] | undefined) {
  if (!value) return "";
  return Array.isArray(value) ? value[0] ?? "" : value;
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const { hasSupabaseAdmin, hasSupabaseAuth } = getServerEnv();
  const hasProfilePersistence = hasSupabaseAdmin && hasSupabaseAuth;
  const params = (await searchParams) ?? {};
  const initialErrorCode = readErrorMessage(params.auth_error) || readErrorMessage(params.error);
  const initialError = mapAuthErrorCode(decodeURIComponent(initialErrorCode || ""));
  let authenticatedUser: User | null = null;

  try {
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      authenticatedUser = user;
    }
  } catch (error) {
    logServerError("page:account:load-user", error);
    return (
      <main className="subpage-shell account-page">
        <AppHeader title="Account" compact />
        <StatePanel
          eyebrow="Account"
          title="The account screen could not verify your current session."
          message="You can refresh the page and try again. If the problem persists, check your Supabase auth setup."
          tone="error"
          actionHref="/"
          actionLabel="Back to homepage"
        />
        <SiteFooter />
      </main>
    );
  }

  if (authenticatedUser) {
    return (
      <ProfilePageContent
        user={authenticatedUser}
        hasSupabaseAdmin={hasSupabaseAdmin}
        getProfileClient={async () => {
          const profileClient = await getSupabaseServerClient();
          if (!profileClient) {
            throw new Error("Supabase server client unavailable");
          }
          return profileClient;
        }}
      />
    );
  }

  return (
    <main className="subpage-shell account-page">
      <AppHeader title="Account" compact />
      <AccountAuthPanel
        hasSupabaseAuth={hasSupabaseAuth}
        hasProfilePersistence={hasProfilePersistence}
        initialError={initialError}
        initialMode="sign-in"
        surface="page"
      />
      <SiteFooter />
    </main>
  );
}
