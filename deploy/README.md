# AWS EC2 Deployment Guide

Deploy the Auction platform on a single AWS EC2 instance with local PostgreSQL.

## Prerequisites

- An AWS account
- An EC2 instance running **Ubuntu 22.04 or 24.04**
- An SSH key pair to connect to the instance
- Security group allowing inbound traffic on ports: **22** (SSH), **80** (HTTP), **3001** (API, optional if using Nginx)
- Google OAuth credentials from [Google Cloud Console](https://console.cloud.google.com/)

## 1. Launch EC2 Instance

1. Go to the AWS Console → EC2 → Launch Instance
2. Choose **Ubuntu Server 22.04 LTS** (or 24.04)
3. Instance type: **t2.small** (2 GB RAM recommended) or larger
4. Configure security group:
   - SSH (22) from your IP
   - HTTP (80) from anywhere
   - Custom TCP (3001) from anywhere _(optional, for direct API access)_
5. Launch and download the key pair

## 2. Connect & Run Setup

```bash
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>

# Upload and run the setup script
git clone <your-repo-url> ~/Auction
cd ~/Auction
chmod +x deploy/setup-ec2.sh
sudo ./deploy/setup-ec2.sh
```

The setup script will:
- Install Node.js 20, PostgreSQL 16, PM2, Nginx, Git
- Create the `auction_db` database and `auction_user` role
- Prompt you for a database password

## 3. Configure Nginx

```bash
sudo cp ~/Auction/deploy/nginx.conf /etc/nginx/sites-available/auction
sudo ln -s /etc/nginx/sites-available/auction /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

## 4. Configure Environment Variables

### Server (`server/.env.production`)

Edit the file and replace placeholders:

```bash
cd ~/Auction/server
nano .env.production
```

Replace:
- `<STRONG_PASSWORD>` → the password you set during setup
- `<your-google-client-id>` → your Google OAuth Client ID
- `<your-google-client-secret>` → your Google OAuth Client Secret
- `<GENERATE_A_STRONG_SECRET>` → run `openssl rand -hex 32` to generate
- `<EC2_PUBLIC_IP>` → your EC2 instance's public IP

### Client (`client/.env.production`)

```bash
cd ~/Auction/client
nano .env.production
```

Replace `<EC2_PUBLIC_IP>` with your instance's public IP.

## 5. Update Google OAuth

Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials:

1. Edit your OAuth 2.0 Client
2. Add **Authorized redirect URI**: `http://<EC2_PUBLIC_IP>/auth/google/callback`
3. Add **Authorized JavaScript origin**: `http://<EC2_PUBLIC_IP>`

## 6. Deploy

```bash
cd ~/Auction
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

## 7. Verify

```bash
# Check PM2 processes
pm2 status

# Check server health
curl http://localhost:3001/health

# Check Nginx
sudo systemctl status nginx

# Check PostgreSQL
sudo systemctl status postgresql

# View logs
pm2 logs
```

Then open `http://<EC2_PUBLIC_IP>` in your browser.

## Redeployment

After pushing new code, SSH in and run:

```bash
cd ~/Auction && ./deploy/deploy.sh
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| PostgreSQL won't start | `sudo systemctl status postgresql` / check logs at `/var/log/postgresql/` |
| Nginx 502 Bad Gateway | Check PM2 is running: `pm2 status` |
| Google OAuth redirect fails | Verify callback URL in Google Console matches `http://<IP>/auth/google/callback` |
| Socket.io connection fails | Ensure Nginx config has WebSocket upgrade headers |
| Port 3001 not accessible | Check EC2 security group allows inbound on 3001 |
