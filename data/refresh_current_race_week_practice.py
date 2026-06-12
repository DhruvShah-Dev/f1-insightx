from __future__ import annotations

import sys

from refresh_current_race_week_sessions import main


if "--sessions" not in sys.argv:
    sys.argv.extend(["--sessions", "FP1", "FP2", "FP3"])


if __name__ == "__main__":
    main()
