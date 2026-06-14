#!/bin/bash
set -e

# Chat App Server Initialization Script
# Run this on a fresh Ubuntu/Debian server

PROJECT_DIR="/opt/chat-app"

echo "=== Updating system ==="
apt-get update
apt-get upgrade -y

echo "=== Installing Docker ==="
if ! command -v docker &> /dev/null; then
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

echo "=== Creating project directory ==="
mkdir -p "$PROJECT_DIR"

echo "=== Please copy project files to $PROJECT_DIR and create .env file ==="
echo "Example:"
echo "  cp -r /path/to/chat-app/* $PROJECT_DIR/"
echo "  cp $PROJECT_DIR/.env.example $PROJECT_DIR/.env"
echo "  nano $PROJECT_DIR/.env"
echo ""
echo "Then run:"
echo "  cd $PROJECT_DIR && docker compose up -d --build"
