import { fileURLToPath } from "node:url";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

const configDir = fileURLToPath(new URL(".", import.meta.url));
const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));

loadEnvConfig(workspaceRoot, true, console, true);
loadEnvConfig(configDir, true);

const contentSecurityPolicyReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openf1.org https://api.jolpi.ca https://ergast.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

const nextConfig: NextConfig = {
  turbopack: {
    root: workspaceRoot,
  },
  outputFileTracingRoot: workspaceRoot,
  outputFileTracingIncludes: {
    "/*": [
      "../../data/curated/**/*.csv",
      "../../data/predictions/**/*.csv",
      "../../data/race_analysis/**/*.csv",
      "../../data/race_week/**/*.csv",
      "../../data/strategy_lab/**/*.csv",
      "../../data/analytics/analytics_session_index.csv",
      "../../data/analytics/indexed/**/*.json",
      "../../data/analytics/indexed/**/*.json.gz",
      "../../data/season_state.json",
    ],
  },
  async redirects() {
    return [
      // Season selection moved from `?season=` to a path segment so the page can
      // be prerendered and CDN-cached; keep previously shared query links working.
      {
        source: "/championship",
        has: [{ type: "query", key: "season", value: "(?<season>\\d{4})" }],
        destination: "/championship/:season",
        permanent: false,
      },
      // Same reasoning for the race-analysis archive season filter and the
      // predictions practice-signal mode.
      {
        source: "/race-analysis",
        has: [{ type: "query", key: "season", value: "(?<season>\\d{4})" }],
        destination: "/race-analysis/season/:season",
        permanent: false,
      },
      {
        source: "/predictions",
        has: [{ type: "query", key: "mode", value: "(?<mode>fp1|fp2|fp3)" }],
        destination: "/predictions/:mode",
        permanent: false,
      },
      {
        source: "/achievements",
        destination: "/championship",
        permanent: false,
      },
      {
        source: "/pit-wall-picks",
        destination: "/picks",
        permanent: false,
      },
      {
        source: "/analytics",
        destination: "/race-analysis",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicyReportOnly },
        ],
      },
      // Anything user-scoped must never be shared by the CDN. These routes read
      // cookies, so Next already marks them dynamic; this is belt-and-braces.
      {
        source: "/:path(account|profile|picks)/:rest*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" }],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" }],
      },
      // Public, user-agnostic analytics pages. The underlying data is produced by
      // an offline pipeline that runs a few times per race weekend at most, so a
      // shared CDN copy with background revalidation is safe and removes the
      // multi-second cold render from every visit.
      {
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=900, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/:path(championship|raceweek|race-analysis|races|lab|fantasy|versus|predictions)/:rest*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=900, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/:path(championship|raceweek|race-analysis|races|lab|fantasy|versus|predictions)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=900, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
