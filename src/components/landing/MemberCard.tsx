"use client";

import { useRef, type PointerEvent } from "react";
import s from "./landing.module.css";

// Charge-card hover: the card tilts toward the pointer and a glare follows it. At rest it floats.
export function MemberCard() {
  const ref = useRef<HTMLDivElement>(null);

  function move(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
    el.style.setProperty("--ry", `${(x - 0.5) * 16}deg`);
    el.style.setProperty("--rx", `${(0.5 - y) * 12}deg`);
  }

  function leave() {
    const el = ref.current;
    if (!el) return;
    for (const p of ["--mx", "--my", "--rx", "--ry"]) el.style.removeProperty(p);
  }

  return (
    <div className={s.cardStage}>
      <div
        ref={ref}
        className={s.card}
        onPointerMove={move}
        onPointerLeave={leave}
        role="img"
        aria-label="A player's card for the 5th category draw, confirmed by the club"
      >
        <div className={s.cardRow}>
          <span className={s.cardClub}>Meridian Court</span>
          <span className={s.cardM}>M</span>
        </div>
        <div className={s.cardMid}>
          <span className={s.cardCat}>5th category</span>
        </div>
        <div className={s.cardFoot}>
          <span>Summer Invitational</span>
          <span>Confirmed</span>
        </div>
      </div>
    </div>
  );
}
