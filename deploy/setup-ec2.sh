#!/bin/bash
set -euo pipefail

#============================================================
# EC2 Setup Script for Auction Platform
# Run on a fresh Ubuntu 22.04/24.04 EC2 instance
# Usage: chmod +x setup-ec2.sh && sudo ./setup-ec2.sh
#============================================================

echo "=== Updating system packages ==="
apt-get update && apt-get upgrade -y

echo "=== Installing Node.js 20 LTS ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"

echo "=== Installing PostgreSQL 16 ==="
apt-get install -y gnupg2 lsb-release
echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
apt-get update
apt-get install -y postgresql-16

echo "=== Starting PostgreSQL ==="
systemctl start postgresql
systemctl enable postgresql

echo "=== Creating database and user ==="
read -sp "Enter password for auction_user: " DB_PASSWORD
echo

sudo -u postgres psql <<EOF
CREATE USER auction_user WITH PASSWORD '${DB_PASSWORD}';
CREATE DATABASE auction_db OWNER auction_user;
GRANT ALL PRIVILEGES ON DATABASE auction_db TO auction_user;
EOF

echo "=== Installing PM2 globally ==="
npm install -g pm2

echo "=== Installing Nginx ==="
apt-get install -y nginx

echo "=== Installing Git ==="
apt-get install -y git

echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Clone your repo:  git clone <your-repo-url> ~/Auction"
echo "  2. Copy nginx config: sudo cp ~/Auction/deploy/nginx.conf /etc/nginx/sites-available/auction"
echo "  3. Enable site:       sudo ln -s /etc/nginx/sites-available/auction /etc/nginx/sites-enabled/"
echo "  4. Remove default:    sudo rm /etc/nginx/sites-enabled/default"
echo "  5. Test nginx:        sudo nginx -t && sudo systemctl restart nginx"
echo "  6. Configure .env.production files with your EC2 IP and credentials"
echo "  7. Run deploy script: cd ~/Auction && chmod +x deploy/deploy.sh && ./deploy/deploy.sh"
echo ""
