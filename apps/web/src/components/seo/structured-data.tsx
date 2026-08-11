import { absoluteUrl, seo } from "@/lib/seo";

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function RootStructuredData() {
  const organizationId = `${absoluteUrl("/")}#organization`;
  const websiteId = `${absoluteUrl("/")}#website`;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          "@id": organizationId,
          name: seo.siteName,
          url: absoluteUrl("/"),
          logo: absoluteUrl("/assets/logos/wordmark.png"),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          "@id": websiteId,
          name: seo.siteName,
          url: absoluteUrl("/"),
          publisher: {
            "@id": organizationId,
          },
        }}
      />
    </>
  );
}

/**
 * BreadcrumbList markup for deep routes (race reports, per-season standings).
 * Without it, search results show a bare URL trail for pages that sit two levels
 * below the homepage.
 */
export function BreadcrumbStructuredData({ items }: { items: { name: string; path: string }[] }) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [{ name: "Home", path: "/" }, ...items].map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: absoluteUrl(item.path),
        })),
      }}
    />
  );
}
