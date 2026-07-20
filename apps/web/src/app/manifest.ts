import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "F1 InsightX",
    short_name: "F1 InsightX",
    description: "Formula 1 telemetry, predictions, strategy, and race analysis.",
    start_url: absoluteUrl("/"),
    display: "standalone",
    background_color: "#050608",
    theme_color: "#e10600",
    icons: [
      {
        src: "/assets/logos/icon-light.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/assets/logos/f1_insightx_logo_icon_dark.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
