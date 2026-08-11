import type { Metadata } from "next";
import { Barlow_Condensed, IBM_Plex_Mono } from "next/font/google";
import { HomeAccountEntry } from "@/components/account/home-account-entry";
import { CookieConsent } from "@/components/legal/cookie-consent";
import { DataFreshnessBanner } from "@/components/ui/data-freshness-banner";
import { RootStructuredData } from "@/components/seo/structured-data";
import { AppHeader } from "@/components/ui/app-header";
import { getServerEnv } from "@/lib/env";
import { getSiteUrl, makeMetadata, seo } from "@/lib/seo";
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

export const metadata: Metadata = {
  ...makeMetadata(),
  metadataBase: getSiteUrl(),
  title: {
    default: seo.siteName,
    template: `%s | ${seo.siteName}`,
  },
  category: "sports analytics",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/assets/logos/icon-light.svg", type: "image/svg+xml" },
    ],
    apple: "/assets/logos/f1_insightx_logo_icon_dark.png",
  },
  manifest: "/manifest.webmanifest",
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
};

// NOTE: This layout is intentionally free of any request-scoped API (cookies(),
// headers(), Supabase server client). Reading cookies here opted every route in
// the app out of static rendering, so Next.js served every page with
// `Cache-Control: private, no-store` and re-rendered it per request.
// Auth state is resolved in the browser by <HomeAccountEntry />, which already
// subscribes to onAuthStateChange and fetches the profile, so nothing is lost.
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { hasSupabaseAdmin, hasSupabaseAuth } = getServerEnv();
  const hasProfilePersistence = hasSupabaseAdmin && hasSupabaseAuth;

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
            />
          )}
        />
        <DataFreshnessBanner />
        <RootStructuredData />
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
