#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
node --env-file-if-exists=.env server.mjs &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT
sleep 2
if command -v open >/dev/null 2>&1; then open http://127.0.0.1:3777/creative
elif command -v xdg-open >/dev/null 2>&1; then xdg-open http://127.0.0.1:3777/creative
else echo "Open http://127.0.0.1:3777/creative in your browser."
fi
wait $PID
