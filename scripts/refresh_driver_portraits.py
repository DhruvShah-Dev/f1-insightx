from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

OUTPUT_DIR = Path("apps/web/public/assets/drivers/2026")
F1_MEDIA_URL = (
    "https://media.formula1.com/image/upload/"
    "c_lfill,w_2048/q_auto/"
    "d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/"
    "v1740000001/common/f1/2026/{team_slug}/{asset_code}/2026{team_slug}{asset_code}right.webp"
)

DRIVER_ASSET_MAP = {
    "russell": ("mercedes", "georus01"),
    "antonelli": ("mercedes", "andant01"),
    "leclerc": ("ferrari", "chalec01"),
    "hamilton": ("ferrari", "lewham01"),
    "norris": ("mclaren", "lannor01"),
    "piastri": ("mclaren", "oscpia01"),
    "ocon": ("haasf1team", "estoco01"),
    "bearman": ("haasf1team", "olibea01"),
    "max_verstappen": ("redbullracing", "maxver01"),
    "hadjar": ("redbullracing", "isahad01"),
    "lawson": ("racingbulls", "lialaw01"),
    "arvid_lindblad": ("racingbulls", "arvlin01"),
    "gasly": ("alpine", "piegas01"),
    "colapinto": ("alpine", "fracol01"),
    "hulkenberg": ("audi", "nichul01"),
    "bortoleto": ("audi", "gabbor01"),
    "sainz": ("williams", "carsai01"),
    "albon": ("williams", "alealb01"),
    "perez": ("cadillac", "serper01"),
    "bottas": ("cadillac", "valbot01"),
    "alonso": ("astonmartin", "feralo01"),
    "stroll": ("astonmartin", "lanstr01"),
}


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    missing: list[str] = []
    for driver_id, (team_slug, asset_code) in DRIVER_ASSET_MAP.items():
        source_url = F1_MEDIA_URL.format(team_slug=team_slug, asset_code=asset_code)
        destination = OUTPUT_DIR / f"{driver_id}.webp"
        urllib.request.urlretrieve(source_url, destination)
        print(f"saved {driver_id} -> {destination}")

    if missing:
        print("missing records:", file=sys.stderr)
        for entry in missing:
            print(f"  - {entry}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
