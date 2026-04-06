from __future__ import annotations

from dataclasses import dataclass


REGULATION_RESET_SEASON = 2026


@dataclass(frozen=True)
class EraDefinition:
    key: str
    start_season: int
    end_season: int | None
    description: str


ERA_DEFINITIONS: tuple[EraDefinition, ...] = (
    EraDefinition(
        key="hybrid_pre_ground_effect",
        start_season=2014,
        end_season=2021,
        description="Turbo-hybrid pre-2022 aero era",
    ),
    EraDefinition(
        key="ground_effect_v1",
        start_season=2022,
        end_season=2025,
        description="Ground-effect rules before the 2026 reset",
    ),
    EraDefinition(
        key="regulations_2026_reset",
        start_season=2026,
        end_season=None,
        description="2026 reset era with new aero and power-unit regulations",
    ),
)


def regulation_era_for_season(season: int) -> EraDefinition:
    for era in ERA_DEFINITIONS:
        if season >= era.start_season and (era.end_season is None or season <= era.end_season):
            return era

    return ERA_DEFINITIONS[0]


def season_similarity_weight(source_season: int, target_season: int) -> float:
    source_era = regulation_era_for_season(source_season)
    target_era = regulation_era_for_season(target_season)
    season_gap = max(0, target_season - source_season)
    recency_weight = 0.85**season_gap

    if source_era.key == target_era.key:
        return round(max(0.2, recency_weight), 4)

    if target_season >= REGULATION_RESET_SEASON:
        return round(max(0.08, recency_weight * 0.22), 4)

    return round(max(0.1, recency_weight * 0.4), 4)
