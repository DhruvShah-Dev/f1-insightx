"use client";

import type { ReactNode } from "react";
import { ResponsiveContainer } from "recharts";

type ChartFrameProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  dark?: boolean;
};

export function ChartFrame({ title, subtitle, children, dark = false }: ChartFrameProps) {
  return (
    <section className={`chart-frame ${dark ? "chart-frame--dark" : ""}`}>
      <div className="chart-frame__header">
        <p className="chart-frame__title">{title}</p>
        <p className="chart-frame__subtitle">{subtitle}</p>
      </div>
      <div className="chart-frame__body">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
          {children}
        </ResponsiveContainer>
      </div>
    </section>
  );
}
