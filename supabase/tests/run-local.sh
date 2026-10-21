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
out="$(psql -v ON_ERROR_STOP=0 -X -d "$db" -A -F ' | ' -t -f "$here/security_tests.sql")"
# The other test files number their rows from 1 again; prefixed so the lists read.
out="$out
$(psql -v ON_ERROR_STOP=0 -X -d "$db" -A -F ' | ' -t -f "$here/payment_tests.sql" 2>&1 | sed -E 's/^ *([0-9]+) \|/P\1 |/')
$(psql -v ON_ERROR_STOP=0 -X -d "$db" -A -F ' | ' -t -f "$here/provider_workspace_tests.sql" 2>&1 | sed -E 's/^ *([0-9]+) \|/W\1 |/')"
echo "$out" | grep -E '^\s*[PW]?[0-9]+ \|' || true
fails="$(echo "$out" | grep -cE '^\s*[PW]?[0-9]+ \| f \|' || true)"
# A payment test block that aborts prints no rows; count the error instead.
fails=$((fails + $(echo "$out" | grep -c 'ERROR:' || true)))
total="$(echo "$out" | grep -cE '^\s*[PW]?[0-9]+ \|' || true)"
echo
echo "$((total - fails)) passed, $fails failed"
[ "$total" -gt 0 ] && [ "$fails" -eq 0 ]
