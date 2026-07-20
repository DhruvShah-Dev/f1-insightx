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
