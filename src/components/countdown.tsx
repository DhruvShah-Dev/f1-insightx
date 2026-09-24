import { useEffect, useState } from "react";

function diff(targetISO: string) {
  const ms = new Date(targetISO).getTime() - Date.now();
  const clamped = Math.max(ms, 0);
  return {
    days: Math.floor(clamped / 86400000),
    hours: Math.floor((clamped / 3600000) % 24),
    mins: Math.floor((clamped / 60000) % 60),
    secs: Math.floor((clamped / 1000) % 60),
    done: ms <= 0,
  };
}

export function Countdown({
  targetISO,
  label,
  compact = false,
  variant = "default",
}: {
  targetISO: string;
  label: string;
  compact?: boolean;
  variant?: "default" | "hero";
}) {
  const [t, setT] = useState<ReturnType<typeof diff> | null>(null);

  useEffect(() => {
    setT(diff(targetISO));
    const id = setInterval(() => setT(diff(targetISO)), 1000);
    return () => clearInterval(id);
  }, [targetISO]);

  const units = [
    { v: t?.days, u: "days" },
    { v: t?.hours, u: "hrs" },
    { v: t?.mins, u: "min" },
    { v: t?.secs, u: "sec" },
  ];

  if (variant === "hero") {
    return (
      <div className="w-full border border-white/16 bg-[#050608]">
        <div className="flex items-center justify-between gap-3 border-b border-white/12 px-4 py-3">
          <p className="num text-[10px] font-black uppercase tracking-[0.22em] text-white/48">
            {t?.done ? "Session underway" : label}
          </p>
          <p className="num text-[10px] font-black uppercase tracking-[0.22em] text-[#6fffe0]">
            Race clock
          </p>
        </div>
        <div className="grid grid-cols-4">
          {units.map((unit, i) => (
            <div
              key={unit.u}
              className="min-w-0 border-r border-white/12 px-3 py-4 last:border-r-0"
            >
              <span
                className={`num block text-3xl font-black leading-none sm:text-4xl ${
                  i === units.length - 1 ? "text-[#00d6ff]" : "text-white"
                }`}
              >
                {unit.v == null ? "--" : String(unit.v).padStart(2, "0")}
              </span>
              <span className="num mt-2 block text-[10px] font-black uppercase tracking-widest text-white/46">
                {unit.u}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="label-xs">{t?.done ? "Session underway" : label}</p>
      <div className={compact ? "mt-1 flex gap-2" : "mt-2 flex gap-2"}>
        {units.map((unit, i) => (
          <div
            key={unit.u}
            className="flex min-w-11 flex-col items-center rounded-md border border-border bg-background/70 px-2 py-1"
          >
            <span
              className={`num font-bold ${compact ? "text-lg" : "text-2xl"} ${
                i === units.length - 1 ? "text-primary" : "text-foreground"
              }`}
            >
              {unit.v == null ? "--" : String(unit.v).padStart(2, "0")}
            </span>
            <span className="label-xs">{unit.u}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
