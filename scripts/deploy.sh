#!/bin/bash
# ─── EC2 Deploy Script ──────────────────────────────────────────────────
# Usage: bash deploy.sh <production|staging>
# Called by GitHub Actions via SSM, or manually on the server.
# Place this file at /home/ubuntu/deploy.sh on your EC2 instance.
# ─────────────────────────────────────────────────────────────────────────

set -euo pipefail

APP_ENV="${1:-}"

if [ -z "$APP_ENV" ]; then
  echo "ERROR: Usage: deploy.sh <production|staging>"
  exit 1
fi

# ─── Paths ───────────────────────────────────────────────────────────────
if [ "$APP_ENV" = "production" ]; then
  APP_DIR="/home/ubuntu/Digital-Diary-API"
  BRANCH="main"
  PM2_API="diary-api-production"
  PM2_WORKER="diary-worker-production"
elif [ "$APP_ENV" = "staging" ]; then
  APP_DIR="/home/ubuntu/Digital-Diary-API-staging"
  BRANCH="staging"
  PM2_API="diary-api-staging"
  PM2_WORKER="diary-worker-staging"
else
  echo "ERROR: APP_ENV must be 'production' or 'staging', got '$APP_ENV'"
  exit 1
fi

echo "═══════════════════════════════════════════════════════"
echo " Deploying [$APP_ENV] from branch [$BRANCH]"
echo " Directory: $APP_DIR"
echo "═══════════════════════════════════════════════════════"

cd "$APP_DIR"

# ─── Pull latest code ────────────────────────────────────────────────────
echo "[1/5] Pulling latest from origin/$BRANCH..."
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

# ─── Install dependencies ───────────────────────────────────────────────
echo "[2/5] Installing dependencies..."
npm ci --omit=dev

# ─── Build ───────────────────────────────────────────────────────────────
echo "[3/5] Building TypeScript..."
npm run build

# ─── Restart PM2 processes ───────────────────────────────────────────────
echo "[4/5] Restarting PM2 processes..."
pm2 restart "$PM2_API" --update-env || pm2 start ecosystem.config.js --only "$PM2_API"
pm2 restart "$PM2_WORKER" --update-env || pm2 start ecosystem.config.js --only "$PM2_WORKER"

# ─── Save PM2 state ─────────────────────────────────────────────────────
echo "[5/5] Saving PM2 process list..."
pm2 save

echo ""
echo "Deploy complete! [$APP_ENV] is now running."
pm2 list
