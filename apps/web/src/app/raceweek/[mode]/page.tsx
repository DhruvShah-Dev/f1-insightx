import { notFound } from "next/navigation";
import { RaceWeekView } from "../race-week-view";
import type { RaceWeekPredictionModeId } from "@/lib/server/race-week-product";
import { makeMetadata } from "@/lib/seo";

export const revalidate = 900;
export const dynamicParams = false;

const practiceModes: RaceWeekPredictionModeId[] = ["fp1", "fp2", "fp3"];

const modeLabel: Record<string, string> = { fp1: "FP1", fp2: "FP2", fp3: "FP3" };

export function generateStaticParams() {
  return practiceModes.map((mode) => ({ mode }));
}

export async function generateMetadata({ params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;
  const label = modeLabel[mode] ?? mode.toUpperCase();
  return makeMetadata({
    title: `Race Week after ${label}`,
    description: `Formula 1 race week read updated with ${label} practice signals: qualifying projections, weather risk, session readiness, and signal quality.`,
    path: `/raceweek/${mode}`,
    keywords: ["F1 race week", "Formula 1 practice analysis", `F1 ${label} analysis`],
  });
}

export default async function RaceWeekModePage({ params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;
  if (!practiceModes.includes(mode as RaceWeekPredictionModeId)) {
    notFound();
  }
  return <RaceWeekView mode={mode as RaceWeekPredictionModeId} />;
}
