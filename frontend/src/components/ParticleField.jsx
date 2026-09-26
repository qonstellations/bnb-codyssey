import { useEffect, useRef } from "react";

const COLORS = ["#4285F4", "#EA4335", "#FBBC04", "#34A853"];
const SPACING = 46; // px between grid dashes
const RADIUS = 180; // cursor influence radius
const PUSH = 28; // max displacement in px

// Antigravity-style field: jittered grid of short colored dashes that turn
// toward the cursor and drift away from it, easing back when it leaves.
export default function ParticleField() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mouse = { x: -9999, y: -9999 };
    let dots = [];
    let raf = 0;

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = [];
      for (let y = SPACING / 2; y < h; y += SPACING) {
        for (let x = SPACING / 2; x < w; x += SPACING) {
          const bx = x + (Math.random() - 0.5) * SPACING * 0.7;
          const by = y + (Math.random() - 0.5) * SPACING * 0.7;
          dots.push({
            bx, by, x: bx, y: by,
            a: Math.random() * Math.PI, ta: 0,
            c: COLORS[(Math.random() * COLORS.length) | 0],
            o: 0.25 + Math.random() * 0.5,
          });
        }
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      for (const d of dots) {
        const dx = d.bx - mouse.x;
        const dy = d.by - mouse.y;
        const dist = Math.hypot(dx, dy) || 1;
        const f = Math.max(0, 1 - dist / RADIUS);
        const tx = d.bx + (dx / dist) * f * PUSH;
        const ty = d.by + (dy / dist) * f * PUSH;
        d.x += (tx - d.x) * 0.12;
        d.y += (ty - d.y) * 0.12;
        if (f > 0) d.a += (Math.atan2(dy, dx) - d.a) * 0.15 * f;
        const len = 3 + f * 5;
        ctx.globalAlpha = d.o * (0.5 + f);
        ctx.strokeStyle = d.c;
        ctx.beginPath();
        ctx.moveTo(d.x - Math.cos(d.a) * len, d.y - Math.sin(d.a) * len);
        ctx.lineTo(d.x + Math.cos(d.a) * len, d.y + Math.sin(d.a) * len);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };

    const onMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const onLeave = (e) => {
      if (e.relatedTarget) return;
      mouse.x = mouse.y = -9999;
    };
    const onResize = () => {
      build();
      if (reduced) draw();
    };
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced) loop();
    };

    build();
    if (reduced) draw();
    else {
      loop();
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerout", onLeave);
      document.addEventListener("visibilitychange", onVis);
    }
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onLeave);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} className="ag-field" aria-hidden="true" />;
}
