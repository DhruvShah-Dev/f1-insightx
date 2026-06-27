"use client";

import type { KeyboardEvent, ReactNode } from "react";

type HorizontalScrollRailProps = {
  ariaLabel: string;
  children: ReactNode;
  className: string;
};

export function HorizontalScrollRail({ ariaLabel, children, className }: HorizontalScrollRailProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    event.currentTarget.scrollBy({
      left: event.key === "ArrowRight" ? event.currentTarget.clientWidth * 0.72 : event.currentTarget.clientWidth * -0.72,
      behavior: "auto",
    });
  };

  return (
    <div className={className} aria-label={ariaLabel} tabIndex={0} onKeyDown={handleKeyDown}>
      {children}
    </div>
  );
}
