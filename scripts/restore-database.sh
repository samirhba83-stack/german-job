#!/usr/bin/env bash
# M31 Phase 13 — real PostgreSQL restore, the counterpart to backup-database.sh. Restores into a
# TARGET container/database that must already exist and be empty (or `--clean` drops existing
# objects first — used deliberately for restore-drill verification against a disposable target,
# never pointed at a real environment's live database by default).
#
# Usage: ./scripts/restore-database.sh <container_name> <db_user> <db_name> <dump_file>
# Example: ./scripts/restore-database.sh restore-drill-postgres job_engine german_job_engine ./backups/german_job_engine_20260806T120000Z.dump

set -euo pipefail

CONTAINER="${1:?container name required}"
DB_USER="${2:?db user required}"
DB_NAME="${3:?db name required}"
DUMP_FILE="${4:?dump file path required}"

if [ ! -f "$DUMP_FILE" ]; then
  echo "ERROR: dump file not found: $DUMP_FILE" >&2
  exit 1
fi

echo "Restoring $DUMP_FILE into '$DB_NAME' on container '$CONTAINER' ..."
docker exec -i "$CONTAINER" pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner --no-privileges < "$DUMP_FILE"

echo "Restore complete."
