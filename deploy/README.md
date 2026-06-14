# Deployment Guide

## Quick Start (Local)

```bash
# From project root
cp .env.example .env
# Edit .env with strong JWT secrets
nano .env

docker compose up -d --build
```

Access the app at `http://localhost` (or your server IP).

## Production Setup

1. Copy project files to server (e.g., `/opt/chat-app`).
2. Run `deploy/init.sh` or manually install Docker.
3. Create `.env` from `.env.example` with strong secrets.
4. Update firewall to allow ports 22, 80, 443.
5. Run `docker compose up -d --build`.

## TLS (Recommended)

For production, place an SSL terminating reverse proxy (e.g., Nginx, Caddy, Cloudflare) in front of the `frontend` service.

## Backup

Back up the Docker volume `chat-app_postgres_data` regularly:

```bash
docker run --rm -v chat-app_postgres_data:/data -v /backup:/backup alpine tar czf /backup/postgres-$(date +%Y%m%d).tar.gz -C /data .
```

## Update

```bash
cd /opt/chat-app
docker compose down
docker compose up -d --build
```
