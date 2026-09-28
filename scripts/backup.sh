#!/usr/bin/env bash
# Backup completo de la base de datos con pg_dump.
#
# Uso:
#   DATABASE_URL='postgres://usuario:contraseña@host/db' ./scripts/backup.sh
#
# La URL EXTERNA de la base de datos está en el dashboard de Render:
# hexagonal-pacifico-db -> Info -> External Database URL.
#
# El backup se guarda en backups/ (ignorado por git) en formato custom de
# PostgreSQL. Para restaurarlo:
#   pg_restore --clean --if-exists -d "$DATABASE_URL" backups/<archivo>.dump
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: define DATABASE_URL con la URL externa de la base de datos." >&2
  exit 1
fi

cd "$(dirname "$0")/.."
mkdir -p backups
STAMP="$(date +%Y-%m-%d-%H%M%S)"
OUT="backups/hexagonal-pacifico-${STAMP}.dump"

pg_dump --format=custom --no-owner --no-privileges --file "$OUT" "$DATABASE_URL"

echo "Backup guardado en ${OUT} ($(du -h "$OUT" | cut -f1))"
