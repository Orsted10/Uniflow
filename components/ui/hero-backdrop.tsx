"use client";

import * as React from "react";

/**
 * Architectural warm-obsidian & sage-emerald sculpted ribbon backdrop.
 * Renders at 0ms with infinite vector crispness behind the hero.
 */
export function HeroBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
    >
      {/* Warm champagne & sage ambient volumetric glows */}
      <div
        className="absolute -top-32 left-1/4 w-[760px] h-[520px] rounded-full opacity-35 blur-[130px]"
        style={{
          background:
            "radial-gradient(circle, rgba(243,231,211,0.22) 0%, rgba(52,84,68,0.28) 45%, transparent 75%)",
        }}
      />
      <div
        className="absolute top-1/3 right-[-8%] w-[620px] h-[520px] rounded-full opacity-25 blur-[140px]"
        style={{
          background:
            "radial-gradient(circle, rgba(16,185,129,0.22) 0%, rgba(217,196,162,0.12) 50%, transparent 75%)",
        }}
      />

      {/* Sculpted Architectural Curved Ribbons (SVG with metallic gradients) */}
      <svg
        viewBox="0 0 1440 900"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 w-full h-full object-cover opacity-55"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="ribbonGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f3e7d3" stopOpacity="0.42" />
            <stop offset="45%" stopColor="#6c8c78" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#0b0a09" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="ribbonSage" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#8ba896" stopOpacity="0.28" />
            <stop offset="50%" stopColor="#f3e7d3" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#0b0a09" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="infinityGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f3e7d3" stopOpacity="0.55" />
            <stop offset="50%" stopColor="#a7f3d0" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f3e7d3" stopOpacity="0.55" />
          </linearGradient>
        </defs>

        {/* Sweeping architectural arc 1 */}
        <path
          d="M 440 -120 C 560 180, 280 540, 620 820 C 820 980, 1220 740, 1480 420"
          stroke="url(#ribbonGold)"
          strokeWidth="88"
          strokeLinecap="round"
        />
        <path
          d="M 440 -120 C 560 180, 280 540, 620 820 C 820 980, 1220 740, 1480 420"
          stroke="rgba(255,244,224,0.16)"
          strokeWidth="1.5"
        />

        {/* Sweeping architectural arc 2 */}
        <path
          d="M 920 -80 C 660 140, 740 520, 420 760 C 200 920, -40 780, -120 620"
          stroke="url(#ribbonSage)"
          strokeWidth="64"
          strokeLinecap="round"
        />
        <path
          d="M 920 -80 C 660 140, 740 520, 420 760 C 200 920, -40 780, -120 620"
          stroke="rgba(255,244,224,0.1)"
          strokeWidth="1"
        />

        {/* Subtle glowing infinity sculpture on lower-left architectural plinth */}
        <g transform="translate(150, 690) rotate(-6)" opacity="0.5">
          <path
            d="M 35 35 C 35 12, 72 12, 92 35 C 112 58, 149 58, 149 35 C 149 12, 112 12, 92 35 C 72 58, 35 58, 35 35 Z"
            stroke="url(#infinityGlow)"
            strokeWidth="10"
            strokeLinecap="round"
            fill="none"
          />
          <ellipse cx="92" cy="76" rx="86" ry="12" fill="rgba(243,231,211,0.08)" />
        </g>
      </svg>

      {/* Bottom fade into solid obsidian ground */}
      <div
        className="absolute inset-x-0 bottom-0 h-44"
        style={{
          background: "linear-gradient(to bottom, transparent, #0b0a09 92%)",
        }}
      />
    </div>
  );
}
