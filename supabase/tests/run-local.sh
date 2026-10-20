#!/usr/bin/env bash
# Builds the 242Konnect schema on a throwaway local PostgreSQL — the Supabase
# stand-in, every committed migration in order, three test accounts — then
# runs the adversarial security tests. Never touches the live project.
#
#   PGHOST=/tmp PGPORT=54329 PGUSER=postgres bash supabase/tests/run-local.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
db="konnect_security_$$"
createdb "$db"
trap 'dropdb --if-exists "$db" >/dev/null 2>&1 || true' EXIT
run() { psql -v ON_ERROR_STOP=1 -q -X -d "$db" -f "$1" > /dev/null; }
run "$here/local/supabase_shim.sql"
run "$here/local/pre_migration_objects.sql"
for m in "$here"/../migrations/*.sql; do
  # SKIP_MIGRATION=<pattern> rebuilds without one migration, to show which
  # tests depend on it (a test that passes either way proves nothing).
  if [ -n "${SKIP_MIGRATION:-}" ] && [[ "$m" == *"$SKIP_MIGRATION"* ]]; then continue; fi
  run "$m"
done
run "$here/local/seed.sql"
if [ -n "${PROPOSED:-}" ]; then
  # Also apply the changes awaiting a decision, and run their own tests.
  for m in "$here"/../proposed/*.sql; do run "$m"; done
  psql -X -d "$db" -A -F ' | ' -t -f "$here/proposed_verified_payments_tests.sql"
fi
out="$(psql -v ON_ERROR_STOP=0 -X -d "$db" -A -F ' | ' -t -f "$here/security_tests.sql")"
echo "$out" | grep -E '^\s*[0-9]+ \|' || true
fails="$(echo "$out" | grep -cE '^\s*[0-9]+ \| f \|' || true)"
total="$(echo "$out" | grep -cE '^\s*[0-9]+ \|' || true)"
echo
echo "$((total - fails)) passed, $fails failed"
[ "$total" -gt 0 ] && [ "$fails" -eq 0 ]
