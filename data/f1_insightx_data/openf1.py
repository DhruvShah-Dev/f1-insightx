from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
import pandas as pd


@dataclass(frozen=True)
class OpenF1RateLimit:
    requests_per_second: float = 3.0
    requests_per_minute: int = 30


class OpenF1Client:
    def __init__(
        self,
        base_url: str,
        *,
        timeout: float = 30.0,
        max_retries: int = 5,
        rate_limit: OpenF1RateLimit | None = None,
    ) -> None:
        self._client = httpx.Client(base_url=base_url, timeout=timeout)
        self._max_retries = max_retries
        self._rate_limit = rate_limit or OpenF1RateLimit()
        self._request_times: list[float] = []

    def close(self) -> None:
        self._client.close()

    def _throttle(self) -> None:
        now = time.monotonic()
        self._request_times = [stamp for stamp in self._request_times if now - stamp < 60]

        if self._request_times:
            min_interval = 1 / self._rate_limit.requests_per_second
            since_last = now - self._request_times[-1]
            if since_last < min_interval:
                time.sleep(min_interval - since_last)
                now = time.monotonic()
                self._request_times = [stamp for stamp in self._request_times if now - stamp < 60]

        if len(self._request_times) >= self._rate_limit.requests_per_minute:
            sleep_for = 60 - (now - self._request_times[0]) + 0.05
            if sleep_for > 0:
                time.sleep(sleep_for)
            now = time.monotonic()
            self._request_times = [stamp for stamp in self._request_times if now - stamp < 60]

        self._request_times.append(time.monotonic())

    def _get(self, endpoint: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        for attempt in range(self._max_retries + 1):
            self._throttle()
            response = self._client.get(endpoint, params=params)
            if response.status_code not in {429, 500, 502, 503, 504}:
                response.raise_for_status()
                payload = response.json()
                if not isinstance(payload, list):
                    raise TypeError(f"OpenF1 {endpoint} returned {type(payload).__name__}, expected list")
                return payload

            if attempt == self._max_retries:
                response.raise_for_status()

            retry_after = response.headers.get("Retry-After")
            delay_seconds = float(retry_after) if retry_after else min(2**attempt, 30)
            time.sleep(delay_seconds)

        raise RuntimeError(f"Failed to fetch OpenF1 endpoint {endpoint}")

    def fetch_meetings(self, season: int) -> list[dict[str, Any]]:
        return self._get("/meetings", {"year": season})

    def fetch_sessions(self, *, meeting_key: int | str | None = None, season: int | None = None) -> list[dict[str, Any]]:
        params: dict[str, Any] = {}
        if meeting_key is not None:
            params["meeting_key"] = meeting_key
        if season is not None:
            params["year"] = season
        return self._get("/sessions", params)

    def fetch_endpoint_for_session(self, endpoint: str, session_key: int | str) -> list[dict[str, Any]]:
        return self._get(f"/{endpoint}", {"session_key": session_key})


def frame_from_records(records: list[dict[str, Any]]) -> pd.DataFrame:
    if not records:
        return pd.DataFrame()
    return pd.DataFrame.from_records(records)


def write_records_csv(records: list[dict[str, Any]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame_from_records(records).to_csv(path, index=False)
