"use client";

import { useEffect } from "react";

export function HomeScrollReveal() {
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-home-reveal]"));
    if (sections.length === 0) {
      return () => {
        document.documentElement.classList.remove("home-reveal-ready");
      };
    }

    const markVisibleInViewport = () => {
      const viewportThreshold = window.innerHeight * 0.92;
      sections.forEach((section) => {
        const bounds = section.getBoundingClientRect();
        if (bounds.top <= viewportThreshold && bounds.bottom >= 0) {
          section.classList.add("is-visible");
        }
      });
    };

    markVisibleInViewport();
    window.requestAnimationFrame(() => {
      document.documentElement.classList.add("home-reveal-ready");
    });

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      sections.forEach((section) => section.classList.add("is-visible"));
      return () => {
        document.documentElement.classList.remove("home-reveal-ready");
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      {
        rootMargin: "0px 0px -12% 0px",
        threshold: 0.14,
      },
    );

    sections.forEach((section) => observer.observe(section));

    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("home-reveal-ready");
    };
  }, []);

  return null;
}
