"use client";

import * as React from "react";

/**
 * Energetic, colorful 60fps HTML5 Canvas constellation mesh + vibrant mint/indigo/coral aurora.
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

    const palette = [
      "45, 212, 191",  // Mint Teal
      "129, 140, 248", // Electric Indigo
      "56, 189, 248",  // Sky Cyan
      "244, 114, 182", // Vibrant Rose-Pink
    ];

    const nodeCount = Math.min(54, Math.max(30, Math.floor(width / 28)));
    const nodes = Array.from({ length: nodeCount }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      r: Math.random() * 1.8 + 1.2,
      color: palette[i % palette.length],
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;

        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;

        if (mouse.active) {
          const dx = mouse.x - n.x;
          const dy = mouse.y - n.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 240 && dist > 1) {
            n.x += (dx / dist) * 0.24;
            n.y += (dy / dist) * 0.24;
          }
        }

        for (let j = i + 1; j < nodes.length; j++) {
          const m = nodes[j];
          const dist = Math.hypot(n.x - m.x, n.y - m.y);
          if (dist < 180) {
            const alpha = (1 - dist / 180) * 0.28;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(m.x, m.y);
            ctx.strokeStyle = `rgba(${n.color}, ${alpha})`;
            ctx.lineWidth = 0.95;
            ctx.stroke();
          }
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${n.color}, 0.72)`;
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
      {/* Vibrant Multi-Hue Aurora Volumetric Glows */}
      <div
        className="animate-float-slow absolute -top-28 left-[8%] w-[820px] h-[520px] rounded-full opacity-60 blur-[130px]"
        style={{
          background:
            "radial-gradient(circle, rgba(45,212,191,0.34) 0%, rgba(56,189,248,0.22) 45%, transparent 72%)",
        }}
      />
      <div
        className="animate-float-reverse absolute top-[10%] right-[-4%] w-[760px] h-[560px] rounded-full opacity-55 blur-[135px]"
        style={{
          background:
            "radial-gradient(circle, rgba(129,140,248,0.34) 0%, rgba(244,114,182,0.2) 50%, transparent 72%)",
        }}
      />
      <div
        className="animate-float-slow absolute bottom-[-12%] left-[36%] w-[640px] h-[420px] rounded-full opacity-40 blur-[130px]"
        style={{
          background:
            "radial-gradient(circle, rgba(251,146,60,0.22) 0%, rgba(45,212,191,0.16) 55%, transparent 75%)",
        }}
      />

      {/* Interactive 60fps Colorful Mesh */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-90" />

      {/* Smooth bottom blend into cosmic obsidian */}
      <div
        className="absolute inset-x-0 bottom-0 h-32"
        style={{
          background: "linear-gradient(to bottom, transparent, #07080f 95%)",
        }}
      />
    </div>
  );
}
