#!/bin/bash

# Debian Server Setup Script for LLM App
# This script prepares a Debian server for production deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root"
fi

log "Starting Debian server setup for LLM App..."

# Update system
log "Updating system packages..."
apt update && apt upgrade -y

# Install essential packages
log "Installing essential packages..."
apt install -y \
    curl \
    wget \
    git \
    vim \
    htop \
    ufw \
    fail2ban \
    nginx \
    certbot \
    python3-certbot-nginx \
    unzip \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release

# Install Docker
log "Installing Docker..."
curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Install Docker Compose
log "Installing Docker Compose..."
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Add user to docker group
log "Adding user to docker group..."
usermod -aG docker $SUDO_USER

# Install NVIDIA Docker (if NVIDIA GPU is available)
if command -v nvidia-smi &> /dev/null; then
    log "NVIDIA GPU detected, installing NVIDIA Docker..."
    
    # Install NVIDIA Container Toolkit
    distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
    curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | apt-key add -
    curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | tee /etc/apt/sources.list.d/nvidia-docker.list
    
    apt update
    apt install -y nvidia-docker2
    systemctl restart docker
else
    warn "No NVIDIA GPU detected. Ollama will run on CPU only."
fi

# Configure firewall
log "Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw --force enable

# Configure fail2ban
log "Configuring fail2ban..."
cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 3
EOF

systemctl enable fail2ban
systemctl restart fail2ban

# Create application directory
log "Creating application directory..."
APP_DIR="/opt/llm-app"
mkdir -p $APP_DIR
chown $SUDO_USER:$SUDO_USER $APP_DIR

# Create systemd service for auto-start
log "Creating systemd service..."
cat > /etc/systemd/system/llm-app.service << EOF
[Unit]
Description=LLM App Docker Compose
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$APP_DIR
ExecStart=/usr/local/bin/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.prod.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable llm-app.service

# Create backup script
log "Creating backup script..."
cat > /opt/llm-app/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/llm-app/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$DATE.sql"

mkdir -p $BACKUP_DIR

# Create database backup
docker-compose -f /opt/llm-app/docker-compose.prod.yml exec -T db pg_dump -U postgres postgres > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup created: $BACKUP_FILE.gz"
EOF

chmod +x /opt/llm-app/backup.sh

# Create cron job for daily backups
log "Setting up daily backups..."
echo "0 2 * * * /opt/llm-app/backup.sh" | crontab -

# Configure log rotation
log "Configuring log rotation..."
cat > /etc/logrotate.d/llm-app << EOF
/opt/llm-app/deploy/deploy.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
}
EOF

# Set up monitoring
log "Setting up basic monitoring..."
apt install -y htop iotop nethogs

# Create monitoring script
cat > /opt/llm-app/monitor.sh << 'EOF'
#!/bin/bash
echo "=== LLM App System Status ==="
echo "Date: $(date)"
echo "Uptime: $(uptime)"
echo "Memory: $(free -h)"
echo "Disk: $(df -h /)"
echo "Docker containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo "=== End Status ==="
EOF

chmod +x /opt/llm-app/monitor.sh

# Create deployment instructions
log "Creating deployment instructions..."
cat > /opt/llm-app/DEPLOYMENT.md << 'EOF'
# LLM App Production Deployment

## Quick Start
1. Clone the repository: `git clone https://github.com/jkolarov/test-llm-app.git`
2. Copy environment file: `cp env.production.example .env.production`
3. Edit environment variables: `nano .env.production`
4. Run deployment: `./deploy/deploy.sh start`

## Management Commands
- Start: `./deploy/deploy.sh start`
- Stop: `./deploy/deploy.sh stop`
- Restart: `./deploy/deploy.sh restart`
- Update: `./deploy/deploy.sh update`
- Rollback: `./deploy/deploy.sh rollback`

## Monitoring
- Check status: `./monitor.sh`
- View logs: `docker-compose -f docker-compose.prod.yml logs -f`
- Backup: `./backup.sh`

## SSL Certificate
To enable HTTPS, run:
```bash
certbot --nginx -d your-domain.com
```

## Security Notes
- Change default passwords in .env.production
- Keep system updated: `apt update && apt upgrade`
- Monitor logs regularly
- Backup database daily
EOF

log "Server setup completed successfully!"
log "Next steps:"
log "1. Clone the repository to /opt/llm-app"
log "2. Configure .env.production with your settings"
log "3. Run: ./deploy/deploy.sh start"
log "4. Set up SSL certificate with certbot"
log "5. Configure your domain DNS"

# Switch to application directory
cd $APP_DIR

log "Setup completed! You can now deploy your LLM app." 