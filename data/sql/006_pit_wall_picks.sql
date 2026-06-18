CREATE TABLE IF NOT EXISTS race_pick_challenges (
  race_id TEXT PRIMARY KEY REFERENCES races(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  round INTEGER NOT NULL,
  qualifying_lock_at TIMESTAMPTZ NOT NULL,
  random_position_1 INTEGER NOT NULL CHECK (random_position_1 BETWEEN 4 AND 20),
  random_position_2 INTEGER NOT NULL CHECK (random_position_2 BETWEEN 4 AND 20),
  random_position_3 INTEGER NOT NULL CHECK (random_position_3 BETWEEN 4 AND 20),
  source_label TEXT NOT NULL DEFAULT 'pit_wall_picks_v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (random_position_1 <> random_position_2),
  CHECK (random_position_1 <> random_position_3),
  CHECK (random_position_2 <> random_position_3)
);

CREATE TABLE IF NOT EXISTS user_race_picks (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  race_id TEXT NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  qualifying_p1_driver_id TEXT NOT NULL REFERENCES drivers(id),
  qualifying_p2_driver_id TEXT NOT NULL REFERENCES drivers(id),
  qualifying_p3_driver_id TEXT NOT NULL REFERENCES drivers(id),
  race_p1_driver_id TEXT NOT NULL REFERENCES drivers(id),
  race_p2_driver_id TEXT NOT NULL REFERENCES drivers(id),
  race_p3_driver_id TEXT NOT NULL REFERENCES drivers(id),
  random_position_1_driver_id TEXT NOT NULL REFERENCES drivers(id),
  random_position_2_driver_id TEXT NOT NULL REFERENCES drivers(id),
  random_position_3_driver_id TEXT NOT NULL REFERENCES drivers(id),
  fastest_pit_stop_driver_id TEXT NOT NULL REFERENCES drivers(id),
  fastest_lap_driver_id TEXT NOT NULL REFERENCES drivers(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, race_id),
  CHECK (qualifying_p1_driver_id <> qualifying_p2_driver_id),
  CHECK (qualifying_p1_driver_id <> qualifying_p3_driver_id),
  CHECK (qualifying_p2_driver_id <> qualifying_p3_driver_id),
  CHECK (race_p1_driver_id <> race_p2_driver_id),
  CHECK (race_p1_driver_id <> race_p3_driver_id),
  CHECK (race_p2_driver_id <> race_p3_driver_id),
  CHECK (random_position_1_driver_id <> random_position_2_driver_id),
  CHECK (random_position_1_driver_id <> random_position_3_driver_id),
  CHECK (random_position_2_driver_id <> random_position_3_driver_id)
);

CREATE TABLE IF NOT EXISTS race_pit_stop_results (
  race_id TEXT PRIMARY KEY REFERENCES races(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  round INTEGER NOT NULL,
  driver_id TEXT NOT NULL REFERENCES drivers(id),
  pit_duration_s DOUBLE PRECISION NOT NULL CHECK (pit_duration_s > 0),
  source_label TEXT NOT NULL DEFAULT 'openf1_pit_v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_race_pick_challenges_season_round ON race_pick_challenges (season DESC, round DESC);
CREATE INDEX IF NOT EXISTS idx_user_race_picks_user_id ON user_race_picks (user_id);
CREATE INDEX IF NOT EXISTS idx_user_race_picks_race_id ON user_race_picks (race_id);
CREATE INDEX IF NOT EXISTS idx_user_race_picks_user_race ON user_race_picks (user_id, race_id);
CREATE INDEX IF NOT EXISTS idx_race_pit_stop_results_season_round ON race_pit_stop_results (season DESC, round DESC);
CREATE INDEX IF NOT EXISTS idx_race_pit_stop_results_driver_id ON race_pit_stop_results (driver_id);

DROP TRIGGER IF EXISTS set_race_pick_challenges_updated_at ON race_pick_challenges;
CREATE TRIGGER set_race_pick_challenges_updated_at
BEFORE UPDATE ON race_pick_challenges
FOR EACH ROW
EXECUTE FUNCTION public.set_row_updated_at();

DROP TRIGGER IF EXISTS set_user_race_picks_updated_at ON user_race_picks;
CREATE TRIGGER set_user_race_picks_updated_at
BEFORE UPDATE ON user_race_picks
FOR EACH ROW
EXECUTE FUNCTION public.set_row_updated_at();

DROP TRIGGER IF EXISTS set_race_pit_stop_results_updated_at ON race_pit_stop_results;
CREATE TRIGGER set_race_pit_stop_results_updated_at
BEFORE UPDATE ON race_pit_stop_results
FOR EACH ROW
EXECUTE FUNCTION public.set_row_updated_at();

ALTER TABLE race_pick_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_race_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_pit_stop_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read race pick challenges" ON race_pick_challenges;
CREATE POLICY "Public can read race pick challenges"
ON race_pick_challenges
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Users can read their race picks" ON user_race_picks;
CREATE POLICY "Users can read their race picks"
ON user_race_picks
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert unlocked race picks" ON user_race_picks;
CREATE POLICY "Users can insert unlocked race picks"
ON user_race_picks
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND EXISTS (
    SELECT 1
    FROM race_pick_challenges challenge
    WHERE challenge.race_id = user_race_picks.race_id
      AND now() < challenge.qualifying_lock_at
  )
);

DROP POLICY IF EXISTS "Users can update unlocked race picks" ON user_race_picks;
CREATE POLICY "Users can update unlocked race picks"
ON user_race_picks
FOR UPDATE
TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  AND EXISTS (
    SELECT 1
    FROM race_pick_challenges challenge
    WHERE challenge.race_id = user_race_picks.race_id
      AND now() < challenge.qualifying_lock_at
  )
)
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND EXISTS (
    SELECT 1
    FROM race_pick_challenges challenge
    WHERE challenge.race_id = user_race_picks.race_id
      AND now() < challenge.qualifying_lock_at
  )
);

DROP POLICY IF EXISTS "Public can read race pit stop results" ON race_pit_stop_results;
CREATE POLICY "Public can read race pit stop results"
ON race_pit_stop_results
FOR SELECT
TO anon, authenticated
USING (true);

CREATE OR REPLACE FUNCTION public.score_position_pick(
  picked_driver_id TEXT,
  actual_position INTEGER,
  target_position INTEGER
)
RETURNS INTEGER
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE
    WHEN picked_driver_id IS NULL OR actual_position IS NULL OR target_position IS NULL THEN NULL
    WHEN actual_position = target_position THEN 3
    WHEN abs(actual_position - target_position) = 1 THEN 1
    ELSE 0
  END
$$;

CREATE OR REPLACE VIEW race_pick_scores AS
WITH qualifying_actual AS (
  SELECT race_id, driver_id, position
  FROM qualifying_results
  WHERE position IS NOT NULL
),
race_actual AS (
  SELECT race_id, driver_id, finish_position
  FROM race_results
  WHERE finish_position IS NOT NULL
),
fastest_lap_actual AS (
  SELECT DISTINCT ON (race_id) race_id, driver_id
  FROM race_results
  WHERE fastest_lap_rank = 1
  ORDER BY race_id, finish_position NULLS LAST, driver_id
),
scored AS (
  SELECT
    picks.user_id,
    profile.username,
    picks.race_id,
    challenge.season,
    challenge.round,
    public.score_position_pick(picks.qualifying_p1_driver_id, q1.position, 1) AS qualifying_p1_points,
    public.score_position_pick(picks.qualifying_p2_driver_id, q2.position, 2) AS qualifying_p2_points,
    public.score_position_pick(picks.qualifying_p3_driver_id, q3.position, 3) AS qualifying_p3_points,
    public.score_position_pick(picks.race_p1_driver_id, r1.finish_position, 1) AS race_p1_points,
    public.score_position_pick(picks.race_p2_driver_id, r2.finish_position, 2) AS race_p2_points,
    public.score_position_pick(picks.race_p3_driver_id, r3.finish_position, 3) AS race_p3_points,
    public.score_position_pick(picks.random_position_1_driver_id, rr1.finish_position, challenge.random_position_1) AS random_position_1_points,
    public.score_position_pick(picks.random_position_2_driver_id, rr2.finish_position, challenge.random_position_2) AS random_position_2_points,
    public.score_position_pick(picks.random_position_3_driver_id, rr3.finish_position, challenge.random_position_3) AS random_position_3_points,
    CASE WHEN pit.driver_id IS NULL THEN NULL WHEN picks.fastest_pit_stop_driver_id = pit.driver_id THEN 3 ELSE 0 END AS fastest_pit_stop_points,
    CASE WHEN lap.driver_id IS NULL THEN NULL WHEN picks.fastest_lap_driver_id = lap.driver_id THEN 3 ELSE 0 END AS fastest_lap_points
  FROM user_race_picks picks
  JOIN race_pick_challenges challenge ON challenge.race_id = picks.race_id
  LEFT JOIN user_profiles profile ON profile.user_id = picks.user_id
  LEFT JOIN qualifying_actual q1 ON q1.race_id = picks.race_id AND q1.driver_id = picks.qualifying_p1_driver_id
  LEFT JOIN qualifying_actual q2 ON q2.race_id = picks.race_id AND q2.driver_id = picks.qualifying_p2_driver_id
  LEFT JOIN qualifying_actual q3 ON q3.race_id = picks.race_id AND q3.driver_id = picks.qualifying_p3_driver_id
  LEFT JOIN race_actual r1 ON r1.race_id = picks.race_id AND r1.driver_id = picks.race_p1_driver_id
  LEFT JOIN race_actual r2 ON r2.race_id = picks.race_id AND r2.driver_id = picks.race_p2_driver_id
  LEFT JOIN race_actual r3 ON r3.race_id = picks.race_id AND r3.driver_id = picks.race_p3_driver_id
  LEFT JOIN race_actual rr1 ON rr1.race_id = picks.race_id AND rr1.driver_id = picks.random_position_1_driver_id
  LEFT JOIN race_actual rr2 ON rr2.race_id = picks.race_id AND rr2.driver_id = picks.random_position_2_driver_id
  LEFT JOIN race_actual rr3 ON rr3.race_id = picks.race_id AND rr3.driver_id = picks.random_position_3_driver_id
  LEFT JOIN race_pit_stop_results pit ON pit.race_id = picks.race_id
  LEFT JOIN fastest_lap_actual lap ON lap.race_id = picks.race_id
)
SELECT
  *,
  COALESCE(qualifying_p1_points, 0)
    + COALESCE(qualifying_p2_points, 0)
    + COALESCE(qualifying_p3_points, 0)
    + COALESCE(race_p1_points, 0)
    + COALESCE(race_p2_points, 0)
    + COALESCE(race_p3_points, 0)
    + COALESCE(random_position_1_points, 0)
    + COALESCE(random_position_2_points, 0)
    + COALESCE(random_position_3_points, 0)
    + COALESCE(fastest_pit_stop_points, 0)
    + COALESCE(fastest_lap_points, 0) AS total_points
FROM scored;

CREATE OR REPLACE VIEW race_pick_overall_scores AS
SELECT
  user_id,
  COALESCE(username, 'driver_' || substring(user_id::text, 1, 8)) AS username,
  COUNT(*)::INTEGER AS races_entered,
  SUM(total_points)::INTEGER AS total_points
FROM race_pick_scores
GROUP BY user_id, username;

GRANT SELECT ON race_pick_challenges TO anon, authenticated;
GRANT SELECT ON race_pit_stop_results TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON user_race_picks TO authenticated;
GRANT SELECT ON race_pick_scores TO anon, authenticated;
GRANT SELECT ON race_pick_overall_scores TO anon, authenticated;
