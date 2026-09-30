import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "./site-chrome";

export function PicksShell({ children }: { children: ReactNode }) {
  return (
    <div className="picks-shell">
      <SiteHeader />
      <main id="picks-top" className="picks-site-main">{children}</main>
      <SiteFooter />
    </div>
  );
}
