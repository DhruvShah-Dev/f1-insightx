from __future__ import annotations

import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd


DATA_DIR = Path(__file__).resolve().parent
ROOT_DIR = DATA_DIR.parent
OUTPUT_DIR = DATA_DIR / "ml" / "generated"
FEATURE_VERSION = "ml-pre-race-v1"
LABEL_VERSION = "ml-labels-v1"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def read_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path, low_memory=False)


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def clamp01(value: Any, default: float = 0.0) -> float:
    number = pd.to_numeric(pd.Series([value]), errors="coerce").iloc[0]
    if pd.isna(number):
        return default
    return round(max(0.0, min(1.0, float(number))), 4)


def mean_or_blank(series: pd.Series) -> float | str:
    numeric = pd.to_numeric(series, errors="coerce").dropna()
    if numeric.empty:
        return ""
    return round(float(numeric.mean()), 4)


def std_or_blank(series: pd.Series) -> float | str:
    numeric = pd.to_numeric(series, errors="coerce").dropna()
    if len(numeric) < 2:
        return ""
    return round(float(numeric.std(ddof=0)), 4)


def bool_flag(value: bool) -> str:
    return "true" if value else "false"


def joined_flags(flags: list[str]) -> str:
    return ";".join(sorted(set(flag for flag in flags if flag))) or "none"


def proxy_metadata(flags: list[str]) -> tuple[int, str, str]:
    unique = sorted(set(flag for flag in flags if flag))
    count = len(unique)
    return count, ";".join(unique) or "none", bool_flag(count >= 2)


def slug_text(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text


def load_source_data_version() -> str:
    manifest = read_json(DATA_DIR / "reports" / "product_manifest.json")
    build_version = manifest.get("build_version")
    generated_at = manifest.get("generated_at")
    if build_version:
        return str(build_version)
    if generated_at:
        return f"product_manifest_{generated_at}"
    return "product_manifest_unknown"


def race_order_frame(races: pd.DataFrame, results: pd.DataFrame) -> pd.DataFrame:
    race_ids = set(results["race_id"].dropna().astype(str))
    frame = races[races["id"].astype(str).isin(race_ids)].copy()
    frame["scheduled_at"] = pd.to_datetime(frame["scheduled_at"], utc=True, errors="coerce")
    frame["season"] = pd.to_numeric(frame["season"], errors="coerce").astype("Int64")
    frame["round"] = pd.to_numeric(frame["round"], errors="coerce").astype("Int64")
    return frame.dropna(subset=["scheduled_at", "season", "round"]).sort_values(["scheduled_at", "season", "round"])


def enrich_results(races: pd.DataFrame, results: pd.DataFrame) -> pd.DataFrame:
    race_cols = ["id", "season", "round", "race_name", "circuit_id", "scheduled_at", "sprint_weekend"]
    race_meta = races[race_cols].rename(columns={"id": "race_id"})
    enriched = results.merge(race_meta, on="race_id", how="left")
    enriched["scheduled_at"] = pd.to_datetime(enriched["scheduled_at"], utc=True, errors="coerce")
    for col in ["season", "round", "grid_position", "finish_position", "points", "laps_completed", "fastest_lap_rank"]:
        if col in enriched.columns:
            enriched[col] = pd.to_numeric(enriched[col], errors="coerce")
    enriched = enriched.dropna(subset=["scheduled_at", "season", "round"])
    return enriched.sort_values(["scheduled_at", "race_id", "finish_position"])


def build_driver_code_map(races: pd.DataFrame, curated_results: pd.DataFrame, canonical_results: pd.DataFrame) -> dict[tuple[str, str], str]:
    if canonical_results.empty:
        return {}
    race_lookup = races[["id", "season", "round"]].copy()
    race_lookup["season"] = pd.to_numeric(race_lookup["season"], errors="coerce")
    race_lookup["round"] = pd.to_numeric(race_lookup["round"], errors="coerce")
    canonical = canonical_results[canonical_results["session_code"].astype(str).eq("R")].copy()
    canonical["season"] = pd.to_numeric(canonical["season"], errors="coerce")
    canonical["round"] = pd.to_numeric(canonical["round"], errors="coerce")
    canonical["position"] = pd.to_numeric(canonical["position"], errors="coerce")
    canonical = canonical.merge(race_lookup, on=["season", "round"], how="left")
    curated = curated_results.copy()
    curated["finish_position"] = pd.to_numeric(curated["finish_position"], errors="coerce")
    merged = curated.merge(
        canonical[["id", "position", "abbreviation"]],
        left_on=["race_id", "finish_position"],
        right_on=["id", "position"],
        how="left",
    )
    mapping: dict[tuple[str, str], str] = {}
    for row in merged.to_dict("records"):
        race_id = str(row.get("race_id") or "")
        driver_id = str(row.get("driver_id") or "")
        code = str(row.get("abbreviation") or "").strip()
        if race_id and driver_id and code and code.lower() != "nan":
            mapping[(race_id, driver_id)] = code
    return mapping


def prior_rows(results: pd.DataFrame, target_date: pd.Timestamp, *, driver_id: str | None = None, constructor_id: str | None = None) -> pd.DataFrame:
    frame = results[results["scheduled_at"] < target_date].copy()
    if driver_id is not None:
        frame = frame[frame["driver_id"].astype(str) == driver_id]
    if constructor_id is not None:
        frame = frame[frame["constructor_id"].astype(str) == constructor_id]
    return frame.sort_values("scheduled_at")


def source_race_ids(frame: pd.DataFrame, limit: int = 5) -> str:
    if frame.empty:
        return ""
    return ";".join(frame.tail(limit)["race_id"].astype(str).tolist())


def load_track_archetype_lookup() -> dict[str, dict[str, Any]]:
    path = DATA_DIR / "strategy_lab" / "track_archetype_weights.csv"
    frame = read_csv(path)
    if frame.empty:
        return {}
    lookup: dict[str, dict[str, Any]] = {}
    for row in frame.to_dict("records"):
        keys = {
            slug_text(row.get("race_id")),
            slug_text(row.get("race_name")),
            slug_text(row.get("id")),
        }
        for key in keys:
            if key:
                lookup[key] = row
    return lookup


def race_archetype(row: dict[str, Any], lookup: dict[str, dict[str, Any]]) -> str:
    for value in [row.get("race_id"), row.get("race_name"), row.get("circuit_id")]:
        match = lookup.get(slug_text(value))
        if match:
            archetype = str(match.get("track_archetype") or "").strip()
            if archetype and archetype.lower() != "nan":
                return archetype
    return "unknown"


def finish_band(position: Any) -> str:
    pos = pd.to_numeric(pd.Series([position]), errors="coerce").iloc[0]
    if pd.isna(pos):
        return "unknown"
    pos = int(pos)
    if pos <= 3:
        return "podium"
    if pos <= 5:
        return "top-five"
    if pos <= 10:
        return "points"
    return "outside-points"


def dnf_flag(status: Any) -> bool:
    text = str(status or "").lower()
    return any(token in text for token in ["retired", "did not", "disqualified", "accident", "engine", "gearbox"])


def build_degradation_lookup(stints: pd.DataFrame, driver_code_map: dict[tuple[str, str], str]) -> dict[tuple[str, str], float]:
    if stints.empty:
        return {}
    reverse: dict[tuple[str, str], str] = {(race_id, code): driver_id for (race_id, driver_id), code in driver_code_map.items()}
    values: dict[tuple[str, str], float] = {}
    for (race_id, driver), group in stints.groupby(["race_analysis_id", "driver"], dropna=False):
        driver_id = reverse.get((str(race_id), str(driver)))
        if not driver_id:
            continue
        degradation = pd.to_numeric(group["degradation_s_per_lap"], errors="coerce").dropna()
        if not degradation.empty:
            values[(str(race_id), driver_id)] = round(float(degradation.mean()), 5)
    return values


def build_telemetry_lookup(telemetry: pd.DataFrame, driver_code_map: dict[tuple[str, str], str], races: pd.DataFrame) -> dict[tuple[str, str], dict[str, float]]:
    if telemetry.empty:
        return {}
    race_key = races[["id", "season", "round", "race_name"]].copy()
    race_key["season"] = pd.to_numeric(race_key["season"], errors="coerce")
    race_key["round"] = pd.to_numeric(race_key["round"], errors="coerce")
    telemetry = telemetry.merge(
        race_key,
        left_on=["season", "round", "event"],
        right_on=["season", "round", "race_name"],
        how="left",
    )
    reverse = {(race_id, code): driver_id for (race_id, driver_id), code in driver_code_map.items()}
    lookup: dict[tuple[str, str], dict[str, float]] = {}
    for (race_id, code), group in telemetry.dropna(subset=["id"]).groupby(["id", "driver"], dropna=False):
        driver_id = reverse.get((str(race_id), str(code)))
        if not driver_id:
            continue
        lookup[(str(race_id), driver_id)] = {
            "telemetry_quality_score": clamp01(pd.to_numeric(group["telemetry_quality_score"], errors="coerce").mean()),
            "telemetry_style_score": clamp01((pd.to_numeric(group["max_speed_kph"], errors="coerce").mean() - 250) / 80, 0.5),
        }
    return lookup


def prior_metric_average(prior: pd.DataFrame, lookup: dict[tuple[str, str], Any], driver_id: str, field: str | None = None) -> float | str:
    values: list[float] = []
    for race_id in prior.tail(5)["race_id"].astype(str):
        item = lookup.get((race_id, driver_id))
        if item is None:
            continue
        if field and isinstance(item, dict):
            value = item.get(field)
        else:
            value = item
        number = pd.to_numeric(pd.Series([value]), errors="coerce").iloc[0]
        if not pd.isna(number):
            values.append(float(number))
    if not values:
        return ""
    return round(sum(values) / len(values), 5)


def build_driver_features(
    races: pd.DataFrame,
    results: pd.DataFrame,
    degradation_lookup: dict[tuple[str, str], float],
    telemetry_lookup: dict[tuple[str, str], dict[str, float]],
    track_archetype_lookup: dict[str, dict[str, Any]],
    generated_at: str,
    source_data_version: str,
) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for row in results.to_dict("records"):
        target_date = row["scheduled_at"]
        target_race_id = str(row["race_id"])
        driver_id = str(row["driver_id"])
        constructor_id = str(row["constructor_id"])
        prior = prior_rows(results, target_date, driver_id=driver_id)
        recent = prior.tail(5)
        flags: list[str] = []
        proxy_flags: list[str] = []
        target_archetype = race_archetype(row, track_archetype_lookup)
        if target_archetype == "unknown":
            flags.append("missing_track_archetype")
            proxy_flags.append("track_archetype_missing")
        if recent.empty:
            flags.append("no_prior_driver_races")
        deg = prior_metric_average(recent, degradation_lookup, driver_id)
        if deg == "":
            flags.append("missing_prior_degradation")
        else:
            proxy_flags.append("degradation_from_race_analysis_stints")
        telemetry_quality = prior_metric_average(recent, telemetry_lookup, driver_id, "telemetry_quality_score")
        telemetry_style = prior_metric_average(recent, telemetry_lookup, driver_id, "telemetry_style_score")
        if telemetry_quality == "":
            flags.append("missing_prior_telemetry")
        else:
            proxy_flags.append("telemetry_style_summary")
        same_circuit = prior[prior["circuit_id"].astype(str) == str(row.get("circuit_id"))]
        track_fit = ""
        if not same_circuit.empty:
            track_fit = clamp01(1 - ((pd.to_numeric(same_circuit["finish_position"], errors="coerce").mean() - 1) / 19), 0.5)
            proxy_flags.append("track_fit_same_circuit_history")
        else:
            same_archetype = prior[
                prior.apply(lambda item: race_archetype(item.to_dict(), track_archetype_lookup) == target_archetype, axis=1)
            ] if target_archetype != "unknown" and not prior.empty else pd.DataFrame()
            if not same_archetype.empty:
                track_fit = clamp01(1 - ((pd.to_numeric(same_archetype["finish_position"], errors="coerce").mean() - 1) / 19), 0.5)
                proxy_flags.append("track_fit_archetype_history")
            else:
                flags.append("missing_prior_same_circuit_or_archetype")
        reliability = 1 - prior["finish_status"].map(dnf_flag).mean() if not prior.empty else ""
        proxy_count, proxy_flag_text, proxy_heavy = proxy_metadata(proxy_flags)
        data_quality = clamp01(
            0.25
            + min(len(recent), 5) / 5 * 0.35
            + (0.2 if telemetry_quality != "" else 0)
            + (0.1 if deg != "" else 0)
            + (0.1 if track_fit != "" else 0)
        )
        rows.append(
            {
                "feature_version": FEATURE_VERSION,
                "source_data_version": source_data_version,
                "generated_at": generated_at,
                "feature_cutoff_race_id": str(recent.iloc[-1]["race_id"]) if not recent.empty else "",
                "target_race_id": target_race_id,
                "feature_set_type": "pre_race",
                "season": int(row["season"]),
                "round": int(row["round"]),
                "driver_id": driver_id,
                "constructor_id": constructor_id,
                "source_race_ids": source_race_ids(recent),
                "recent_finish_avg": mean_or_blank(recent["finish_position"]),
                "recent_points_avg": mean_or_blank(recent["points"]),
                "recent_quali_avg": mean_or_blank(recent["grid_position"]),
                "quali_race_delta_recent": mean_or_blank(pd.to_numeric(recent["grid_position"], errors="coerce") - pd.to_numeric(recent["finish_position"], errors="coerce")),
                "pace_consistency_score": clamp01(1 - ((std_or_blank(recent["finish_position"]) or 10) / 10), 0.0) if not recent.empty else "",
                "reliability_score": round(float(reliability), 4) if reliability != "" and not math.isnan(float(reliability)) else "",
                "degradation_trend_s_per_lap": deg,
                "degradation_trend_sign_convention": "positive_slower_negative_faster_or_fuel_track_effect",
                "track_archetype": target_archetype,
                "track_fit_score": track_fit,
                "telemetry_style_score": telemetry_style,
                "telemetry_quality_score": telemetry_quality,
                "feature_completeness": data_quality,
                "proxy_feature_count": proxy_count,
                "proxy_feature_flags": proxy_flag_text,
                "proxy_heavy_flag": proxy_heavy,
                "data_quality_score": data_quality,
                "missing_flags": joined_flags(flags),
            }
        )
    return pd.DataFrame(rows)


def build_team_features(results: pd.DataFrame, generated_at: str, source_data_version: str) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    targets = results[["race_id", "season", "round", "scheduled_at", "constructor_id"]].drop_duplicates()
    for row in targets.to_dict("records"):
        target_date = row["scheduled_at"]
        constructor_id = str(row["constructor_id"])
        recent = prior_rows(results, target_date, constructor_id=constructor_id).tail(10)
        flags: list[str] = []
        proxy_flags = ["strategy_effectiveness_grid_finish_proxy"] if not recent.empty else []
        if recent.empty:
            flags.append("no_prior_constructor_races")
        position_delta = pd.to_numeric(recent["grid_position"], errors="coerce") - pd.to_numeric(recent["finish_position"], errors="coerce")
        reliability = 1 - recent["finish_status"].map(dnf_flag).mean() if not recent.empty else ""
        data_quality = clamp01(0.3 + min(len(recent), 10) / 10 * 0.5)
        proxy_count, proxy_flag_text, proxy_heavy = proxy_metadata(proxy_flags)
        rows.append(
            {
                "feature_version": FEATURE_VERSION,
                "source_data_version": source_data_version,
                "generated_at": generated_at,
                "feature_cutoff_race_id": str(recent.iloc[-1]["race_id"]) if not recent.empty else "",
                "target_race_id": str(row["race_id"]),
                "feature_set_type": "pre_race",
                "season": int(row["season"]),
                "round": int(row["round"]),
                "constructor_id": constructor_id,
                "source_race_ids": source_race_ids(recent, limit=10),
                "recent_points_avg": mean_or_blank(recent["points"]),
                "recent_finish_consistency": std_or_blank(recent["finish_position"]),
                "strategy_effectiveness_score": clamp01((position_delta.mean() + 5) / 10, 0.5) if not position_delta.dropna().empty else "",
                "reliability_score": round(float(reliability), 4) if reliability != "" and not math.isnan(float(reliability)) else "",
                "feature_completeness": data_quality,
                "proxy_feature_count": proxy_count,
                "proxy_feature_flags": proxy_flag_text,
                "proxy_heavy_flag": proxy_heavy,
                "data_quality_score": data_quality,
                "missing_flags": joined_flags(flags),
            }
        )
    return pd.DataFrame(rows)


def build_track_features(
    races_with_results: pd.DataFrame,
    stints: pd.DataFrame,
    position_changes: pd.DataFrame,
    neutralization: pd.DataFrame,
    weather: pd.DataFrame,
    track_archetype_lookup: dict[str, dict[str, Any]],
    generated_at: str,
    source_data_version: str,
) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    race_by_id = races_with_results.set_index("id")
    for row in races_with_results.to_dict("records"):
        target_date = row["scheduled_at"]
        circuit_id = str(row["circuit_id"])
        prior_races = races_with_results[
            (races_with_results["scheduled_at"] < target_date) & (races_with_results["circuit_id"].astype(str) == circuit_id)
        ].copy()
        prior_ids = prior_races["id"].astype(str).tolist()
        flags: list[str] = []
        if not prior_ids:
            flags.append("no_prior_circuit_races")
        prior_stints = stints[stints["race_analysis_id"].astype(str).isin(prior_ids)] if not stints.empty else pd.DataFrame()
        prior_positions = position_changes[position_changes["race_analysis_id"].astype(str).isin(prior_ids)] if not position_changes.empty else pd.DataFrame()
        prior_neutral = neutralization[neutralization["race_analysis_id"].astype(str).isin(prior_ids)] if not neutralization.empty else pd.DataFrame()
        prior_weather = weather[weather["race_analysis_id"].astype(str).isin(prior_ids)] if not weather.empty else pd.DataFrame()
        archetype = race_archetype(row, track_archetype_lookup)
        degradation = mean_or_blank(prior_stints["degradation_s_per_lap"]) if not prior_stints.empty else ""
        overtaking_proxy = mean_or_blank(abs(pd.to_numeric(prior_positions["net_position_change"], errors="coerce"))) if not prior_positions.empty else ""
        weather_volatility = mean_or_blank(pd.to_numeric(prior_weather["track_temp_delta_from_start_c"], errors="coerce").abs()) if not prior_weather.empty else ""
        neutral_freq = round(float(len(prior_neutral)) / len(prior_ids), 4) if prior_ids else ""
        if degradation == "":
            flags.append("missing_prior_circuit_degradation")
        proxy_flags = [
            "track_archetype_strategy_lab_weights" if archetype != "unknown" else "track_archetype_missing",
            "overtaking_position_movement_proxy" if overtaking_proxy != "" else "",
            "neutralization_track_status_proxy" if neutral_freq != "" else "",
            "weather_context_summary" if weather_volatility != "" else "",
        ]
        if degradation != "":
            proxy_flags.append("degradation_from_race_analysis_stints")
        proxy_count, proxy_flag_text, proxy_heavy = proxy_metadata(proxy_flags)
        data_quality = clamp01(0.3 + min(len(prior_ids), 3) / 3 * 0.4 + (0.1 if degradation != "" else 0) + (0.1 if overtaking_proxy != "" else 0))
        rows.append(
            {
                "feature_version": FEATURE_VERSION,
                "source_data_version": source_data_version,
                "generated_at": generated_at,
                "feature_cutoff_race_id": prior_ids[-1] if prior_ids else "",
                "target_race_id": str(row["id"]),
                "feature_set_type": "pre_race",
                "season": int(row["season"]),
                "round": int(row["round"]),
                "circuit_id": circuit_id,
                "source_race_ids": ";".join(prior_ids[-5:]),
                "track_archetype": archetype if archetype != "unknown" else ("historical_circuit_proxy" if prior_ids else "unknown"),
                "degradation_tendency_s_per_lap": degradation,
                "overtaking_proxy_score": clamp01((float(overtaking_proxy) if overtaking_proxy != "" else 0) / 8, 0.0) if overtaking_proxy != "" else "",
                "weather_volatility_score": clamp01((float(weather_volatility) if weather_volatility != "" else 0) / 12, 0.0) if weather_volatility != "" else "",
                "neutralization_frequency_proxy": neutral_freq,
                "race_control_available": bool_flag(False),
                "feature_completeness": data_quality,
                "proxy_feature_count": proxy_count,
                "proxy_feature_flags": proxy_flag_text,
                "proxy_heavy_flag": proxy_heavy,
                "data_quality_score": data_quality,
                "missing_flags": joined_flags(flags),
            }
        )
    return pd.DataFrame(rows)


def build_labels(results: pd.DataFrame, race_pace_ranks: dict[tuple[str, str], int], generated_at: str, source_data_version: str) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for row in results.to_dict("records"):
        race_id = str(row["race_id"])
        driver_id = str(row["driver_id"])
        constructor_rows = results[(results["race_id"].astype(str) == race_id) & (results["constructor_id"].astype(str) == str(row["constructor_id"]))]
        finish = pd.to_numeric(pd.Series([row.get("finish_position")]), errors="coerce").iloc[0]
        teammate_delta = ""
        if not constructor_rows.empty and not pd.isna(finish):
            other = pd.to_numeric(constructor_rows[constructor_rows["driver_id"].astype(str) != driver_id]["finish_position"], errors="coerce").dropna()
            if not other.empty:
                teammate_delta = round(float(finish - other.mean()), 4)
        grid = pd.to_numeric(pd.Series([row.get("grid_position")]), errors="coerce").iloc[0]
        points = pd.to_numeric(pd.Series([row.get("points")]), errors="coerce").iloc[0]
        race_pace_rank = race_pace_ranks.get((race_id, driver_id), "")
        label_flags: list[str] = []
        if pd.isna(finish):
            label_flags.append("missing_finish_position")
        if pd.isna(points):
            label_flags.append("missing_points")
        if pd.isna(grid):
            label_flags.append("missing_grid_position")
        if teammate_delta == "":
            label_flags.append("missing_teammate_delta")
        if race_pace_rank == "":
            label_flags.append("missing_race_pace_rank")
        label_quality = clamp01(
            (0.35 if not pd.isna(finish) else 0)
            + (0.15 if not pd.isna(points) else 0)
            + (0.15 if not pd.isna(grid) else 0)
            + (0.15 if teammate_delta != "" else 0)
            + (0.15 if race_pace_rank != "" else 0)
            + (0.05 if str(row.get("finish_status") or "").strip() else 0),
            0.3,
        )
        rows.append(
            {
                "label_version": LABEL_VERSION,
                "source_data_version": source_data_version,
                "generated_at": generated_at,
                "target_race_id": race_id,
                "season": int(row["season"]),
                "round": int(row["round"]),
                "driver_id": driver_id,
                "constructor_id": str(row["constructor_id"]),
                "label_cutoff": "post_race_classification",
                "finish_position": int(finish) if not pd.isna(finish) else "",
                "finish_band": finish_band(finish),
                "points_finish": bool_flag((points if not pd.isna(points) else 0) > 0),
                "points": round(float(points), 4) if not pd.isna(points) else "",
                "podium_flag": bool_flag(not pd.isna(finish) and finish <= 3),
                "top_five_flag": bool_flag(not pd.isna(finish) and finish <= 5),
                "dnf_flag": bool_flag(dnf_flag(row.get("finish_status"))),
                "position_delta": round(float(grid - finish), 4) if not pd.isna(grid) and not pd.isna(finish) else "",
                "teammate_delta": teammate_delta,
                "race_pace_rank": race_pace_rank,
                "label_quality_score": label_quality,
                "missing_flags": joined_flags(label_flags),
            }
        )
    return pd.DataFrame(rows)


def build_race_pace_ranks(
    races: pd.DataFrame,
    laps: pd.DataFrame,
    driver_code_map: dict[tuple[str, str], str],
) -> dict[tuple[str, str], int]:
    if laps.empty:
        return {}
    race_lookup = races[["id", "season", "round"]].copy()
    race_lookup["season"] = pd.to_numeric(race_lookup["season"], errors="coerce")
    race_lookup["round"] = pd.to_numeric(race_lookup["round"], errors="coerce")
    race_laps = laps[laps["session_code"].astype(str).eq("R")].copy()
    race_laps["season"] = pd.to_numeric(race_laps["season"], errors="coerce")
    race_laps["round"] = pd.to_numeric(race_laps["round"], errors="coerce")
    race_laps["lap_time_s"] = pd.to_numeric(race_laps["lap_time_s"], errors="coerce")
    race_laps = race_laps.merge(race_lookup, on=["season", "round"], how="left").dropna(subset=["id", "lap_time_s"])
    reverse = {(race_id, code): driver_id for (race_id, driver_id), code in driver_code_map.items()}
    ranks: dict[tuple[str, str], int] = {}
    for race_id, group in race_laps.groupby("id"):
        medians = group.groupby("driver")["lap_time_s"].median().sort_values()
        for rank, code in enumerate(medians.index.tolist(), start=1):
            driver_id = reverse.get((str(race_id), str(code)))
            if driver_id:
                ranks[(str(race_id), driver_id)] = rank
    return ranks


def build_quality_labels(
    driver_features: pd.DataFrame,
    team_features: pd.DataFrame,
    track_features: pd.DataFrame,
    generated_at: str,
    source_data_version: str,
) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for table_name, frame, entity_col, entity_type in [
        ("pre_race_driver_features", driver_features, "driver_id", "driver"),
        ("pre_race_team_features", team_features, "constructor_id", "constructor"),
        ("pre_race_track_features", track_features, "circuit_id", "circuit"),
    ]:
        for row in frame.to_dict("records"):
            missing_flags = str(row.get("missing_flags") or "")
            telemetry_missing = "missing_prior_telemetry" in missing_flags
            proxy_count = int(pd.to_numeric(pd.Series([row.get("proxy_feature_count")]), errors="coerce").fillna(0).iloc[0])
            rows.append(
                {
                    "quality_version": "ml-quality-v1",
                    "source_data_version": source_data_version,
                    "generated_at": generated_at,
                    "target_race_id": row.get("target_race_id"),
                    "season": row.get("season"),
                    "round": row.get("round"),
                    "entity_type": entity_type,
                    "entity_id": row.get(entity_col),
                    "feature_table": table_name,
                    "feature_completeness": row.get("feature_completeness"),
                    "telemetry_coverage_flag": bool_flag(not telemetry_missing),
                    "weather_coverage_flag": bool_flag(True),
                    "race_control_available_flag": bool_flag(False),
                    "proxy_heavy_flag": row.get("proxy_heavy_flag"),
                    "proxy_feature_count": proxy_count,
                    "proxy_feature_flags": row.get("proxy_feature_flags", "none"),
                    "inferred_position_flag": bool_flag(table_name != "pre_race_track_features"),
                    "confidence_score": row.get("data_quality_score"),
                    "missing_feature_count": 0 if missing_flags == "none" else len(missing_flags.split(";")),
                    "missing_flags": missing_flags,
                }
            )
    return pd.DataFrame(rows)


def main() -> None:
    generated_at = utc_now()
    source_data_version = load_source_data_version()
    races = read_csv(DATA_DIR / "curated" / "races.csv")
    results = read_csv(DATA_DIR / "curated" / "race_results.csv")
    canonical_results = read_csv(DATA_DIR / "canonical_fastf1" / "results_canonical.csv")
    canonical_laps = read_csv(DATA_DIR / "canonical_fastf1" / "laps_canonical.csv")
    stints = read_csv(DATA_DIR / "race_analysis" / "race_analysis_stints.csv")
    position_changes = read_csv(DATA_DIR / "race_analysis" / "race_analysis_position_changes.csv")
    neutralization = read_csv(DATA_DIR / "race_analysis" / "race_analysis_neutralization_phases.csv")
    weather = read_csv(DATA_DIR / "race_analysis" / "race_analysis_weather_context.csv")
    telemetry = read_csv(DATA_DIR / "telemetry_features" / "telemetry_lap_summary.csv")
    track_archetype_lookup = load_track_archetype_lookup()

    races_with_results = race_order_frame(races, results)
    enriched_results = enrich_results(races, results)
    driver_code_map = build_driver_code_map(races, results, canonical_results)
    degradation_lookup = build_degradation_lookup(stints, driver_code_map)
    telemetry_lookup = build_telemetry_lookup(telemetry, driver_code_map, races)
    race_pace_ranks = build_race_pace_ranks(races, canonical_laps, driver_code_map)

    driver_features = build_driver_features(races, enriched_results, degradation_lookup, telemetry_lookup, track_archetype_lookup, generated_at, source_data_version)
    team_features = build_team_features(enriched_results, generated_at, source_data_version)
    track_features = build_track_features(races_with_results, stints, position_changes, neutralization, weather, track_archetype_lookup, generated_at, source_data_version)
    labels = build_labels(enriched_results, race_pace_ranks, generated_at, source_data_version)
    quality = build_quality_labels(driver_features, team_features, track_features, generated_at, source_data_version)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    outputs = {
        "pre_race_driver_features.csv": driver_features,
        "pre_race_team_features.csv": team_features,
        "pre_race_track_features.csv": track_features,
        "race_outcome_labels.csv": labels,
        "data_quality_labels.csv": quality,
    }
    for filename, frame in outputs.items():
        frame.to_csv(OUTPUT_DIR / filename, index=False)

    report = {
        "generated_at": generated_at,
        "feature_version": FEATURE_VERSION,
        "label_version": LABEL_VERSION,
        "source_data_version": source_data_version,
        "row_counts": {name: int(len(frame)) for name, frame in outputs.items()},
        "validation_errors": [],
        "notes": [
            "Pre-race features use only prior race rows and current schedule/circuit identifiers.",
            "Labels are generated in a separate table and are not joined into feature files.",
            "degradation_trend_s_per_lap keeps signed race-analysis stint slope: positive means slower over stint; negative can mean fuel burn or track evolution outweighed tyre loss.",
        ],
    }
    (OUTPUT_DIR / "ml_dataset_build_report.json").write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
