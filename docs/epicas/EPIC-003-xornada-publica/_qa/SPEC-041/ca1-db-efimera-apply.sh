#!/bin/sh
# apply.sh <migrations dir> [upto-exclusive-basename]: recreate the DB, stubs, then the migrations
# without the extensions the plain image lacks (pg_cron, pg_net, supabase_vault: stubbed).
set -e
docker exec spec041-pg psql -q -U postgres -d template1 -c "drop database if exists t041 with (force)" -c "create database t041"
docker exec -i spec041-pg psql -q -U postgres -d t041 < 00_stubs.sql 2>&1 | grep -v "already exists" || true
for f in "$1"/*.sql; do
  b=$(basename "$f")
  [ -n "$2" ] && [ "$b" = "$2" ] && break
  case "$b" in *_extensions.sql) continue;; esac
  echo "== $b"
  grep -viE "create extension if not exists (pg_cron|pg_net|supabase_vault)" "$f" | docker exec -i spec041-pg psql -q -v ON_ERROR_STOP=1 -U postgres -d t041
done
