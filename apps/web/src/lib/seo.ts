import type { Metadata } from "next";

const siteName = "F1 InsightX";
const defaultDescription =
  "Premium Formula 1 telemetry analysis, race-week predictions, strategy intelligence, and post-race reports.";
const defaultOgImage = "/assets/logos/wordmark.png";

function normalizeUrl(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withProtocol);
  } catch {
    return null;
  }
}

export function getSiteUrl() {
  return (
    normalizeUrl(process.env.NEXT_PUBLIC_APP_URL)
    ?? normalizeUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL)
    ?? normalizeUrl(process.env.VERCEL_URL)
    ?? new URL("http://localhost:3000")
  );
}

export function absoluteUrl(path = "/") {
  return new URL(path, getSiteUrl()).toString();
}

export function makeMetadata({
  title,
  description = defaultDescription,
  path = "/",
  image = defaultOgImage,
  keywords = [],
  index = true,
}: {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  keywords?: string[];
  index?: boolean;
} = {}): Metadata {
  const canonical = path.startsWith("http") ? path : absoluteUrl(path);
  const resolvedTitle = title ? `${title} | ${siteName}` : siteName;

  return {
    title: title ?? { absolute: siteName },
    description,
    applicationName: siteName,
    alternates: {
      canonical,
    },
    keywords: [
      "Formula 1 analytics",
      "F1 telemetry",
      "F1 predictions",
      "race strategy",
      "Formula 1 race analysis",
      ...keywords,
    ],
    robots: {
      index,
      follow: index,
      googleBot: {
        index,
        follow: index,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      type: "website",
      siteName,
      title: resolvedTitle,
      description,
      url: canonical,
      images: [
        {
          url: absoluteUrl(image),
          width: 1200,
          height: 630,
          alt: `${siteName} race intelligence dashboard`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: resolvedTitle,
      description,
      images: [absoluteUrl(image)],
    },
  };
}

export const seo = {
  siteName,
  defaultDescription,
  defaultOgImage,
};
