"use client";

import type { KeyboardEvent, ReactNode } from "react";

type VerticalScrollListProps = {
  ariaLabel: string;
  children: ReactNode;
  className: string;
};

export function VerticalScrollList({ ariaLabel, children, className }: VerticalScrollListProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLOListElement>) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    event.currentTarget.scrollBy({
      top: event.key === "ArrowDown" ? event.currentTarget.clientHeight * 0.62 : event.currentTarget.clientHeight * -0.62,
      behavior: "auto",
    });
  };

  return (
    <ol className={className} aria-label={ariaLabel} tabIndex={0} onKeyDown={handleKeyDown}>
      {children}
    </ol>
  );
}
