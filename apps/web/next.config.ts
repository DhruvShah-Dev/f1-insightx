import { fileURLToPath } from "node:url";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

const configDir = fileURLToPath(new URL(".", import.meta.url));
const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));

loadEnvConfig(workspaceRoot, true, console, true);
loadEnvConfig(configDir, true);

const nextConfig: NextConfig = {
  turbopack: {
    root: workspaceRoot,
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
        ],
      },
    ];
  },
};

export default nextConfig;
