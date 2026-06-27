import type { Metadata } from "next";
import { Barlow_Condensed, IBM_Plex_Mono } from "next/font/google";
import { HomeAccountEntry } from "@/components/account/home-account-entry";
import { CookieConsent } from "@/components/legal/cookie-consent";
import { AppHeader } from "@/components/ui/app-header";
import { getSupabaseServerClient } from "@/lib/auth/supabase-server";
import { getServerEnv } from "@/lib/env";
import "./globals.css";
import "./home-hero.css";
import "./race-analysis-cinematic.css";
import "./championship-cinematic.css";

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

  if (hasSupabaseAuth) {
    try {
      const supabase = await getSupabaseServerClient();
      if (supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        initialAuthState = session?.user ? "authenticated" : "anonymous";
      }
    } catch {
      initialAuthState = "anonymous";
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
            />
          )}
        />
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
