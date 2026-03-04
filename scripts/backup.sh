#!/bin/sh
# Inferno Domini — Automated PostgreSQL backup
# Runs pg_dump, compresses with gzip, retains last 7 days

set -e

BACKUP_DIR="/backups"
DATE=$(date +%Y-%m-%d_%H%M%S)
FILENAME="inferno_domini_${DATE}.sql.gz"

echo "[backup] Starting backup: ${FILENAME}"

pg_dump -h db -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip > "${BACKUP_DIR}/${FILENAME}"

echo "[backup] Backup complete: ${FILENAME} ($(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1))"

# Cleanup: remove backups older than 7 days
find "${BACKUP_DIR}" -name "inferno_domini_*.sql.gz" -mtime +7 -delete

echo "[backup] Cleanup done. Current backups:"
ls -lh "${BACKUP_DIR}"/inferno_domini_*.sql.gz 2>/dev/null || echo "  (none)"
