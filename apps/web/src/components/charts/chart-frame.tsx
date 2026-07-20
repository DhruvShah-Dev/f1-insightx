"use client";

import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { ResponsiveContainer } from "recharts";

type ChartFrameProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  dark?: boolean;
};

const emptySubscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function ChartFrame({ title, subtitle, children, dark = false }: ChartFrameProps) {
  const canMeasureLayout = useSyncExternalStore(emptySubscribe, clientSnapshot, serverSnapshot);

  return (
    <section className={`chart-frame ${dark ? "chart-frame--dark" : ""}`}>
      <div className="chart-frame__header">
        <p className="chart-frame__title">{title}</p>
        <p className="chart-frame__subtitle">{subtitle}</p>
      </div>
      <div className="chart-frame__body">
        {canMeasureLayout ? (
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={220}
            initialDimension={{ width: 640, height: 220 }}
          >
            {children}
          </ResponsiveContainer>
        ) : null}
      </div>
    </section>
  );
}
