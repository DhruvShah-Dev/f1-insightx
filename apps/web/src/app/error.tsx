"use client";

import { useEffect } from "react";
import { SiteFooter } from "@/components/ui/site-footer";
import { SiteHeader } from "@/components/ui/site-header";
import { StatePanel } from "@/components/ui/state-panel";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }
  }, [error]);

  return (
    <main className="subpage-shell">
      <SiteHeader title="F1 InsightX" />
      <StatePanel
        eyebrow="Application error"
        title="This screen hit a runtime problem."
        message="Try the request again. If the problem keeps returning, refresh the page or come back in a moment."
        tone="error"
        action={(
          <button type="button" className="hero__cta hero__cta--primary" onClick={() => reset()}>
            Try again
          </button>
        )}
      />
      <SiteFooter />
    </main>
  );
}
