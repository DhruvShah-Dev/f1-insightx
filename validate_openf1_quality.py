from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "data"
sys.path.insert(0, str(DATA_DIR))

from f1_insightx_data.io import read_csv_or_empty  # noqa: E402


REQUIRED_COLUMNS = {
    "id",
    "season",
    "round",
    "race_id",
    "openf1_session_count",
    "coverage_score",
    "source_agreement_score",
    "recommended_use",
    "source_label",
}


def main() -> None:
    report_path = DATA_DIR / "staged" / "openf1" / "reports" / "openf1_race_quality.csv"
    summary_path = DATA_DIR / "staged" / "openf1" / "reports" / "openf1_quality_summary.json"
    errors: list[str] = []
    report = read_csv_or_empty(report_path)

    if report.empty:
        errors.append("openf1 quality report has zero rows")
    else:
        missing_columns = sorted(REQUIRED_COLUMNS.difference(report.columns))
        errors.extend(f"openf1 quality report missing {column}" for column in missing_columns)
        if "id" in report.columns and report["id"].duplicated().any():
            errors.append("openf1 quality report has duplicate ids")
        for column in ["coverage_score", "source_agreement_score"]:
            if column in report.columns:
                values = pd.to_numeric(report[column], errors="coerce")
                if values.isna().any():
                    errors.append(f"{column} contains non-numeric values")
                elif not values.between(0, 1).all():
                    errors.append(f"{column} has values outside [0, 1]")
        if "source_label" in report.columns and not report["source_label"].eq("openf1_quality_v1").all():
            errors.append("source_label must be openf1_quality_v1")

    if not summary_path.exists():
        errors.append("openf1 quality summary is missing")
        summary = {}
    else:
        summary = json.loads(summary_path.read_text(encoding="utf-8"))
        if summary.get("source_label") != "openf1_quality_v1":
            errors.append("openf1 quality summary has invalid source_label")

    output = {
        "report": report_path.relative_to(ROOT_DIR).as_posix(),
        "summary": summary,
        "rows": int(len(report)),
        "errors": errors,
        "status": "failed" if errors else "passed",
    }
    print(json.dumps(output, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
