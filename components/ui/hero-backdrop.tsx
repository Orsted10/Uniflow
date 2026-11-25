"use client";

import * as React from "react";

/**
 * Interactive 60fps HTML5 Canvas contract-mesh + warm champagne & emerald aurora backdrop.
 * Nodes drift organically and connect with luminous filaments that respond subtly to cursor proximity.
 */
export function HeroBackdrop() {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = Math.max(760, window.innerHeight * 0.92));
    const mouse = { x: width * 0.65, y: height * 0.4, active: false };

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = Math.max(760, window.innerHeight * 0.92);
    };

    const onMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMouseMove);

    const nodeCount = Math.min(46, Math.max(26, Math.floor(width / 34)));
    const nodes = Array.from({ length: nodeCount }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.6 + 1.1,
      isEmerald: i % 3 === 0,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;

        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;

        // Subtle cursor gravitational pull
        if (mouse.active) {
          const dx = mouse.x - n.x;
          const dy = mouse.y - n.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 220 && dist > 1) {
            n.x += (dx / dist) * 0.18;
            n.y += (dy / dist) * 0.18;
          }
        }

        // Draw connections
        for (let j = i + 1; j < nodes.length; j++) {
          const m = nodes[j];
          const dist = Math.hypot(n.x - m.x, n.y - m.y);
          if (dist < 175) {
            const alpha = (1 - dist / 175) * 0.22;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(m.x, m.y);
            ctx.strokeStyle =
              n.isEmerald || m.isEmerald
                ? `rgba(52, 211, 153, ${alpha})`
                : `rgba(243, 223, 184, ${alpha})`;
            ctx.lineWidth = 0.85;
            ctx.stroke();
          }
        }

        // Draw node glow
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.isEmerald
          ? "rgba(52, 211, 153, 0.55)"
          : "rgba(245, 223, 184, 0.55)";
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
    >
      {/* Animated volumetric aurora orbs */}
      <div
        className="animate-float-slow absolute -top-28 left-[10%] w-[860px] h-[540px] rounded-full opacity-60 blur-[135px]"
        style={{
          background:
            "radial-gradient(circle, rgba(243,215,170,0.3) 0%, rgba(16,185,129,0.22) 45%, transparent 72%)",
        }}
      />
      <div
        className="animate-float-reverse absolute top-[15%] right-[-6%] w-[760px] h-[580px] rounded-full opacity-55 blur-[140px]"
        style={{
          background:
            "radial-gradient(circle, rgba(52,211,153,0.26) 0%, rgba(217,170,110,0.2) 48%, transparent 72%)",
        }}
      />

      {/* Interactive 60fps Contract Graph Mesh */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-85" />

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
