import type { Metadata } from "next";
import { Barlow_Condensed, IBM_Plex_Mono } from "next/font/google";
import { HomeAccountEntry } from "@/components/account/home-account-entry";
import { CookieConsent } from "@/components/legal/cookie-consent";
import { AppHeader } from "@/components/ui/app-header";
import { getUserProfileByIdWithClient } from "@/lib/account/profile";
import { getSupabaseServerClient } from "@/lib/auth/supabase-server";
import { getServerEnv } from "@/lib/env";
import { getSupabasePrivilegedClient } from "@/lib/server/supabase";
import "./globals.css";

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const metadataBase = (() => {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configuredUrl) {
    return new URL("http://localhost:3000");
  }

  try {
    return new URL(configuredUrl);
  } catch {
    return new URL("http://localhost:3000");
  }
})();

export const metadata: Metadata = {
  title: "F1 InsightX",
  description:
    "Premium Formula 1 telemetry analysis, race intelligence, and strategy simulation.",
  metadataBase,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { hasSupabaseAdmin, hasSupabaseAuth } = getServerEnv();
  const hasProfilePersistence = hasSupabaseAdmin && hasSupabaseAuth;
  let initialAuthState: "authenticated" | "anonymous" = "anonymous";
  let initialUsername = "";

  if (hasSupabaseAuth) {
    try {
      const supabase = await getSupabaseServerClient();
      if (supabase) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        initialAuthState = user ? "authenticated" : "anonymous";
        if (user) {
          const metadataUsername =
            typeof user.user_metadata?.username === "string" ? user.user_metadata.username : "";
          initialUsername = metadataUsername;

          if (hasProfilePersistence) {
            try {
              const profileClient = getSupabasePrivilegedClient() ?? supabase;
              const profile = await getUserProfileByIdWithClient(profileClient, user.id);
              initialUsername = profile?.username ?? metadataUsername;
            } catch {
              initialUsername = metadataUsername;
            }
          }
        }
      }
    } catch {
      initialAuthState = "anonymous";
      initialUsername = "";
    }
  }

  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${barlowCondensed.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppHeader
          accountSlot={(
            <HomeAccountEntry
              hasSupabaseAuth={hasSupabaseAuth}
              hasProfilePersistence={hasProfilePersistence}
              initialAuthState={initialAuthState}
              initialUsername={initialUsername}
            />
          )}
        />
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
