import type { MetadataRoute } from "next";
import { absoluteUrl, getSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/account", "/profile", "/founder-strategy-lab"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: siteUrl.origin,
  };
}
