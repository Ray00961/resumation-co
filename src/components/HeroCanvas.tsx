/**
 * HeroCanvas — Neural-network particle animation
 *
 * Renders a Canvas 2D particle system using the platform's exact design tokens:
 *   Sapphire  rgb(60, 80, 125)   — 60% of nodes
 *   Cyan      rgb(18, 178, 193)  — 30% of nodes  (active AI processing)
 *   Gold      rgb(224, 197, 143) — 10% of nodes  (key signal / premium accent)
 *
 * Features:
 *   • Weighted particle distribution (sapphire-dominant like the UI)
 *   • Connection lines that brighten when a cyan node is involved
 *   • Radial halo glow on cyan & gold particles
 *   • Smooth pulsing via per-particle phase offset
 *   • ResizeObserver for pixel-perfect DPR scaling
 *   • Stops animation when prefers-reduced-motion is set
 */

import { useEffect, useRef } from "react";

/* ── design token colours ──────────────────────────────────────────────── */
const C = {
  0: [60,  80,  125] as const,   // sapphire
  1: [18,  178, 193] as const,   // cyan
  2: [224, 197, 143] as const,   // gold
} as const;
type CT = keyof typeof C;

const rgba = ([r, g, b]: readonly [number, number, number], a: number) =>
  `rgba(${r},${g},${b},${Math.min(1, a).toFixed(3)})`;

/* ── particle ──────────────────────────────────────────────────────────── */
interface Pt {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  t: CT;          // colour type
  ph: number;     // phase
  ps: number;     // phase speed
}

/* ── main component ────────────────────────────────────────────────────── */
export default function HeroCanvas({ className = "" }: { className?: string }) {
  const cvs = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = cvs.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let W = 0, H = 0;
    let pts: Pt[] = [];

    /* Particle type: weighted random */
    const mkT = (): CT => {
      const n = Math.random();
      return (n < 0.60 ? 0 : n < 0.90 ? 1 : 2) as CT;
    };

    /* (Re)initialise canvas size + particle set */
    const init = () => {
      const dpr = window.devicePixelRatio || 1;
      W = el.offsetWidth;
      H = el.offsetHeight;
      el.width  = W * dpr;
      el.height = H * dpr;
      el.style.width  = `${W}px`;
      el.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      /* Scale particle count with canvas area; clamp for perf */
      const n = Math.min(44, Math.max(16, Math.round((W * H) / 12_500)));
      pts = Array.from({ length: n }, (_, i): Pt => {
        const t = mkT();
        return {
          x:  Math.random() * W,
          y:  Math.random() * H,
          vx: (Math.random() - 0.5) * 0.38,
          vy: (Math.random() - 0.5) * 0.38,
          r:  t === 1 ? Math.random() * 1.6 + 2.2   // cyan slightly bigger
                      : Math.random() * 1.4 + 1.6,
          t,
          ph: (i / n) * Math.PI * 2,   // evenly distribute phase start
          ps: 0.009 + Math.random() * 0.011,
        };
      });
    };

    /* Draw one frame */
    const frame = () => {
      ctx.clearRect(0, 0, W, H);

      /* ── connections ────────────────────────────────────────────── */
      const LINK = 145;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 >= LINK * LINK) continue;
          const t = 1 - Math.sqrt(d2) / LINK;       // 0 → 1 as closer
          const cyan = a.t === 1 || b.t === 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = cyan
            ? rgba(C[1], t * 0.34)
            : rgba(C[0], t * 0.17);
          ctx.lineWidth = cyan ? 0.85 : 0.55;
          ctx.stroke();
        }
      }

      /* ── particles ──────────────────────────────────────────────── */
      for (const p of pts) {
        /* move */
        if (!reduced) {
          p.x += p.vx; p.y += p.vy; p.ph += p.ps;
          if (p.x < 0) { p.x = 0; p.vx *= -1; }
          if (p.x > W) { p.x = W; p.vx *= -1; }
          if (p.y < 0) { p.y = 0; p.vy *= -1; }
          if (p.y > H) { p.y = H; p.vy *= -1; }
        }

        const pulse = 0.5 + 0.5 * Math.sin(p.ph);   // 0 → 1

        /* halo (cyan + gold only) */
        if (p.t !== 0) {
          const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5.5);
          const ha  = (p.t === 1 ? 0.24 : 0.16) * pulse;
          gr.addColorStop(0, rgba(C[p.t], ha));
          gr.addColorStop(1, rgba(C[p.t], 0));
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 5.5, 0, Math.PI * 2);
          ctx.fillStyle = gr;
          ctx.fill();
        }

        /* core dot */
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 + pulse * 0.14), 0, Math.PI * 2);
        ctx.fillStyle = rgba(
          C[p.t],
          p.t === 0 ? 0.42 + pulse * 0.28 : 0.68 + pulse * 0.28,
        );
        ctx.fill();
      }

      if (!reduced) raf = requestAnimationFrame(frame);
    };

    /* Observe container size */
    const ro = new ResizeObserver(init);
    ro.observe(el);
    init();
    raf = requestAnimationFrame(frame);

    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  return (
    <canvas
      ref={cvs}
      className={`absolute inset-0 w-full h-full ${className}`}
      aria-hidden="true"
    />
  );
}
