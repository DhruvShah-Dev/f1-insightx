"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame } from "@/components/charts/chart-frame";

type Lineup = {
  style: "safe" | "balanced" | "aggressive";
  drivers: Array<{
    id: string;
    name: string;
    price: number;
    projectedScore: number;
    valueScore: number;
  }>;
  constructors: Array<{
    id: string;
    name: string;
    price: number;
    projectedScore: number;
    valueScore: number;
  }>;
  captainId: string;
  totalPrice: number;
  expectedScore: number;
};

type Props = {
  primary: Lineup;
  alternatives: Lineup[];
};

const pieColors = ["#ff5a36", "#ff8a6d", "#ffb8a8", "#ffd5cb", "#ffe8e0", "#b7bec9", "#8d97a5"];

export function FantasyCharts({ primary, alternatives }: Props) {
  const budgetSplit = [
    ...primary.drivers.map((driver) => ({
      name: driver.name.split(" ").slice(-1)[0],
      value: driver.price,
    })),
    ...primary.constructors.map((constructor) => ({
      name: constructor.name,
      value: constructor.price,
    })),
  ];

  const lineupComparison = [primary, ...alternatives].map((lineup) => ({
    style: lineup.style,
    expected: lineup.expectedScore,
    budget: lineup.totalPrice,
  }));

  return (
    <div className="chart-grid">
      <ChartFrame
        title="Budget allocation"
        subtitle="How the primary lineup spends budget across drivers and constructors."
      >
        <PieChart>
          <Pie data={budgetSplit} dataKey="value" nameKey="name" innerRadius={54} outerRadius={88} paddingAngle={2}>
            {budgetSplit.map((entry, index) => (
              <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
            }}
            labelStyle={{ color: "var(--text-primary)" }}
          />
        </PieChart>
      </ChartFrame>

      <ChartFrame
        title="Lineup style comparison"
        subtitle="Expected score versus total spend for each recommendation style."
        dark
      >
        <BarChart data={lineupComparison} margin={{ left: -16, right: 8, top: 8 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="style" tickLine={false} axisLine={false} fontSize={11} stroke="var(--chart-axis)" />
          <YAxis tickLine={false} axisLine={false} width={32} stroke="var(--chart-axis)" />
          <Tooltip
            contentStyle={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
            }}
            labelStyle={{ color: "var(--text-primary)" }}
          />
          <Bar dataKey="expected" radius={[3, 3, 0, 0]}>
            {lineupComparison.map((entry) => (
              <Cell
                key={entry.style}
                fill={entry.style === primary.style ? "#ff5a36" : "rgba(255,255,255,0.4)"}
              />
            ))}
          </Bar>
          <Bar dataKey="budget" fill="rgba(255,255,255,0.42)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartFrame>
    </div>
  );
}
