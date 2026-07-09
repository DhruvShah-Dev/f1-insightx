"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

const STARTING_LIGHT_COUNT = 5;

export function MainPageBackground() {
  const backgroundRef = useRef<HTMLDivElement>(null);
  const [activeLights, setActiveLights] = useState(1);

  useEffect(() => {
    const element = backgroundRef.current;
    if (!element) {
      return;
    }

    let frame = 0;

    const updateProgress = () => {
      frame = 0;
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;
      const clampedProgress = Math.min(Math.max(progress, 0), 1);
      const nextActiveLights = Math.min(STARTING_LIGHT_COUNT, Math.max(1, Math.floor(clampedProgress * STARTING_LIGHT_COUNT) + 1));

      element.style.setProperty("--page-scroll-progress", clampedProgress.toFixed(4));
      element.style.setProperty("--lights-progress", clampedProgress.toFixed(4));
      element.style.setProperty("--active-lights", String(nextActiveLights));
      setActiveLights((current) => (current === nextActiveLights ? current : nextActiveLights));
    };

    const scheduleUpdate = () => {
      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(updateProgress);
    };

    updateProgress();

    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }

      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, []);

  return (
    <div ref={backgroundRef} className="main-page-background" aria-hidden="true">
      <div className="start-lights-background">
        <div className="start-lights-background__rig">
          <div className="start-lights-background__frame" />
          <div className="start-lights-background__rail">
            {Array.from({ length: STARTING_LIGHT_COUNT }, (_, index) => (
              <span
                key={index}
                className={`start-light ${index < activeLights ? "start-light--active" : ""}`}
                style={{ "--light-index": index } as CSSProperties}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
