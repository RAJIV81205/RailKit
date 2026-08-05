"use client";

import { useEffect, useRef, useState } from "react";

const SOURCE_WIDTH = 192;
const SOURCE_HEIGHT = 208;
const DISPLAY_WIDTH = 96;
const DISPLAY_HEIGHT = 104;
const CURSOR_OFFSET = 18;
const IDLE_DELAY_MS = 360;
const WAITING_DELAY_MS = 1800;

const STATES = {
  idle: { row: 0, frames: 6 },
  right: { row: 1, frames: 8 },
  left: { row: 2, frames: 8 },
  waiting: { row: 6, frames: 6 },
} as const;

type StateId = keyof typeof STATES;

function clampPoint(clientX: number, clientY: number) {
  return {
    x: Math.min(
      Math.max(CURSOR_OFFSET, clientX + CURSOR_OFFSET),
      Math.max(CURSOR_OFFSET, window.innerWidth - DISPLAY_WIDTH - CURSOR_OFFSET),
    ),
    y: Math.min(
      Math.max(CURSOR_OFFSET, clientY + CURSOR_OFFSET),
      Math.max(CURSOR_OFFSET, window.innerHeight - DISPLAY_HEIGHT - CURSOR_OFFSET),
    ),
  };
}

export function MoochiFollower() {
  const [enabled, setEnabled] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const spriteRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const pointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!pointerQuery.matches || motionQuery.matches) return;

    // Cursor pet is decorative. Keep its 1.7 MB sprite off touch devices and
    // out of the critical loading window on desktop.
    const timer = window.setTimeout(() => setEnabled(true), 2000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const shell = shellRef.current;
    const sprite = spriteRef.current;
    const pointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!shell || !sprite || !pointerQuery.matches) return;

    let stateId: StateId = "idle";
    let lastX: number | null = null;
    let idleTimer: number | null = null;
    let waitingTimer: number | null = null;
    let rafId: number | null = null;

    const setPoint = (clientX: number, clientY: number) => {
      const point = clampPoint(clientX, clientY);
      shell.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
    };

    const resetTimers = () => {
      if (idleTimer !== null) window.clearTimeout(idleTimer);
      if (waitingTimer !== null) window.clearTimeout(waitingTimer);

      idleTimer = window.setTimeout(() => {
        stateId = "idle";
      }, IDLE_DELAY_MS);
      waitingTimer = window.setTimeout(() => {
        stateId = "waiting";
      }, WAITING_DELAY_MS);
    };

    const onPointerMove = (event: PointerEvent) => {
      setPoint(event.clientX, event.clientY);

      if (lastX !== null) {
        const deltaX = event.clientX - lastX;
        if (Math.abs(deltaX) >= 2) {
          stateId = deltaX > 0 ? "right" : "left";
        }
      }

      lastX = event.clientX;
      resetTimers();
    };

    const animate = (time: number) => {
      const state = STATES[stateId];
      const frame = motionQuery.matches ? 0 : Math.floor(time / 130) % state.frames;
      sprite.style.backgroundPosition = `-${frame * SOURCE_WIDTH}px -${state.row * SOURCE_HEIGHT}px`;
      rafId = window.requestAnimationFrame(animate);
    };

    setPoint(window.innerWidth / 2, window.innerHeight / 2);
    shell.style.opacity = "1";
    resetTimers();
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    rafId = window.requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      if (idleTimer !== null) window.clearTimeout(idleTimer);
      if (waitingTimer !== null) window.clearTimeout(waitingTimer);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      aria-hidden="true"
      ref={shellRef}
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: DISPLAY_WIDTH,
        height: DISPLAY_HEIGHT,
        overflow: "hidden",
        zIndex: 80,
        pointerEvents: "none",
        opacity: 0,
        willChange: "transform",
        filter: "drop-shadow(0 12px 20px rgba(15, 15, 14, 0.18))",
      }}
    >
      <div
        ref={spriteRef}
        style={{
          width: SOURCE_WIDTH,
          height: SOURCE_HEIGHT,
          backgroundImage: "url('/pets/moochi/spritesheet.webp')",
          backgroundRepeat: "no-repeat",
          backgroundSize: "1536px 1872px",
          imageRendering: "pixelated",
          transform: "scale(0.5)",
          transformOrigin: "top left",
          willChange: "background-position",
        }}
      />
    </div>
  );
}
