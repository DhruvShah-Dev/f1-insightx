"""Verify the deployed revision and data-backed routes after an automated refresh."""

from __future__ import annotations

import argparse
import os
import time
from urllib.parse import quote

import httpx

ROUTES = ("/", "/raceweek", "/analysis", "/vs", "/picks", "/championship", "/method", "/method/dashboard")


def verify(base_url: str, expected_name: str, expected_snapshot: str, analysis_slug: str = "", timeout_seconds: int = 600) -> None:
    deadline = time.monotonic() + timeout_seconds
    base_url = base_url.rstrip("/")
    last_error = "Deployment has not served the expected home page yet"
    with httpx.Client(timeout=30, follow_redirects=True) as client:
        while time.monotonic() < deadline:
            try:
                status = client.get(base_url + "/api/data-release")
                status.raise_for_status()
                if status.json().get("snapshotISO") != expected_snapshot:
                    raise RuntimeError("Production is still serving a previous data release")
                home = client.get(base_url + "/")
                home.raise_for_status()
                if expected_name not in home.text:
                    raise RuntimeError(f"Home page does not contain {expected_name!r}")
                routes = (*ROUTES[1:], *(["/analysis/" + quote(analysis_slug)] if analysis_slug else []))
                for route in routes:
                    response = client.get(base_url + route)
                    response.raise_for_status()
                    if not response.text.strip():
                        raise RuntimeError(f"Empty page: {route}")
                print("Verified deployed data pages:", ", ".join(("/", *routes)))
                return
            except (httpx.HTTPError, RuntimeError, ValueError) as error:
                last_error = str(error)
                time.sleep(20)
    raise RuntimeError(last_error)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--expected-name", required=True)
    parser.add_argument("--expected-snapshot", required=True)
    parser.add_argument("--analysis-slug", default="")
    parser.add_argument("--timeout-seconds", type=int, default=600)
    args = parser.parse_args()
    base_url = os.environ.get("PRODUCTION_BASE_URL")
    if not base_url:
        raise RuntimeError("PRODUCTION_BASE_URL is required")
    verify(base_url, args.expected_name, args.expected_snapshot, args.analysis_slug, args.timeout_seconds)
