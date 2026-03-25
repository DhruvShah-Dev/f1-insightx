import { getCircuitAsset, type CircuitAsset } from "@/lib/ui/asset-manifest";

export type CircuitMeta = Pick<CircuitAsset, "id" | "countryCode" | "region">;

export function getCircuitMeta(circuitId: string | null | undefined): CircuitMeta {
  return getCircuitAsset(circuitId);
}
