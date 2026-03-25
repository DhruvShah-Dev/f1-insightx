import { getTeamAsset, type TeamAsset } from "@/lib/ui/asset-manifest";

export type TeamMeta = Pick<TeamAsset, "id" | "label" | "shortLabel" | "primary" | "secondary" | "accent">;

export function getTeamMeta(teamId: string | null | undefined): TeamMeta {
  return getTeamAsset(teamId);
}
