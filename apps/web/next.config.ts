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
    ];
  },
};

export default nextConfig;
