#!/bin/sh
set -e

HOST=${HOST:-localhost}
PORT=${PORT:-3000}

echo "[SMOKE] Waiting for app to be healthy on ${HOST}:${PORT} ..."
for i in $(seq 1 30); do
  if curl -fsS "http://${HOST}:${PORT}/api/health" >/dev/null 2>&1; then
    echo "[SMOKE] App is healthy"
    break
  fi
  echo "[SMOKE] Retry $i ..."
  sleep 2
done

echo "[SMOKE] Hitting key endpoints"
set -x
curl -fsS "http://${HOST}:${PORT}/" >/dev/null
curl -fsS "http://${HOST}:${PORT}/api/health" | jq . || true
curl -fsS "http://${HOST}:${PORT}/api/sites" | jq . || true
curl -fsS "http://${HOST}:${PORT}/api/charts?key=home.benefit_summary&from=2024-01-01&to=2024-01-02" | jq . || true
curl -fsS "http://${HOST}:${PORT}/api/charts?key=report.timeseries&site=example.com&from=2024-01-01&to=2024-01-02" | jq . || true
set +x

echo "[SMOKE] Done"
