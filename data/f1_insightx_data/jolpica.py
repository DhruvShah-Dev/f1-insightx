from __future__ import annotations

import time
from typing import Any

import httpx


class JolpicaClient:
    def __init__(self, base_url: str, timeout: float = 30.0, max_retries: int = 5) -> None:
        self._client = httpx.Client(base_url=base_url, timeout=timeout)
        self._max_retries = max_retries

    def close(self) -> None:
        self._client.close()

    def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        for attempt in range(self._max_retries + 1):
            response = self._client.get(path, params=params)
            if response.status_code != 429:
                response.raise_for_status()
                return response.json()

            if attempt == self._max_retries:
                response.raise_for_status()

            retry_after = response.headers.get("Retry-After")
            delay_seconds = float(retry_after) if retry_after else min(2**attempt, 12)
            time.sleep(delay_seconds)

        raise RuntimeError(f"Failed to fetch {path}")

    def fetch_drivers(self) -> list[dict[str, Any]]:
        payload = self._get("/drivers.json", params={"limit": 1000})
        return payload["MRData"]["DriverTable"]["Drivers"]

    def fetch_constructors(self) -> list[dict[str, Any]]:
        payload = self._get("/constructors.json", params={"limit": 1000})
        return payload["MRData"]["ConstructorTable"]["Constructors"]

    def fetch_circuits(self) -> list[dict[str, Any]]:
        payload = self._get("/circuits.json", params={"limit": 1000})
        return payload["MRData"]["CircuitTable"]["Circuits"]

    def fetch_schedule(self, season: int) -> list[dict[str, Any]]:
        payload = self._get(f"/{season}.json", params={"limit": 100})
        return payload["MRData"]["RaceTable"]["Races"]

    def fetch_results(self, season: int, round_number: int) -> list[dict[str, Any]]:
        payload = self._get(f"/{season}/{round_number}/results.json", params={"limit": 100})
        return payload["MRData"]["RaceTable"]["Races"]

    def fetch_qualifying(self, season: int, round_number: int) -> list[dict[str, Any]]:
        payload = self._get(f"/{season}/{round_number}/qualifying.json", params={"limit": 100})
        return payload["MRData"]["RaceTable"]["Races"]

    def fetch_sprint(self, season: int, round_number: int) -> list[dict[str, Any]]:
        payload = self._get(f"/{season}/{round_number}/sprint.json", params={"limit": 100})
        return payload["MRData"]["RaceTable"]["Races"]
