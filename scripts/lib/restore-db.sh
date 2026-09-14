# Sourced by scripts/restore.sh and scripts/verify-backup.sh — not run directly.
#
# restore_db_dump <db.sql.gz> <psql command...>
#
# Replays a `pg_dump --clean --if-exists` plain dump in two phases:
#
#  1. The DROP section, errors tolerated. `--if-exists` does not cover the
#     table a policy hangs off: `DROP POLICY IF EXISTS p ON public.t` still
#     fails when public.t itself is missing — i.e. on any fresh or partially
#     initialised database, which is exactly the disaster-recovery case.
#     Feeding the whole dump through ON_ERROR_STOP=1 aborted on the first
#     such line and restored nothing.
#  2. Everything from the first CREATE on, with ON_ERROR_STOP=1 in a single
#     transaction: it either restores completely or changes nothing further.
#
# The dump's leading SET/set_config lines (search_path etc.) are replayed
# before both phases, since each phase is a separate psql session.
restore_db_dump() {
  local dump="$1"; shift
  local work; work="$(mktemp -d)"

  gunzip -c "$dump" | awk -v dir="$work" '
    BEGIN { phase = "header" }
    phase == "header" && /^(DROP|ALTER TABLE IF EXISTS)/ { phase = "clean" }
    phase != "body"   && /^CREATE /                      { phase = "body" }
    { print > (dir "/" phase ".sql") }
  '
  [[ -s "$work/header.sql" && -s "$work/body.sql" ]] \
    || { echo "[restore] ERROR: $dump does not look like a pg_dump plain dump" >&2; rm -rf "$work"; return 1; }
  touch "$work/clean.sql"

  local clean_errors
  clean_errors=$(cat "$work/header.sql" "$work/clean.sql" | "$@" -v ON_ERROR_STOP=0 -q 2>&1 >/dev/null | grep -c '^ERROR' || true)
  echo "[restore] clean phase: $clean_errors statement(s) skipped (objects absent on the target — expected on a fresh database)"

  local rc=0
  cat "$work/header.sql" "$work/body.sql" | "$@" -v ON_ERROR_STOP=1 -q --single-transaction >/dev/null || rc=$?
  rm -rf "$work"
  return $rc
}
