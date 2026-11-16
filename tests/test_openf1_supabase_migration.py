from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "supabase/migrations/202611150001_openf1_source_migration.sql"


def migration_sql() -> str:
    return MIGRATION.read_text(encoding="utf-8").lower()


def test_migration_is_additive_transactional_and_keeps_compatibility_view() -> None:
    sql = migration_sql()
    assert sql.startswith("begin;")
    assert sql.rstrip().endswith("commit;")
    assert "add column if not exists source_provider" in sql
    assert "rename to session_prediction_snapshots" in sql
    assert "with (security_invoker = true)" in sql
    assert "as select * from public.session_prediction_snapshots" in sql
    assert "delete from" not in sql
    assert "truncate" not in sql


def test_release_metadata_stays_service_role_only() -> None:
    sql = migration_sql()
    assert "alter table public.data_pipeline_releases enable row level security" in sql
    assert "revoke all on public.data_pipeline_releases from anon, authenticated" in sql
    assert "grant all on public.data_pipeline_releases to service_role" in sql
