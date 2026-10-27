# Post-race automation

`post-race-refresh.yml` checks the committed race calendar every two hours. From
three hours until seven days after a race, it fetches Jolpica results. Fewer than
ten classified drivers postpones publication. Its first successful run publishes
results, standings, Picks inputs, and a new home-page race. A later run attempts
the FastF1, OpenF1, canonical, telemetry, Compare, Analysis, strategy, and Race
Week build. It retries until all required enriched views validate. OpenF1 gaps
are reported by the existing quality reports; FastF1 telemetry and the race
analysis are required for the enriched stage.

## One-time setup

1. Create a **private** Supabase Storage bucket named `f1-insightx-pipeline`, or
   set the GitHub repository variable `PIPELINE_STORAGE_BUCKET` to its name.
   The bucket must allow 5 MB objects and have enough space for the pipeline
   archive. Restrict access to the service role.
2. Configure GitHub secrets `DATABASE_URL`, `SUPABASE_URL`, and
   `SUPABASE_SERVICE_ROLE_KEY`. The workflow uses its `contents: write` GitHub
   token to push normal commits to `main`. Configure the repository
   variable `PRODUCTION_BASE_URL` with the deployed site origin. Optional
   `JOLPICA_BASE_URL` overrides the reference API endpoint.
3. On a machine with the current historical `data/raw`, `data/staged`, and
   generated product files, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`,
   then run `python data/automation_storage.py save`. This seeds the private
   archive before the first scheduled job. The command is safe to rerun and
   uploads only changed files. Keep raw archives out of git.
4. Trigger **Post Race Refresh** with `workflow_dispatch` after seeding to
   confirm the configuration. Outside a post-race window it exits without a
   publish. A failed scheduled run is retried at the next two-hour interval.
   For an older race or corrected result, enter its `race_id` and select
   `force` to rebuild a completed enriched release.

The archive stores each file as immutable, checksum-verified 5 MB chunks. The
manifest is updated only after all changed chunks upload. The release-state
object records the completed stage for each race. If verification or deployment
fails, the stage remains pending and the next run repeats it. Do not use
`--allow-destructive-reset` for scheduled loads; the loader uses a transaction
and non-destructive upserts.

## Publish behavior

The data job validates the local views, builds the site, writes to Supabase,
then commits only `src/data/season.ts`, qualifying fallback data,
`data/season_state.json`, and compact quality reports. It pushes a normal
commit to `main`, preserving Lovable history. The deployment check waits for
`/api/data-release` to report the exact new snapshot, then checks the home,
Race Week, Analysis, Compare, Picks, and Championship routes. A failed check
leaves the stage pending and the GitHub job red.

The existing race-week session job shares a publish lock with the post-race job
and restores the same archive before loading. The older reference-fetch job is
manual and does not publish to Supabase.

Current route queries are scoped to the 2026 season. Before the 2027 season,
update the season selector, fallback portraits, and calendar seed as a separate
release; this automation does not infer a new season from the calendar alone.
