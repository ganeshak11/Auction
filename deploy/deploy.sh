#!/bin/bash
set -euo pipefail

#============================================================
# Deploy Script for Auction Platform
# Pulls latest code, installs deps, builds, and restarts
# Usage: cd ~/Auction && ./deploy/deploy.sh
#============================================================

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "=== Pulling latest code ==="
git pull origin main

echo "=== Installing server dependencies ==="
cd "$PROJECT_DIR/server"
npm install

echo "=== Copying production env ==="
if [ -f .env.production ]; then
  cp .env.production .env
  echo "Copied .env.production -> .env"
else
  echo "WARNING: No .env.production found in server/. Using existing .env"
fi

echo "=== Running Prisma migrations ==="
npx prisma db push

echo "=== Generating Prisma client ==="
npx prisma generate

echo "=== Seeding database (if needed) ==="
npm run db:seed || echo "Seed skipped or already done"

echo "=== Building server ==="
npm run build

echo "=== Installing client dependencies ==="
cd "$PROJECT_DIR/client"
npm install

echo "=== Copying client production env ==="
if [ -f .env.production ]; then
  cp .env.production .env.local
  echo "Copied .env.production -> .env.local"
else
  echo "WARNING: No .env.production found in client/. Using existing .env.local"
fi

echo "=== Building Next.js client ==="
npm run build

echo "=== Starting/Restarting PM2 processes ==="
cd "$PROJECT_DIR"
pm2 start deploy/ecosystem.config.js --env production || pm2 restart all

echo "=== Saving PM2 process list ==="
pm2 save

echo ""
echo "============================================"
echo "  Deployment complete!"
echo "============================================"
echo ""
echo "  pm2 status      - Check process health"
echo "  pm2 logs         - View live logs"
echo "  pm2 monit        - Monitor resources"
echo ""
