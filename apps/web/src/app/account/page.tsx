import { redirect } from "next/navigation";
import { AccountAuthPanel } from "@/components/account/account-auth-panel";
import { StatePanel } from "@/components/ui/state-panel";
import { getSupabaseServerClient } from "@/lib/auth/supabase-server";
import { mapAuthErrorCode } from "@/lib/auth/navigation";
import { getServerEnv } from "@/lib/env";
import { logServerError } from "@/lib/errors/logger";
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
  const initialError = mapAuthErrorCode(decodeURIComponent(readErrorMessage(params.error) || ""));

  try {
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        redirect("/profile");
      }
    }
  } catch (error) {
    logServerError("page:account:load-user", error);
    return (
      <main className="subpage-shell account-page">
        <StatePanel
          eyebrow="Account"
          title="The account screen could not verify your current session."
          message="You can refresh the page and try again. If the problem persists, check your Supabase auth setup."
          tone="error"
          actionHref="/"
          actionLabel="Back to homepage"
        />
      </main>
    );
  }

  return (
    <main className="subpage-shell account-page">
      <AccountAuthPanel
        hasSupabaseAuth={hasSupabaseAuth}
        hasProfilePersistence={hasProfilePersistence}
        initialError={initialError}
        initialMode="sign-in"
        surface="page"
      />
    </main>
  );
}
