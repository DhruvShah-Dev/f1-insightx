import { AppHeader } from "@/components/ui/app-header";

type SiteHeaderProps = {
  title: string;
  backHref?: string;
  backLabel?: string;
  actionHref?: string;
  actionLabel?: string;
};

export function SiteHeader(props: SiteHeaderProps) {
  void props;
  return <AppHeader />;
}
