import { fileURLToPath } from "node:url";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

const configDir = fileURLToPath(new URL(".", import.meta.url));
const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));

loadEnvConfig(configDir, true);
loadEnvConfig(workspaceRoot, true);

const nextConfig: NextConfig = {
  turbopack: {
    root: workspaceRoot,
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
