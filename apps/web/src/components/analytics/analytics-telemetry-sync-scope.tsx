"use client";

import { type ReactNode, useEffect, useRef } from "react";

type AnalyticsTelemetrySyncScopeProps = {
  children: ReactNode;
  initialFocusId?: string | null;
  label: string;
};

function clearActive(container: HTMLElement) {
  container.querySelectorAll(".analytics-sync-active").forEach((node) => {
    node.classList.remove("analytics-sync-active");
  });
}

function activate(container: HTMLElement, syncId: string | null | undefined) {
  clearActive(container);
  if (!syncId) {
    container.removeAttribute("data-active-sync");
    return;
  }

  container.dataset.activeSync = syncId;
  container.querySelectorAll(`[data-sync-id="${CSS.escape(syncId)}"]`).forEach((node) => {
    node.classList.add("analytics-sync-active");
  });
}

export function AnalyticsTelemetrySyncScope({ children, initialFocusId, label }: AnalyticsTelemetrySyncScopeProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      activate(ref.current, initialFocusId);
    }
  }, [initialFocusId]);

  return (
    <div
      ref={ref}
      className="analytics-sync-scope"
      aria-label={label}
      onPointerOver={(event) => {
        const target = (event.target as HTMLElement).closest<HTMLElement>("[data-sync-id]");
        if (target && ref.current?.contains(target)) {
          activate(ref.current, target.dataset.syncId);
        }
      }}
      onFocusCapture={(event) => {
        const target = (event.target as HTMLElement).closest<HTMLElement>("[data-sync-id]");
        if (target && ref.current?.contains(target)) {
          activate(ref.current, target.dataset.syncId);
        }
      }}
      onPointerLeave={() => {
        if (ref.current) {
          activate(ref.current, initialFocusId);
        }
      }}
    >
      {children}
    </div>
  );
}
