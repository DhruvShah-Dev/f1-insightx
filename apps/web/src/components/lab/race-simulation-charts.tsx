"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RaceSimulationResponse } from "@/lib/server/race-simulator";
import { ChartFrame } from "@/components/charts/chart-frame";
import { getTeamMeta } from "@/lib/ui/team-meta";

type Props = {
  simulation: RaceSimulationResponse;
};

export function RaceSimulationCharts({ simulation }: Props) {
  const comparisonData = simulation.finishingOrder.map((entrant) => ({
    name: entrant.fullName.split(" ").slice(-1)[0],
    grid: entrant.qualifyingPosition,
    finish: entrant.projectedFinish,
    delta: entrant.qualifyingPosition - entrant.projectedFinish,
    fill: getTeamMeta(entrant.constructorId).primary,
  }));

  const podiumData = simulation.finishingOrder.slice(0, 8).map((entrant) => ({
    name: entrant.fullName.split(" ").slice(-1)[0],
    podium: entrant.podiumProbability,
    undercut: entrant.undercutImpact,
    fill: getTeamMeta(entrant.constructorId).primary,
  }));

  return (
    <div className="chart-grid">
      <ChartFrame
        title="Grid vs projected finish"
        subtitle="Positive delta means the scenario expects positions gained."
      >
        <BarChart data={comparisonData} margin={{ left: -16, right: 8, top: 8 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} stroke="var(--chart-axis)" />
          <YAxis reversed allowDecimals={false} tickLine={false} axisLine={false} width={28} stroke="var(--chart-axis)" />
          <Tooltip
            contentStyle={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
            }}
            labelStyle={{ color: "var(--text-primary)" }}
          />
          <Legend wrapperStyle={{ color: "var(--text-secondary)", fontSize: "12px" }} />
          <Bar dataKey="grid" fill="rgba(208, 215, 226, 0.55)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="finish" radius={[3, 3, 0, 0]}>
            {comparisonData.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ChartFrame>

      <ChartFrame
        title="Podium pressure"
        subtitle="Front-runners by podium probability with undercut intensity."
        dark
      >
        <BarChart data={podiumData} margin={{ left: -16, right: 8, top: 8 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} stroke="var(--chart-axis)" />
          <YAxis yAxisId="left" tickLine={false} axisLine={false} width={28} stroke="var(--chart-axis)" />
          <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} width={28} stroke="var(--chart-axis-muted)" />
          <Tooltip
            contentStyle={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
            }}
            labelStyle={{ color: "var(--text-primary)" }}
          />
          <ReferenceLine yAxisId="left" y={50} stroke="rgba(255,255,255,0.28)" />
          <Bar yAxisId="left" dataKey="podium" radius={[3, 3, 0, 0]}>
            {podiumData.map((entry) => (
              <Cell
                key={entry.name}
                fill={entry.podium >= 50 ? entry.fill : "rgba(208, 215, 226, 0.72)"}
              />
            ))}
          </Bar>
          <Bar yAxisId="right" dataKey="undercut" fill="rgba(255,255,255,0.48)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartFrame>
    </div>
  );
}
