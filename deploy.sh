#!/usr/bin/env bash
# deploy.sh — deploy titikrusak.id (production VPS / local).
# Cara pakai:  bash deploy.sh          (dari direktori mana pun)
#
# Yang dikerjakan (urut):
#   1. git pull (ff-only) dari origin/main
#   2. npm install backend + frontend (ci, fallback install)
#   3. build frontend (vite -> dist)
#   4. migrasi skema DB + seed laporan media (idempotent, aman diulang)
#   5. restart backend (pm2 "titikrusak-backend" jika ada; fallback kill+nohup)
#
# Catatan: VPS memakai nvm + pm2 — script otomatis memakai PATH nvm bila npm
# tidak ada di PATH. Node >= 20 dibutuhkan (vite 5).

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"
echo "==> titikrusak.id deploy — repo: $REPO_DIR"

# ---- Node/npm: PATH yang ada, fallback ke nvm (VPS root) ----
if ! command -v npm >/dev/null 2>&1; then
  for NVM_BIN in /root/.nvm/versions/node/*/bin; do
    if [ -x "$NVM_BIN/npm" ]; then
      export PATH="$NVM_BIN:$PATH"
      break
    fi
  done
fi
command -v npm >/dev/null 2>&1 || { echo "ERROR: npm tidak ditemukan (pasang node/nvm dulu)"; exit 1; }
echo "==> node $(node -v) | npm $(npm -v)"

# ---- 1. Tarik kode terbaru ----
echo "==> [1/5] git pull"
git pull --ff-only origin main

# ---- 2. Dependensi ----
echo "==> [2/5] npm install (backend + frontend)"
(cd backend && (npm ci --silent || npm install --silent))
(cd frontend && (npm ci --silent || npm install --silent))

# ---- 3. Build frontend ----
echo "==> [3/5] build frontend"
(cd frontend && npm run build)

# ---- 4. Migrasi skema + seed media (idempotent) ----
echo "==> [4/5] migrasi skema DB + seed laporan media"
(cd backend && node scripts/migrate-infra-types.js)
(cd backend && node scripts/seed-media-reports.js)

# ---- 5. Restart backend ----
echo "==> [5/5] restart backend"
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart titikrusak-backend
elif [ -n "${PM2_HOME:-}" ] && [ -x "$PM2_HOME/pm2" ]; then
  "$PM2_HOME/pm2" restart titikrusak-backend
else
  echo "    (pm2 tidak ditemukan — fallback: kill + nohup)"
  PID="$(ss -tlnp 2>/dev/null | grep ':3000' | grep -oP 'pid=\K[0-9]+' | head -1 || true)"
  [ -n "${PID:-}" ] && kill "$PID" 2>/dev/null || true
  sleep 1
  (cd backend && nohup node server.js > server.log 2>&1 &)
  sleep 2
fi

# ---- Verifikasi singkat (tunggu backend boot sampai 10 detik) ----
echo "==> selesai. Verifikasi:"
CODE="000"
for _ in $(seq 1 10); do
  CODE="$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/reports || echo 000)"
  [ "$CODE" = "200" ] && break
  sleep 1
done
echo "    api :3000 -> $CODE"
curl -s -o /dev/null -w "    api via nginx -> %{http_code}\n" https://titikrusak.id/api/reports 2>/dev/null || true
echo "    (cek https://titikrusak.id di browser)"
