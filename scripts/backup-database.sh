#!/usr/bin/env bash
# M31 Phase 13 — real PostgreSQL backup, using pg_dump's custom format (compressed, supports
# selective/parallel restore via pg_restore — not a plain-SQL dump). Runs pg_dump INSIDE the
# target Postgres container (avoids needing pg_dump installed on the host/CI runner) — works
# against any docker-compose-managed Postgres service by container name.
#
# Usage: ./scripts/backup-database.sh <container_name> <db_user> <db_name> <output_dir>
# Example: ./scripts/backup-database.sh german-job-engine-postgres-1 job_engine german_job_engine ./backups

set -euo pipefail

CONTAINER="${1:?container name required}"
DB_USER="${2:?db user required}"
DB_NAME="${3:?db name required}"
OUTPUT_DIR="${4:-./backups}"

mkdir -p "$OUTPUT_DIR"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUTPUT_FILE="$OUTPUT_DIR/${DB_NAME}_${TIMESTAMP}.dump"

echo "Backing up '$DB_NAME' from container '$CONTAINER' to $OUTPUT_FILE ..."
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --format=custom --compress=9 > "$OUTPUT_FILE"

SIZE=$(wc -c < "$OUTPUT_FILE")
if [ "$SIZE" -lt 1000 ]; then
  echo "ERROR: backup file is suspiciously small ($SIZE bytes) — treating as a failed backup." >&2
  exit 1
fi

echo "Backup complete: $OUTPUT_FILE ($SIZE bytes)"
