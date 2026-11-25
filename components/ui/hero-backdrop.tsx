"use client";

import * as React from "react";

/**
 * Luminous, animated architectural backdrop with warm champagne, emerald-sage,
 * and amber volumetric depth + interactive cursor spotlight.
 */
export function HeroBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
    >
      {/* Animated volumetric aurora orbs */}
      <div
        className="animate-float-slow absolute -top-28 left-[12%] w-[820px] h-[540px] rounded-full opacity-55 blur-[130px]"
        style={{
          background:
            "radial-gradient(circle, rgba(243,215,170,0.28) 0%, rgba(16,185,129,0.22) 45%, transparent 72%)",
        }}
      />
      <div
        className="animate-float-reverse absolute top-[18%] right-[-6%] w-[720px] h-[560px] rounded-full opacity-50 blur-[140px]"
        style={{
          background:
            "radial-gradient(circle, rgba(52,211,153,0.24) 0%, rgba(217,170,110,0.18) 48%, transparent 72%)",
        }}
      />
      <div
        className="animate-float-slow absolute bottom-[-10%] left-[38%] w-[640px] h-[420px] rounded-full opacity-35 blur-[130px]"
        style={{
          background:
            "radial-gradient(circle, rgba(245,158,11,0.16) 0%, rgba(16,185,129,0.14) 55%, transparent 75%)",
        }}
      />

      {/* Fine architectural perspective grid */}
      <div
        className="absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,244,224,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,244,224,0.06) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 80% 65% at 50% 35%, black 30%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 65% at 50% 35%, black 30%, transparent 100%)",
        }}
      />

      {/* Sculpted Luminous Vector Ribbons */}
      <svg
        viewBox="0 0 1440 900"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 w-full h-full object-cover opacity-80"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="ribbonChampagne" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde6c4" stopOpacity="0.45" />
            <stop offset="45%" stopColor="#34d399" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#090807" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="ribbonEmerald" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#f3e7d3" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#090807" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path
          d="M 420 -100 C 580 180, 260 520, 640 780 C 860 930, 1240 680, 1480 340"
          stroke="url(#ribbonChampagne)"
          strokeWidth="92"
          strokeLinecap="round"
        />
        <path
          d="M 420 -100 C 580 180, 260 520, 640 780 C 860 930, 1240 680, 1480 340"
          stroke="rgba(253,230,196,0.28)"
          strokeWidth="1.5"
        />

        <path
          d="M 980 -80 C 680 150, 760 500, 400 740 C 180 885, -40 760, -140 580"
          stroke="url(#ribbonEmerald)"
          strokeWidth="66"
          strokeLinecap="round"
        />
        <path
          d="M 980 -80 C 680 150, 760 500, 400 740 C 180 885, -40 760, -140 580"
          stroke="rgba(52,211,153,0.22)"
          strokeWidth="1.2"
        />
      </svg>

      {/* Smooth bottom blend into obsidian ground */}
      <div
        className="absolute inset-x-0 bottom-0 h-32"
        style={{
          background: "linear-gradient(to bottom, transparent, #090807 95%)",
        }}
      />
    </div>
  );
}
