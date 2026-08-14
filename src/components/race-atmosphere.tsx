import { useScrollProgress } from "@/hooks/use-scroll-progress";

/** Circuit Zandvoort layout, split into the three timing sectors. */
const SECTORS = [
  {
    id: 1,
    // Start/finish → Tarzan (T1) → T2/T3 → Hugenholtz sweep down to T6
    color: "var(--primary)",
    d: "M530 300 L517 380 C512 420 480 452 435 452 C400 452 385 425 392 400 C400 372 428 360 440 330 C450 300 440 285 442 270 C445 250 460 240 478 244 C495 248 495 262 482 268 C460 272 430 262 396 268 C350 276 320 258 293 257 C262 256 240 268 222 290",
  },
  {
    id: 2,
    // T7 Scheivlak → T8/T9 Mastersbocht loop → T10 Hans Ernst
    color: "var(--chart-3, #4a7cff)",
    d: "M222 290 C190 285 150 275 110 262 C78 250 62 240 68 226 C74 205 96 130 120 100 C140 74 172 76 192 96 C212 116 205 140 226 140 C250 140 262 126 265 138 C268 152 250 172 220 190 C190 208 160 200 137 207",
  },
  {
    id: 3,
    // Long return sweep → T11/T12 → T13/T14 banked Arie Luyendyk → back straight
    color: "var(--caution, #ffcc00)",
    d: "M137 207 C175 222 240 232 300 226 C360 220 410 200 430 175 C436 160 440 140 444 100 C447 60 442 30 452 20 C470 6 560 40 592 62 C610 74 606 100 596 130 C580 180 545 250 530 300",
  },
] as const;

const FULL_LAP = SECTORS.map((s) => s.d).join(" ");

/**
 * Zandvoort circuit outline that rotates as the page scrolls.
 * Purely decorative: sits behind content, ignores pointer events.
 */
export function TrackBackdrop() {
  const progress = useScrollProgress();

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 grid place-items-center overflow-hidden"
      style={{ opacity: 0.75 }}
    >
      <div
        className="h-[min(85vh,85vw)] w-[min(85vh,85vw)]"
        style={{
          transform: `rotate(${progress * 320}deg) scale(${1 + progress * 0.1})`,
          transition: "transform 120ms linear",
        }}
      >
        <svg viewBox="0 0 664 479" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {/* asphalt ribbon */}
            <path
              d={FULL_LAP}
              stroke="color-mix(in oklab, var(--foreground) 8%, transparent)"
              strokeWidth="24"
            />
            {/* sector-coloured racing line */}
            {SECTORS.map((s) => (
              <path
                key={s.id}
                d={s.d}
                stroke={`color-mix(in oklab, ${s.color} 50%, transparent)`}
                strokeWidth="3.5"
              />
            ))}
            {/* sector split markers */}
            <path
              d="M212 302 L234 280"
              stroke="color-mix(in oklab, var(--chart-3, #4a7cff) 60%, transparent)"
              strokeWidth="3"
            />
            <path
              d="M128 219 L146 196"
              stroke="color-mix(in oklab, var(--caution, #ffcc00) 60%, transparent)"
              strokeWidth="3"
            />
            {/* start/finish line */}
            <path
              d="M518 297 L544 301"
              stroke="color-mix(in oklab, var(--foreground) 45%, transparent)"
              strokeWidth="5"
            />
          </g>
          <g
            className="num"
            fill="color-mix(in oklab, var(--foreground) 30%, transparent)"
            fontSize="15"
            fontWeight="700"
          >
            <text x="450" y="420">S1</text>
            <text x="40" y="150">S2</text>
            <text x="612" y="150">S3</text>
          </g>
        </svg>
      </div>
    </div>
  );
}


const LIGHT_COUNT = 5;

function LightColumn({ lit }: { lit: number }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/70 bg-background/70 p-1.5 backdrop-blur">
      {Array.from({ length: LIGHT_COUNT }).map((_, i) => {
        const on = i < lit;
        return (
          <span
            key={i}
            className="size-2.5 rounded-full transition-all duration-300 sm:size-3"
            style={{
              backgroundColor: on ? "var(--primary)" : "var(--grid)",
              boxShadow: on ? "0 0 10px 2px color-mix(in oklab, var(--primary) 55%, transparent)" : "none",
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Start-light gantries pinned to both edges. One light is lit at the top of the
 * page; all five are lit by the bottom.
 */
export function StartLightRails() {
  const progress = useScrollProgress();
  const lit = Math.min(LIGHT_COUNT, 1 + Math.floor(progress * LIGHT_COUNT * 0.999));

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-y-0 left-0 right-0 z-30 hidden lg:block"
    >
      <div className="absolute left-0 top-1/2 -translate-y-1/2">
        <LightColumn lit={lit} />
      </div>
      {/* right rail hugs the scrollbar edge */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2">
        <LightColumn lit={lit} />
      </div>
    </div>
  );
}

/** Red / white / blue Dutch flag rule with an orange hairline. */
export function DutchFlagRule({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`overflow-hidden rounded-full ${className}`}>
      <div className="h-1 w-full" style={{ background: "var(--flag-nl)" }} />
    </div>
  );
}
