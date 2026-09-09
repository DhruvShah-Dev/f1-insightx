import type { ReactNode } from "react";

const DEFAULT_FLAG = ["#008c45", "#ffffff", "#cd212a"] as const;

type HeroStat = {
  label: string;
  value: ReactNode;
  note?: ReactNode;
};

export function RaceFlagHero({
  kicker,
  title,
  meta,
  stats,
  children,
  className,
  flag = DEFAULT_FLAG,
}: {
  kicker: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  stats?: HeroStat[];
  children?: ReactNode;
  className?: string;
  flag?: readonly string[];
}) {
  const start = flag[0] ?? DEFAULT_FLAG[0];
  const middle = flag[1] ?? DEFAULT_FLAG[1];
  const end = flag.at(-1) ?? DEFAULT_FLAG[2];
  const accent = middle.toLowerCase() === "#ffffff" ? end : middle;

  return (
    <section
      className={`home-section-enter relative overflow-hidden rounded-lg border border-white/12 bg-[#070b10] text-white shadow-[0_18px_80px_rgba(0,0,0,0.28)] ${className ?? ""}`}
      style={{
        backgroundImage: `linear-gradient(135deg, #070b10 0%, #111827 54%, ${start} 145%)`,
      }}
    >
      <div aria-hidden className="absolute inset-0 opacity-45">
        <div
          className="absolute -right-16 top-0 h-full w-1/2 skew-x-[-12deg]"
          style={{
            background: `linear-gradient(90deg, transparent, ${start} 34%, ${end})`,
          }}
        />
      </div>
      <div aria-hidden className="absolute inset-x-0 top-0 z-10 flex h-2">
        {flag.map((color, index) => (
          <span key={`${color}-${index}`} className="flex-1" style={{ backgroundColor: color }} />
        ))}
      </div>

      <div className="relative p-5 pt-7 sm:p-7 lg:p-9">
        <div
          className="inline-flex items-center gap-2 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-[#07110c]"
          style={{ backgroundColor: accent }}
        >
          {kicker}
        </div>
        <h1 className="mt-5 max-w-4xl text-4xl font-black uppercase italic leading-[0.95] tracking-tight text-white [text-shadow:0_12px_34px_rgba(0,0,0,0.42)] sm:text-6xl">
          {title}
        </h1>
        {meta ? (
          <p className="num mt-3 max-w-[34rem] text-xs font-bold uppercase tracking-wide text-white/76">
            {meta}
          </p>
        ) : null}
        {stats?.length ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={String(stat.label)}
                className="min-h-[76px] rounded-lg border border-white/14 bg-black/42 p-3 text-white backdrop-blur"
              >
                <p className="label-xs text-white/65">{stat.label}</p>
                <p className="num mt-1 text-2xl font-black">{stat.value}</p>
                {stat.note ? <p className="mt-1 text-[11px] text-white/68">{stat.note}</p> : null}
              </div>
            ))}
          </div>
        ) : null}
        {children ? <div className="mt-6">{children}</div> : null}
      </div>
    </section>
  );
}
