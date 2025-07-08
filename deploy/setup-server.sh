#!/bin/bash

# Debian Server Setup Script for LLM App (Internal Network)
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

log "Starting Debian server setup for LLM App (Internal Network)..."

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

# Configure firewall for internal network
log "Configuring firewall for internal network..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 8000/tcp
ufw allow 11434/tcp
ufw allow 22/tcp
ufw --force enable

# Configure fail2ban
log "Configuring fail2ban..."
cat > /etc/fail2ban/jail.local << 'FAIL2BAN_EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
maxretry = 3
FAIL2BAN_EOF

systemctl enable fail2ban
systemctl restart fail2ban

# Create application directory
log "Creating application directory..."
APP_DIR="/opt/llm-app"
mkdir -p $APP_DIR
chown $SUDO_USER:$SUDO_USER $APP_DIR

# Create systemd service for auto-start
log "Creating systemd service..."
cat > /etc/systemd/system/llm-app.service << 'SERVICE_EOF'
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
SERVICE_EOF

systemctl daemon-reload
systemctl enable llm-app.service

# Create backup script
log "Creating backup script..."
cat > /opt/llm-app/backup.sh << 'BACKUP_EOF'
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
BACKUP_EOF

chmod +x /opt/llm-app/backup.sh

# Create cron job for daily backups
log "Setting up daily backups..."
echo "0 2 * * * /opt/llm-app/backup.sh" | crontab -

# Configure log rotation
log "Configuring log rotation..."
cat > /etc/logrotate.d/llm-app << 'LOGROTATE_EOF'
/opt/llm-app/deploy/deploy.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
}
LOGROTATE_EOF

# Set up monitoring
log "Setting up basic monitoring..."
apt install -y htop iotop nethogs

# Create monitoring script
log "Creating monitoring script..."
cat > /opt/llm-app/monitor.sh << 'MONITOR_EOF'
#!/bin/bash
echo "=== LLM App System Status ==="
echo "Date: $(date)"
echo ""

echo "=== Docker Services ==="
docker-compose -f /opt/llm-app/docker-compose.prod.yml ps
echo ""

echo "=== System Resources ==="
echo "CPU Usage:"
top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1
echo "Memory Usage:"
free -h
echo ""

echo "=== Disk Usage ==="
df -h
echo ""

echo "=== Network Connections ==="
netstat -tuln | grep -E ':(80|8000|11434)'
echo ""

echo "=== Recent Logs ==="
docker-compose -f /opt/llm-app/docker-compose.prod.yml logs --tail=10
MONITOR_EOF

chmod +x /opt/llm-app/monitor.sh

# Create deployment instructions
log "Creating deployment instructions..."
cat > /opt/llm-app/DEPLOYMENT_INSTRUCTIONS.txt << 'INSTRUCTIONS_EOF'
LLM App Deployment Instructions (Internal Network)
================================================

1. CLONE THE REPOSITORY:
   sudo git clone https://github.com/jkolarov/test-llm-app.git /opt/llm-app
   sudo chown -R $USER:$USER /opt/llm-app
   cd /opt/llm-app

2. CONFIGURE ENVIRONMENT:
   cp env.production.example .env.production
   nano .env.production
   
   Update these values:
   - DB_PASSWORD=your_secure_password
   - SECRET_KEY=your_secret_key
   - JWT_SECRET=your_jwt_secret

3. START THE APPLICATION:
   chmod +x deploy/deploy.sh
   ./deploy/deploy.sh start

4. VERIFY DEPLOYMENT:
   ./deploy/deploy.sh status
   ./monitor.sh

5. ACCESS THE APPLICATION:
   - Frontend: http://YOUR_SERVER_IP:80
   - Backend API: http://YOUR_SERVER_IP:8000/docs
   - Ollama: http://YOUR_SERVER_IP:11434

6. USEFUL COMMANDS:
   - View logs: docker-compose -f docker-compose.prod.yml logs -f
   - Stop app: ./deploy/deploy.sh stop
   - Restart app: ./deploy/deploy.sh restart
   - Monitor: ./monitor.sh
   - Backup: ./backup.sh

7. TROUBLESHOOTING:
   - Check service status: systemctl status llm-app
   - View system logs: journalctl -u llm-app -f
   - Check Docker: docker ps -a
   - Check Ollama: curl http://localhost:11434/api/tags

The application will auto-start on system boot.
INSTRUCTIONS_EOF

log "Server setup completed successfully!"
log "Next steps:"
log "1. Clone the repository to /opt/llm-app"
log "2. Configure .env.production with your settings"
log "3. Run: ./deploy/deploy.sh start"
log "4. Access via internal network IP"
log "Setup completed! You can now deploy your LLM app." 