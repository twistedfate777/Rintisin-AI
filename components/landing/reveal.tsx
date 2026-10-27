"use client";

import { useEffect } from "react";

/**
 * Section entrances: the parts of each section arrive in reading order, once, as the section
 * enters. Mounted once for the whole page. If IntersectionObserver is missing the parts are shown
 * immediately, and if this component never runs at all the CSS keeps everything visible, because
 * the hidden state is gated on html.js.
 */
export function Reveal() {
  useEffect(() => {
    const parts = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (parts.length === 0) return;
    if (!("IntersectionObserver" in window)) {
      parts.forEach((part) => part.classList.add("is-in"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.1 }
    );
    parts.forEach((part) => observer.observe(part));
    return () => observer.disconnect();
  }, []);

  return null;
}
