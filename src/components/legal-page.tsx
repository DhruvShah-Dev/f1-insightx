import type { ReactNode } from "react";
import { SiteShell } from "./site-shell";
import "./legal-page.css";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return <SiteShell>
    <article className="legal-page">
      <p className="legal-eyebrow">F1 InsightX / Legal</p>
      <h1>{title}</h1>
      <p className="legal-updated">Last updated {updated}</p>
      <div className="legal-content">{children}</div>
    </article>
  </SiteShell>;
}
