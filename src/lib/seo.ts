const SITE_NAME = "F1 InsightX";
export const SITE_ORIGIN = "https://f1insightx.live";
const SOCIAL_IMAGE = "/images/race-control-hero.png";

export function pageSeo({
  title,
  description,
  path,
  type = "website",
  index = true,
}: {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  index?: boolean;
}) {
  const url = new URL(path, SITE_ORIGIN).toString();
  const image = new URL(SOCIAL_IMAGE, SITE_ORIGIN).toString();

  return {
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: index ? "index,follow,max-image-preview:large" : "noindex,follow" },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: type },
      { property: "og:url", content: url },
      { property: "og:image", content: image },
      { property: "og:image:alt", content: "F1 InsightX race intelligence" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
