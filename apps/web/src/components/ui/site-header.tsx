import { AppHeader } from "@/components/ui/app-header";

type SiteHeaderProps = {
  title: string;
  backHref?: string;
  backLabel?: string;
  actionHref?: string;
  actionLabel?: string;
};

export function SiteHeader({
  title,
  actionHref,
  actionLabel
}: SiteHeaderProps) {
  return <AppHeader title={title} actionHref={actionHref} actionLabel={actionLabel} compact />;
}
