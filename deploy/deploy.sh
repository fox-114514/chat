#!/bin/bash
set -e

# =============================================================================
# 私有聊天室 - 服务端一键部署脚本
# =============================================================================
# 用法：
#   1. 把项目代码上传到服务器（例如 /opt/chat-app）
#   2. cd /opt/chat-app
#   3. bash deploy/deploy.sh
# =============================================================================

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env"
REQUIRED_COMMANDS="docker docker-compose"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[OK]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否以 root 运行
check_root() {
  if [[ $EUID -ne 0 ]]; then
    log_warn "建议以 root 用户运行此脚本，否则可能无法安装 Docker 或开放端口"
    read -p "是否继续？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi
}

# 安装 Docker 和 Docker Compose
install_docker() {
  if command -v docker &> /dev/null && docker compose version &> /dev/null; then
    log_success "Docker 和 Docker Compose 已安装"
    return 0
  fi

  log_info "正在安装 Docker 和 Docker Compose..."
  apt-get update
  apt-get install -y ca-certificates curl gnupg lsb-release

  mkdir -p /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  systemctl enable docker
  systemctl start docker

  log_success "Docker 和 Docker Compose 安装完成"
}

# 生成随机字符串
generate_secret() {
  openssl rand -base64 48 | tr -d '\n+/=' | cut -c1-64
}

# 创建 .env 文件
setup_env() {
  if [[ -f "$ENV_FILE" ]]; then
    log_info "发现已存在的 .env 文件"
    read -p "是否重新生成 JWT 密钥？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      log_info "保留现有 .env 配置"
      return 0
    fi
  fi

  log_info "创建 .env 配置文件..."

  local jwt_secret
  local jwt_refresh_secret
  local postgres_password

  jwt_secret=$(generate_secret)
  jwt_refresh_secret=$(generate_secret)
  postgres_password=$(openssl rand -base64 24 | tr -d '\n+/=' | cut -c1-32)

  cat > "$ENV_FILE" <<EOF
# PostgreSQL
POSTGRES_USER=chat
POSTGRES_PASSWORD=${postgres_password}
POSTGRES_DB=chat

# JWT secrets (auto-generated, at least 64 chars)
JWT_SECRET=${jwt_secret}
JWT_REFRESH_SECRET=${jwt_refresh_secret}

# Bcrypt
BCRYPT_ROUNDS=12

# CORS (use your domain in production, e.g. https://chat.example.com)
CORS_ORIGIN=*

# File upload max size in bytes (default 20MB)
FILE_UPLOAD_MAX_BYTES=20971520

# Public HTTP port
HTTP_PORT=80
EOF

  log_success ".env 文件已创建"
  log_warn "请检查 ${ENV_FILE} 中的配置，必要时修改 POSTGRES_PASSWORD、CORS_ORIGIN 和 HTTP_PORT"
}

# 配置防火墙
setup_firewall() {
  if ! command -v ufw &> /dev/null; then
    log_warn "未检测到 ufw，跳过防火墙配置"
    return 0
  fi

  log_info "配置防火墙..."
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp

  # 如果已启用则先禁用再启用，避免规则冲突
  ufw --force disable
  ufw --force enable

  log_success "防火墙已配置（开放 22/80/443）"
}

# 启动服务
start_services() {
  log_info "开始构建并启动服务..."
  cd "$PROJECT_DIR"
  docker compose down --remove-orphans || true
  docker compose up -d --build

  log_info "等待数据库就绪..."
  sleep 5

  local retries=30
  local count=0
  while [[ $count -lt $retries ]]; do
    if docker compose ps | grep -q "healthy"; then
      log_success "所有服务已启动"
      return 0
    fi
    count=$((count + 1))
    log_info "等待服务启动... (${count}/${retries})"
    sleep 2
  done

  log_error "服务启动超时，请检查日志：docker compose logs -f"
  exit 1
}

# 健康检查
health_check() {
  log_info "执行健康检查..."

  local http_port
  http_port=$(grep '^HTTP_PORT=' "$ENV_FILE" | cut -d '=' -f2 | tr -d '"')
  http_port=${http_port:-80}

  local server_ip
  server_ip=$(hostname -I | awk '{print $1}')

  if curl -sf "http://localhost:${http_port}/api/health" > /dev/null; then
    log_success "健康检查通过"
    echo
    log_success "部署完成！"
    echo
    echo -e "  本地访问：${GREEN}http://localhost:${http_port}${NC}"
    echo -e "  外网访问：${GREEN}http://${server_ip}:${http_port}${NC}"
    echo
    log_info "查看日志：docker compose logs -f"
    log_info "停止服务：docker compose down"
    log_info "备份数据：请参阅 README.md 备份章节"
  else
    log_error "健康检查失败"
    log_info "请查看日志：docker compose logs -f"
    exit 1
  fi
}

# 主流程
main() {
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}  私有聊天室 - 服务端一键部署脚本${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo

  check_root
  install_docker
  setup_env
  setup_firewall
  start_services
  health_check
}

main "$@"
