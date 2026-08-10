import { permanentRedirect } from "next/navigation";

// Public analytics page: the offline pipeline refreshes source data at most a few
// times per race weekend, so serve a cached render and revalidate in the
// background instead of rebuilding on every request.
export const revalidate = 900;

export default function RaceWeekAliasPage() {
  permanentRedirect("/predictions");
}
