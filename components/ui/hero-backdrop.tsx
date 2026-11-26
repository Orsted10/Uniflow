"use client";

import * as React from "react";

/**
 * Photographic developer-desk foundation (/images/desk-hero.jpg)
 * with intelligent directional darkening scrims so sunlit desk warmth,
 * plants, books, headphones, and shadows breathe through while keeping
 * typography and frosted glass controls crisp and legible.
 */
export function HeroBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
    >
      {/* Supplied warm sunlit developer desk photograph */}
      <img
        src="/images/desk-hero.jpg"
        alt=""
        className="w-full h-full object-cover object-center scale-[1.01] brightness-[0.82] contrast-[1.06]"
      />

      {/* Left-to-right editorial legibility scrim (keeps center-right sunlit window & desk glowing) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(95deg, rgba(11,10,9,0.88) 0%, rgba(11,10,9,0.62) 42%, rgba(11,10,9,0.28) 72%, rgba(11,10,9,0.45) 100%)",
        }}
      />

      {/* Top & bottom atmospheric vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(9,8,7,0.72) 0%, rgba(9,8,7,0.12) 22%, rgba(9,8,7,0.18) 65%, rgba(9,8,7,0.88) 100%)",
        }}
      />
    </div>
  );
}
