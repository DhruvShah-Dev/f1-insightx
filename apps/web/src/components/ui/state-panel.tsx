import Link from "next/link";
import type { ReactNode } from "react";

type StatePanelProps = {
  eyebrow?: string;
  title: string;
  message: string;
  tone?: "default" | "error" | "notice";
  action?: ReactNode;
  actionHref?: string;
  actionLabel?: string;
};

export function StatePanel({
  eyebrow,
  title,
  message,
  tone = "default",
  action,
  actionHref,
  actionLabel,
}: StatePanelProps) {
  return (
    <section className={`workspace-panel state-panel state-panel--${tone}`}>
      {eyebrow ? <div className="workspace-panel__eyebrow">{eyebrow}</div> : null}
      <div className="workspace-panel__headline">{title}</div>
      <p className="section-copy state-panel__copy">{message}</p>
      {action ? <div className="state-panel__actions">{action}</div> : null}
      {!action && actionHref && actionLabel ? (
        <div className="state-panel__actions">
          <Link href={actionHref} className="hero__cta hero__cta--secondary">
            {actionLabel}
          </Link>
        </div>
      ) : null}
    </section>
  );
}
