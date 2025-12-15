#!/bin/bash

# 部署配置
DOMAIN="layman.xin"
PROJECT_ROOT=$(pwd)
WEB_DIR="/var/www/$DOMAIN"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 错误处理
set -e

# 检查是否以 root 运行
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}请使用 sudo 或 root 权限运行此脚本${NC}"
  exit 1
fi

echo -e "${GREEN}开始部署 $DOMAIN ...${NC}"

# 1. 更新系统
echo -e "${GREEN}[1/6] 更新系统软件包...${NC}"
apt update && apt upgrade -y

# 2. 安装必要依赖
echo -e "${GREEN}[2/6] 安装 Nginx, Git, Curl...${NC}"
apt install -y nginx git curl

# 3. 安装 Node.js (LTS)
if ! command -v node &> /dev/null; then
    echo -e "${GREEN}[3/6] 安装 Node.js...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
else
    echo -e "${GREEN}[3/6] Node.js 已安装: $(node -v)${NC}"
fi

# 4. 构建项目
echo -e "${GREEN}[4/6] 安装依赖并构建项目...${NC}"
# 确保在项目根目录
if [ ! -f "package.json" ]; then
    echo -e "${RED}错误: 未找到 package.json。请在项目根目录下运行此脚本。${NC}"
    exit 1
fi

npm install
npm run build

# 5. 部署文件
echo -e "${GREEN}[5/6] 部署文件到 $WEB_DIR ...${NC}"
mkdir -p $WEB_DIR
# 清空目标目录（保留目录本身）
rm -rf $WEB_DIR/*
# 复制构建产物
cp -r dist/* $WEB_DIR/
# 设置权限
chown -R www-data:www-data $WEB_DIR
chmod -R 755 $WEB_DIR

# 6. 配置 Nginx
echo -e "${GREEN}[6/6] 配置 Nginx...${NC}"
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"

cat > $NGINX_CONF <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    root $WEB_DIR;
    index index.html;

    # Gzip Compression
    gzip on;
    gzip_min_length 1k;
    gzip_buffers 4 16k;
    gzip_comp_level 2;
    gzip_types text/plain application/javascript application/x-javascript text/css application/xml text/javascript application/x-httpd-php image/jpeg image/gif image/png;
    gzip_vary on;
    gzip_disable "MSIE [1-6]\.";

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # 缓存静态资源
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
EOF

# 启用站点
ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
# 移除默认站点（可选，防止冲突）
rm -f /etc/nginx/sites-enabled/default

# 测试并重载 Nginx
nginx -t
systemctl reload nginx

echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}部署成功!${NC}"
echo -e "访问地址: http://$DOMAIN"
echo -e "${GREEN}==============================================${NC}"
echo -e "提示: 如果需要配置 HTTPS，请运行以下命令:"
echo -e "sudo apt install -y certbot python3-certbot-nginx"
echo -e "sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
