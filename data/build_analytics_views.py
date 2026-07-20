from __future__ import annotations

import itertools
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent
ROOT_DIR = DATA_DIR.parent
sys.path.insert(0, str(DATA_DIR))

from f1_insightx_data.settings import load_settings


OUTPUT_FILES = {
    "session_index": "analytics_session_index.csv",
    "driver_comparison": "analytics_driver_comparison.csv",
    "segment_comparison": "analytics_segment_comparison.csv",
    "braking_comparison": "analytics_braking_comparison.csv",
    "throttle_comparison": "analytics_throttle_comparison.csv",
    "straight_comparison": "analytics_straight_comparison.csv",
    "energy_proxy_comparison": "analytics_energy_proxy_comparison.csv",
    "lap_pace_driver": "analytics_lap_pace_driver.csv",
    "track_summary": "analytics_track_summary.csv",
}
PROXY_NOTE = "Energy deployment proxy derived from speed/throttle/RPM/gear/DRS features; not true ERS or battery state."
WEAKEST_ASSUMPTION = "Approximate segment IDs from precomputed telemetry features; not manually named corners."
TRAFFIC_PROXY_NOTE = "Traffic and dirty-air values are proxy evidence from race analysis, not exact gap or DRS truth."


def read_csv(path: Path) -> pd.DataFrame:
    if not path.exists() or path.stat().st_size == 0:
        return pd.DataFrame()
    return pd.read_csv(path, low_memory=False)


def write_csv(frame: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False)


def clamp01(value: Any, default: float = 0.5) -> float:
    if value is None or pd.isna(value):
        return default
    return round(max(0.0, min(1.0, float(value))), 6)


def event_slug(value: Any) -> str:
    text = str(value or "").lower()
    return "".join(char if char.isalnum() else "-" for char in text).strip("-")


def session_id_columns(frame: pd.DataFrame) -> pd.DataFrame:
    result = frame.copy()
    result["season"] = pd.to_numeric(result["season"], errors="coerce").astype("Int64")
    result["round"] = pd.to_numeric(result["round"], errors="coerce").astype("Int64")
    result["session_id"] = result.apply(
        lambda row: f"{int(row['season'])}_{int(row['round']):02}_{row['session']}_{row['event']}",
        axis=1,
    )
    result["event_slug"] = result["event"].map(event_slug)
    return result


def generated_metadata() -> tuple[str, str]:
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return generated_at, f"analytics_views_{generated_at.replace('-', '').replace(':', '')}"


def deterministic_pairs(drivers: list[str]) -> list[tuple[str, str]]:
    return list(itertools.combinations(sorted(set(drivers)), 2))


def team_lookup(results: pd.DataFrame) -> dict[tuple[str, str], str]:
    if results.empty:
        return {}
    lookup: dict[tuple[str, str], str] = {}
    for _, row in results.iterrows():
        session_id = str(row.get("session_id") or "")
        driver = str(row.get("abbreviation") or "")
        team = str(row.get("team_name") or "")
        if session_id and driver:
            lookup[(session_id, driver)] = team
    return lookup


def archetype_lookup(archetypes: pd.DataFrame) -> dict[str, dict[str, Any]]:
    lookup: dict[str, dict[str, Any]] = {}
    for _, row in archetypes.iterrows():
        lookup[str(row.get("id") or "")] = row.to_dict()
    return lookup


def resolve_archetype(event: str, archetypes: dict[str, dict[str, Any]]) -> dict[str, Any]:
    slug = event_slug(event)
    if slug in archetypes:
        return archetypes[slug]
    for key, value in archetypes.items():
        if slug[:10] and slug[:10] in key:
            return value
    return {
        "track_archetype": "mixed",
        "straight_line_weight": 0.5,
        "braking_weight": 0.5,
        "traction_weight": 0.5,
        "degradation_weight": 0.5,
        "track_position_weight": 0.5,
        "archetype_confidence": 0.25,
    }


def comparison_confidence(*values: Any) -> float:
    numeric = [float(value) for value in values if value is not None and not pd.isna(value)]
    if not numeric:
        return 0.35
    return clamp01(sum(numeric) / len(numeric), 0.35)


def pairwise_segment(frame: pd.DataFrame, value_columns: list[str], *, segment_kind: str) -> pd.DataFrame:
    if frame.empty:
        return pd.DataFrame()
    keys = ["session_id", "segment_id"]
    base_columns = keys + ["driver", "segmentation_confidence", *value_columns]
    source = frame[base_columns].dropna(subset=["driver", "segment_id"]).copy()
    merged = source.merge(source, on=keys, suffixes=("_a", "_b"))
    merged = merged[merged["driver_a"] < merged["driver_b"]].copy()
    merged["segment_kind"] = segment_kind
    merged["segment_confidence"] = merged[["segmentation_confidence_a", "segmentation_confidence_b"]].mean(axis=1).map(clamp01)
    return merged


def build_session_index(laps: pd.DataFrame, corner: pd.DataFrame, straight: pd.DataFrame, archetypes: dict[str, dict[str, Any]], generated_at: str, build_version: str) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for session_id, group in laps.groupby("session_id"):
        event = str(group["event"].iloc[0])
        track = resolve_archetype(event, archetypes)
        corner_segments = corner[corner["session_id"] == session_id]["segment_id"].nunique() if not corner.empty else 0
        straight_segments = straight[straight["session_id"] == session_id]["segment_id"].nunique() if not straight.empty else 0
        rows.append(
            {
                "session_id": session_id,
                "season": int(group["season"].iloc[0]),
                "round": int(group["round"].iloc[0]),
                "event": event,
                "session": str(group["session"].iloc[0]),
                "driver_count": int(group["driver"].nunique()),
                "segment_count": int(corner_segments + straight_segments),
                "straight_count": int(straight_segments),
                "telemetry_quality_mean": round(float(pd.to_numeric(group["telemetry_quality_score"], errors="coerce").mean()), 6),
                "track_archetype": track.get("track_archetype"),
                "generated_at": generated_at,
                "build_version": build_version,
            }
        )
    return pd.DataFrame(rows).sort_values(["season", "round", "session"])


def build_segment_comparison(corner: pd.DataFrame) -> pd.DataFrame:
    merged = pairwise_segment(corner, ["entry_speed_kph", "apex_speed_kph", "exit_speed_kph", "min_speed_kph"], segment_kind="approximate_segment")
    if merged.empty:
        return pd.DataFrame()
    output = pd.DataFrame(
        {
            "session_id": merged["session_id"],
            "segment_id": merged["segment_id"],
            "segment_kind": merged["segment_kind"],
            "segment_confidence": merged["segment_confidence"],
            "driver_a": merged["driver_a"],
            "driver_b": merged["driver_b"],
            "entry_speed_delta_kph": (merged["entry_speed_kph_a"] - merged["entry_speed_kph_b"]).round(3),
            "apex_speed_delta_kph": (merged["apex_speed_kph_a"] - merged["apex_speed_kph_b"]).round(3),
            "exit_speed_delta_kph": (merged["exit_speed_kph_a"] - merged["exit_speed_kph_b"]).round(3),
            "min_speed_delta_kph": (merged["min_speed_kph_a"] - merged["min_speed_kph_b"]).round(3),
        }
    )
    output["faster_driver"] = output.apply(lambda row: row["driver_a"] if row["apex_speed_delta_kph"] >= 0 else row["driver_b"], axis=1)
    output["confidence"] = output["segment_confidence"].map(lambda value: comparison_confidence(value))
    return output


def build_braking_comparison(braking: pd.DataFrame) -> pd.DataFrame:
    merged = pairwise_segment(braking, ["braking_start_distance_m", "braking_duration_s", "braking_distance_m", "late_brake_score", "brake_intensity_proxy"], segment_kind="approximate_segment")
    if merged.empty:
        return pd.DataFrame()
    output = pd.DataFrame(
        {
            "session_id": merged["session_id"],
            "segment_id": merged["segment_id"],
            "driver_a": merged["driver_a"],
            "driver_b": merged["driver_b"],
            "braking_start_delta_m": (merged["braking_start_distance_m_a"] - merged["braking_start_distance_m_b"]).round(3),
            "braking_duration_delta_s": (merged["braking_duration_s_a"] - merged["braking_duration_s_b"]).round(3),
            "braking_distance_delta_m": (merged["braking_distance_m_a"] - merged["braking_distance_m_b"]).round(3),
            "late_brake_delta": (merged["late_brake_score_a"] - merged["late_brake_score_b"]).round(4),
            "brake_intensity_delta": (merged["brake_intensity_proxy_a"] - merged["brake_intensity_proxy_b"]).round(4),
            "confidence": merged["segment_confidence"].map(lambda value: comparison_confidence(value)),
        }
    )
    output["favorable_driver"] = output.apply(lambda row: row["driver_a"] if row["late_brake_delta"] >= 0 else row["driver_b"], axis=1)
    return output


def build_throttle_comparison(throttle: pd.DataFrame) -> pd.DataFrame:
    merged = pairwise_segment(throttle, ["throttle_pickup_distance_m", "full_throttle_exit_distance_m", "traction_exit_score"], segment_kind="approximate_segment")
    if merged.empty:
        return pd.DataFrame()
    output = pd.DataFrame(
        {
            "session_id": merged["session_id"],
            "segment_id": merged["segment_id"],
            "driver_a": merged["driver_a"],
            "driver_b": merged["driver_b"],
            "throttle_pickup_delta_m": (merged["throttle_pickup_distance_m_a"] - merged["throttle_pickup_distance_m_b"]).round(3),
            "full_throttle_exit_delta_m": (merged["full_throttle_exit_distance_m_a"] - merged["full_throttle_exit_distance_m_b"]).round(3),
            "traction_exit_delta": (merged["traction_exit_score_a"] - merged["traction_exit_score_b"]).round(4),
            "confidence": merged["segment_confidence"].map(lambda value: comparison_confidence(value)),
        }
    )
    output["favorable_driver"] = output.apply(lambda row: row["driver_a"] if row["traction_exit_delta"] >= 0 else row["driver_b"], axis=1)
    return output


def build_straight_comparison(straight: pd.DataFrame) -> pd.DataFrame:
    merged = pairwise_segment(straight, ["entry_speed_kph", "terminal_speed_kph", "acceleration_score", "drs_active_pct", "clipping_proxy_score"], segment_kind="straight")
    if merged.empty:
        return pd.DataFrame()
    output = pd.DataFrame(
        {
            "session_id": merged["session_id"],
            "segment_id": merged["segment_id"],
            "driver_a": merged["driver_a"],
            "driver_b": merged["driver_b"],
            "entry_speed_delta_kph": (merged["entry_speed_kph_a"] - merged["entry_speed_kph_b"]).round(3),
            "terminal_speed_delta_kph": (merged["terminal_speed_kph_a"] - merged["terminal_speed_kph_b"]).round(3),
            "acceleration_delta": (merged["acceleration_score_a"] - merged["acceleration_score_b"]).round(4),
            "drs_active_delta_pct": (merged["drs_active_pct_a"] - merged["drs_active_pct_b"]).round(3),
            "clipping_proxy_delta": (merged["clipping_proxy_score_a"] - merged["clipping_proxy_score_b"]).round(4),
            "confidence": merged["segment_confidence"].map(lambda value: comparison_confidence(value)),
        }
    )
    output["favorable_driver"] = output.apply(lambda row: row["driver_a"] if row["terminal_speed_delta_kph"] >= 0 else row["driver_b"], axis=1)
    return output


def build_energy_comparison(energy: pd.DataFrame) -> pd.DataFrame:
    merged = pairwise_segment(energy.rename(columns={"confidence": "segmentation_confidence"}), ["deployment_proxy_score", "lift_and_coast_score", "clipping_proxy_score", "recovery_zone_score"], segment_kind="straight")
    if merged.empty:
        return pd.DataFrame()
    return pd.DataFrame(
        {
            "session_id": merged["session_id"],
            "segment_id": merged["segment_id"],
            "driver_a": merged["driver_a"],
            "driver_b": merged["driver_b"],
            "deployment_proxy_delta": (merged["deployment_proxy_score_a"] - merged["deployment_proxy_score_b"]).round(4),
            "lift_and_coast_delta": (merged["lift_and_coast_score_a"] - merged["lift_and_coast_score_b"]).round(4),
            "clipping_proxy_delta": (merged["clipping_proxy_score_a"] - merged["clipping_proxy_score_b"]).round(4),
            "recovery_zone_delta": (merged["recovery_zone_score_a"] - merged["recovery_zone_score_b"]).round(4),
            "confidence": merged["segment_confidence"].map(lambda value: comparison_confidence(value)),
            "proxy_note": PROXY_NOTE,
        }
    )


def strategy_relevance(track_archetype: str) -> str:
    return {
        "power-sensitive": "Straight-line edge is most relevant on power-sensitive tracks.",
        "traction-sensitive": "Exit traction advantage matters more on traction-sensitive layouts.",
        "braking-heavy": "Braking advantage may reduce overtaking risk on braking-heavy circuits.",
        "high-degradation": "Tyre-stress and traction signals matter more on high-degradation layouts.",
        "track-position-dominant": "Track-position sensitivity penalizes weak traffic and rejoin profiles.",
    }.get(track_archetype, "Balanced segment strengths matter because no single archetype dominates.")


def build_driver_comparison(
    session_index: pd.DataFrame,
    laps: pd.DataFrame,
    segment: pd.DataFrame,
    braking: pd.DataFrame,
    throttle: pd.DataFrame,
    straight: pd.DataFrame,
    energy: pd.DataFrame,
    teams: dict[tuple[str, str], str],
) -> pd.DataFrame:
    pair_rows: list[dict[str, Any]] = []
    quality = laps.groupby(["session_id", "driver"], dropna=False)["telemetry_quality_score"].mean().reset_index()
    for session_id, group in quality.groupby("session_id"):
        quality_map = dict(zip(group["driver"], group["telemetry_quality_score"]))
        for driver_a, driver_b in deterministic_pairs(group["driver"].dropna().astype(str).tolist()):
            if min(float(quality_map.get(driver_a, 0)), float(quality_map.get(driver_b, 0))) >= 0.35:
                pair_rows.append(
                    {
                        "session_id": session_id,
                        "driver_a": driver_a,
                        "driver_b": driver_b,
                        "driver_a_quality": quality_map.get(driver_a),
                        "driver_b_quality": quality_map.get(driver_b),
                    }
                )
    pairs = pd.DataFrame(pair_rows)
    if pairs.empty:
        return pairs

    keys = ["session_id", "driver_a", "driver_b"]
    if not segment.empty:
        segment_agg = segment.assign(
            corner_advantage_a=(segment["faster_driver"] == segment["driver_a"]).astype(int),
            corner_advantage_b=(segment["faster_driver"] == segment["driver_b"]).astype(int),
        ).groupby(keys).agg(
            corner_advantage_count_a=("corner_advantage_a", "sum"),
            corner_advantage_count_b=("corner_advantage_b", "sum"),
            avg_segment_delta_kph=("apex_speed_delta_kph", "mean"),
            segment_confidence=("confidence", "mean"),
        ).reset_index()
        pairs = pairs.merge(segment_agg, on=keys, how="left")
    if not straight.empty:
        straight_agg = straight.assign(
            straight_advantage_a=(straight["favorable_driver"] == straight["driver_a"]).astype(int),
            straight_advantage_b=(straight["favorable_driver"] == straight["driver_b"]).astype(int),
        ).groupby(keys).agg(
            straight_advantage_count_a=("straight_advantage_a", "sum"),
            straight_advantage_count_b=("straight_advantage_b", "sum"),
            avg_straight_delta_kph=("terminal_speed_delta_kph", "mean"),
            straight_confidence=("confidence", "mean"),
        ).reset_index()
        pairs = pairs.merge(straight_agg, on=keys, how="left")
    if not braking.empty:
        pairs = pairs.merge(braking.groupby(keys).agg(braking_advantage_score=("late_brake_delta", "mean")).reset_index(), on=keys, how="left")
    if not throttle.empty:
        pairs = pairs.merge(throttle.groupby(keys).agg(traction_advantage_score=("traction_exit_delta", "mean")).reset_index(), on=keys, how="left")
    if not energy.empty:
        pairs = pairs.merge(energy.groupby(keys).agg(energy_proxy_delta=("deployment_proxy_delta", "mean")).reset_index(), on=keys, how="left")

    session_track = session_index[["session_id", "track_archetype"]].copy()
    pairs = pairs.merge(session_track, on="session_id", how="left")
    pairs["driver_a_team"] = pairs.apply(lambda row: teams.get((row["session_id"], row["driver_a"])), axis=1)
    pairs["driver_b_team"] = pairs.apply(lambda row: teams.get((row["session_id"], row["driver_b"])), axis=1)
    pairs["corner_advantage_count_a"] = pairs.get("corner_advantage_count_a", 0).fillna(0).astype(int)
    pairs["corner_advantage_count_b"] = pairs.get("corner_advantage_count_b", 0).fillna(0).astype(int)
    pairs["straight_advantage_count_a"] = pairs.get("straight_advantage_count_a", 0).fillna(0).astype(int)
    pairs["straight_advantage_count_b"] = pairs.get("straight_advantage_count_b", 0).fillna(0).astype(int)
    pairs["confidence"] = pairs.apply(
        lambda row: comparison_confidence(row.get("driver_a_quality"), row.get("driver_b_quality"), row.get("segment_confidence"), row.get("straight_confidence")),
        axis=1,
    )
    pairs["weakest_assumption"] = WEAKEST_ASSUMPTION
    pairs["strategy_relevance_note"] = pairs["track_archetype"].fillna("mixed").map(strategy_relevance)
    for column in ["avg_segment_delta_kph", "avg_straight_delta_kph"]:
        if column in pairs.columns:
            pairs[column] = pairs[column].round(3)
    for column in ["braking_advantage_score", "traction_advantage_score", "energy_proxy_delta"]:
        if column in pairs.columns:
            pairs[column] = pairs[column].round(4)
    columns = [
        "session_id", "driver_a", "driver_b", "driver_a_team", "driver_b_team",
        "corner_advantage_count_a", "corner_advantage_count_b", "straight_advantage_count_a",
        "straight_advantage_count_b", "avg_segment_delta_kph", "avg_straight_delta_kph",
        "braking_advantage_score", "traction_advantage_score", "energy_proxy_delta",
        "confidence", "weakest_assumption", "strategy_relevance_note",
    ]
    for column in columns:
        if column not in pairs.columns:
            pairs[column] = None
    return pairs[columns]


def build_track_summary(session_index: pd.DataFrame, archetypes: dict[str, dict[str, Any]]) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for _, session in session_index.iterrows():
        track = resolve_archetype(session["event"], archetypes)
        rows.append(
            {
                "session_id": session["session_id"],
                "track_archetype": track.get("track_archetype"),
                "straight_line_weight": clamp01(track.get("straight_line_weight")),
                "braking_weight": clamp01(track.get("braking_weight")),
                "traction_weight": clamp01(track.get("traction_weight")),
                "degradation_weight": clamp01(track.get("degradation_weight")),
                "track_position_weight": clamp01(track.get("track_position_weight")),
                "archetype_confidence": clamp01(track.get("archetype_confidence"), 0.35),
            }
        )
    return pd.DataFrame(rows)


def build_lap_pace_driver(
    session_index: pd.DataFrame,
    race_index: pd.DataFrame,
    pace: pd.DataFrame,
    positions: pd.DataFrame,
    traffic: pd.DataFrame,
) -> pd.DataFrame:
    if session_index.empty or race_index.empty or pace.empty:
        return pd.DataFrame()

    source = pace.copy()
    index_columns = ["race_analysis_id", "session_id"]
    if "race_analysis_id" not in race_index.columns or "session_id" not in race_index.columns:
        return pd.DataFrame()
    source = source.merge(race_index[index_columns].drop_duplicates(), on="race_analysis_id", how="left")
    analytics_session_ids = set(session_index.loc[session_index["session"] == "R", "session_id"].astype(str))
    source = source[source["session_id"].astype(str).isin(analytics_session_ids)].copy()
    if source.empty:
        return pd.DataFrame()

    keys = ["race_analysis_id", "driver", "lap_number"]
    if not positions.empty:
        position_columns = [column for column in ["position", "track_status_label", "confidence", "evidence_type"] if column in positions.columns]
        position_subset = positions[keys + position_columns].rename(
            columns={"confidence": "position_confidence", "evidence_type": "position_evidence_type"}
        )
        source = source.merge(position_subset, on=keys, how="left")
    if not traffic.empty:
        traffic_columns = [
            column
            for column in ["traffic_proxy_label", "dirty_air_proxy_s", "drs_window_proxy", "confidence", "evidence_type"]
            if column in traffic.columns
        ]
        traffic_subset = traffic[keys + traffic_columns].rename(
            columns={"confidence": "traffic_confidence", "evidence_type": "traffic_evidence_type"}
        )
        source = source.merge(traffic_subset, on=keys, how="left")

    source["lap_number"] = pd.to_numeric(source["lap_number"], errors="coerce").astype("Int64")
    confidence_parts = []
    for column in ["pace_confidence", "position_confidence", "traffic_confidence"]:
        if column in source.columns:
            confidence_parts.append(pd.to_numeric(source[column], errors="coerce"))
    source["confidence"] = pd.concat(confidence_parts, axis=1).mean(axis=1).map(lambda value: clamp01(value, 0.45)) if confidence_parts else 0.45
    source["traffic_proxy_note"] = TRAFFIC_PROXY_NOTE
    source["evidence_type"] = source.get("traffic_evidence_type", "proxy")

    output_columns = [
        "session_id",
        "driver",
        "team",
        "lap_number",
        "race_phase",
        "compound",
        "stint_number",
        "lap_time_s",
        "normalized_pace_delta_s",
        "rolling_pace_delta_s",
        "fuel_corrected_delta_s",
        "field_rank_on_lap",
        "tyre_age",
        "position",
        "track_status_label",
        "traffic_proxy_label",
        "dirty_air_proxy_s",
        "drs_window_proxy",
        "confidence",
        "evidence_type",
        "traffic_proxy_note",
    ]
    for column in output_columns:
        if column not in source.columns:
            source[column] = None
    numeric_columns = [
        "lap_time_s",
        "normalized_pace_delta_s",
        "rolling_pace_delta_s",
        "fuel_corrected_delta_s",
        "dirty_air_proxy_s",
        "confidence",
    ]
    for column in numeric_columns:
        source[column] = pd.to_numeric(source[column], errors="coerce").round(4)
    integer_columns = ["stint_number", "field_rank_on_lap", "tyre_age", "position"]
    for column in integer_columns:
        source[column] = pd.to_numeric(source[column], errors="coerce").astype("Int64")
    return source[output_columns].sort_values(["session_id", "driver", "lap_number"])


def null_rates(outputs: dict[str, pd.DataFrame]) -> dict[str, dict[str, float]]:
    rates: dict[str, dict[str, float]] = {}
    for name, frame in outputs.items():
        if frame.empty:
            rates[name] = {}
            continue
        rates[name] = {column: round(float(frame[column].isna().mean()), 4) for column in frame.columns}
    return rates


def main() -> None:
    settings = load_settings()
    telemetry_dir = DATA_DIR / "telemetry_features"
    strategy_lab_dir = DATA_DIR / "strategy_lab"
    analytics_dir = DATA_DIR / "analytics"
    race_analysis_dir = DATA_DIR / "race_analysis"
    reports_dir = DATA_DIR / "reports"
    generated_at, build_version = generated_metadata()

    laps = session_id_columns(read_csv(telemetry_dir / "telemetry_lap_summary.csv"))
    corner = session_id_columns(read_csv(telemetry_dir / "corner_speed_profile.csv"))
    braking = session_id_columns(read_csv(telemetry_dir / "corner_braking_profile.csv"))
    throttle = session_id_columns(read_csv(telemetry_dir / "corner_throttle_profile.csv"))
    straight = session_id_columns(read_csv(telemetry_dir / "straight_speed_profile.csv"))
    energy = session_id_columns(read_csv(telemetry_dir / "energy_deployment_proxy.csv"))
    archetypes = archetype_lookup(read_csv(strategy_lab_dir / "track_archetype_weights.csv"))
    results = read_csv(settings.canonical_fastf1_dir / "results_canonical.csv")
    race_index = read_csv(race_analysis_dir / "race_analysis_index.csv")
    race_pace = read_csv(race_analysis_dir / "race_analysis_pace_evolution.csv")
    race_positions = read_csv(race_analysis_dir / "race_analysis_position_timeline.csv")
    race_traffic = read_csv(race_analysis_dir / "race_analysis_traffic_proxy.csv")

    session_index = build_session_index(laps, corner, straight, archetypes, generated_at, build_version)
    segment = build_segment_comparison(corner)
    braking_comparison = build_braking_comparison(braking)
    throttle_comparison = build_throttle_comparison(throttle)
    straight_comparison = build_straight_comparison(straight)
    energy_comparison = build_energy_comparison(energy)
    driver_comparison = build_driver_comparison(
        session_index,
        laps,
        segment,
        braking_comparison,
        throttle_comparison,
        straight_comparison,
        energy_comparison,
        team_lookup(results),
    )
    track_summary = build_track_summary(session_index, archetypes)
    lap_pace_driver = build_lap_pace_driver(session_index, race_index, race_pace, race_positions, race_traffic)

    outputs = {
        "session_index": session_index,
        "driver_comparison": driver_comparison,
        "segment_comparison": segment,
        "braking_comparison": braking_comparison,
        "throttle_comparison": throttle_comparison,
        "straight_comparison": straight_comparison,
        "energy_proxy_comparison": energy_comparison,
        "lap_pace_driver": lap_pace_driver,
        "track_summary": track_summary,
    }
    for name, filename in OUTPUT_FILES.items():
        write_csv(outputs[name], analytics_dir / filename)

    confidence = pd.concat(
        [frame["confidence"] for frame in outputs.values() if "confidence" in frame.columns and not frame.empty],
        ignore_index=True,
    )
    report = {
        "generated_at": generated_at,
        "build_version": build_version,
        "rows": {name: int(len(frame)) for name, frame in outputs.items()},
        "session_coverage": int(session_index["session_id"].nunique()) if not session_index.empty else 0,
        "driver_comparison_coverage": int(driver_comparison[["session_id", "driver_a", "driver_b"]].drop_duplicates().shape[0]) if not driver_comparison.empty else 0,
        "segment_coverage": int(segment[["session_id", "segment_id"]].drop_duplicates().shape[0]) if not segment.empty else 0,
        "null_rates": null_rates(outputs),
        "confidence_distribution": {
            "min": round(float(confidence.min()), 4) if not confidence.empty else None,
            "median": round(float(confidence.median()), 4) if not confidence.empty else None,
            "max": round(float(confidence.max()), 4) if not confidence.empty else None,
        },
        "proxy_note": PROXY_NOTE,
        "validation_errors": [],
    }
    for name, frame in outputs.items():
        if frame.empty:
            report["validation_errors"].append(f"{name} has zero rows")
    reports_dir.mkdir(parents=True, exist_ok=True)
    (reports_dir / "analytics_quality_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    if report["validation_errors"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
