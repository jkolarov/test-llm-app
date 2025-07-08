# LLM App Production Deployment Guide

## Overview

This guide provides a complete production deployment strategy for the LLM App with safe PR workflow and rollback capabilities.

## Repository Structure

```
main                    # Development branch (current working code)
├── deploy/
│   ├── production/     # Production deployment branch
│   └── staging/        # Staging/testing branch
```

## Deployment Strategy

### 1. **Safe PR Workflow**

#### Development → Production PR Process:
1. **Create Feature Branch**: `git checkout -b feature/new-feature`
2. **Develop & Test**: Make changes and test locally
3. **Push to Main**: `git push origin main`
4. **Create PR**: `main` → `deploy/production`
5. **Review & Test**: Test on staging server
6. **Merge to Production**: Deploy to production server
7. **Rollback**: If issues arise, revert the PR

### 2. **Branch Protection Rules**

Set up GitHub branch protection for `deploy/production`:
- Require PR reviews
- Require status checks
- Require up-to-date branches
- Restrict direct pushes

## Server Setup

### 1. **Initial Server Preparation**

```bash
# SSH to your Debian server
ssh user@your-server-ip

# Run the setup script as root
sudo ./deploy/setup-server.sh
```

### 2. **Clone Repository**

```bash
cd /opt
git clone https://github.com/jkolarov/test-llm-app.git llm-app
cd llm-app
```

### 3. **Configure Environment**

```bash
# Copy environment template
cp env.production.example .env.production

# Edit environment variables
nano .env.production
```

**Required Environment Variables:**
```bash
# Database
DB_PASSWORD=your_secure_password_here

# Domain Configuration
DOMAIN=your-domain.com
FRONTEND_URL=https://your-domain.com
API_URL=https://your-domain.com/api

# Security
SECRET_KEY=your_secret_key_here
JWT_SECRET=your_jwt_secret_here
```

## Deployment Process

### 1. **Initial Deployment**

```bash
# Make deployment script executable
chmod +x deploy/deploy.sh

# Start the application
./deploy/deploy.sh start
```

### 2. **SSL Certificate Setup**

```bash
# Install SSL certificate
certbot --nginx -d your-domain.com

# Test certificate renewal
certbot renew --dry-run
```

### 3. **Verify Deployment**

```bash
# Check service health
./deploy/deploy.sh health

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Monitor system
./monitor.sh
```

## PR Workflow for Updates

### 1. **Development Process**

```bash
# Create feature branch
git checkout -b feature/update-feature

# Make changes
# Test locally
git add .
git commit -m "Add new feature"
git push origin feature/update-feature
```

### 2. **Create Pull Request**

1. Go to GitHub repository
2. Create PR: `feature/update-feature` → `main`
3. Review and merge to `main`
4. Create PR: `main` → `deploy/production`
5. Test on staging server
6. Deploy to production

### 3. **Production Deployment**

```bash
# On production server
cd /opt/llm-app

# Pull latest changes
git pull origin deploy/production

# Update services
./deploy/deploy.sh update
```

## Rollback Procedures

### 1. **Quick Rollback**

```bash
# Rollback to previous version
./deploy/deploy.sh rollback
```

### 2. **Manual Rollback**

```bash
# Stop services
./deploy/deploy.sh stop

# Revert to previous commit
git log --oneline -5
git reset --hard <previous-commit-hash>

# Restart services
./deploy/deploy.sh start
```

### 3. **Database Rollback**

```bash
# List available backups
ls -la backups/

# Restore from backup
docker-compose -f docker-compose.prod.yml exec -T db psql -U postgres postgres < backups/backup_YYYYMMDD_HHMMSS.sql
```

## Monitoring & Maintenance

### 1. **Daily Monitoring**

```bash
# Check system status
./monitor.sh

# View application logs
docker-compose -f docker-compose.prod.yml logs --tail=100

# Check disk space
df -h

# Check memory usage
free -h
```

### 2. **Weekly Maintenance**

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Clean Docker images
docker system prune -f

# Check SSL certificate
certbot certificates

# Review logs
tail -f deploy/deploy.log
```

### 3. **Monthly Tasks**

```bash
# Review and rotate logs
logrotate -f /etc/logrotate.d/llm-app

# Test backup restoration
# (Test in staging environment)

# Security audit
fail2ban-client status
```

## Security Considerations

### 1. **Firewall Configuration**

```bash
# Check firewall status
sudo ufw status

# Allow only necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
```

### 2. **SSL/TLS Security**

```bash
# Check SSL configuration
nginx -t

# Test SSL security
curl -I https://your-domain.com
```

### 3. **Database Security**

```bash
# Change default passwords
# Use strong passwords in .env.production

# Regular backups
./backup.sh

# Monitor database connections
docker-compose -f docker-compose.prod.yml exec db psql -U postgres -c "SELECT * FROM pg_stat_activity;"
```

## Troubleshooting

### Common Issues

1. **Ollama Model Not Loading**
   ```bash
   # Check GPU availability
   nvidia-smi
   
   # Download model manually
   docker exec llm-app-ollama-1 ollama pull mistral:7b
   ```

2. **Database Connection Issues**
   ```bash
   # Check database status
   docker-compose -f docker-compose.prod.yml exec db pg_isready
   
   # Restart database
   docker-compose -f docker-compose.prod.yml restart db
   ```

3. **Nginx Configuration Issues**
   ```bash
   # Test nginx configuration
   docker-compose -f docker-compose.prod.yml exec nginx nginx -t
   
   # Reload nginx
   docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
   ```

### Emergency Procedures

1. **Complete System Failure**
   ```bash
   # Stop all services
   ./deploy/deploy.sh stop
   
   # Check system resources
   htop
   df -h
   free -h
   
   # Restart services
   ./deploy/deploy.sh start
   ```

2. **Data Loss Prevention**
   ```bash
   # Create immediate backup
   ./backup.sh
   
   # Check backup integrity
   gunzip -t backups/latest_backup.sql.gz
   ```

## Performance Optimization

### 1. **Resource Monitoring**

```bash
# Monitor CPU usage
htop

# Monitor GPU usage (if available)
nvidia-smi -l 1

# Monitor disk I/O
iotop
```

### 2. **Docker Optimization**

```bash
# Clean unused Docker resources
docker system prune -a

# Monitor container resource usage
docker stats
```

### 3. **Database Optimization**

```bash
# Check database performance
docker-compose -f docker-compose.prod.yml exec db psql -U postgres -c "SELECT * FROM pg_stat_database;"
```

## Backup Strategy

### 1. **Automated Backups**

- **Frequency**: Daily at 2 AM
- **Retention**: 30 days
- **Location**: `/opt/llm-app/backups/`

### 2. **Manual Backups**

```bash
# Create manual backup
./backup.sh

# Create full system backup
tar -czf /backup/system_$(date +%Y%m%d).tar.gz /opt/llm-app/
```

### 3. **Backup Verification**

```bash
# Test backup restoration (in staging)
docker-compose -f docker-compose.prod.yml exec -T db psql -U postgres postgres < backup_file.sql
```

## Support & Documentation

### 1. **Log Locations**

- Application logs: `docker-compose -f docker-compose.prod.yml logs`
- Deployment logs: `/opt/llm-app/deploy/deploy.log`
- System logs: `/var/log/syslog`
- Nginx logs: `/var/log/nginx/`

### 2. **Useful Commands**

```bash
# Quick status check
./monitor.sh

# View real-time logs
docker-compose -f docker-compose.prod.yml logs -f

# Check service health
curl -f http://localhost/health

# Database backup
./backup.sh
```

### 3. **Emergency Contacts**

- System Administrator: [Your Contact]
- Database Administrator: [Your Contact]
- DevOps Team: [Your Contact]

---

**Remember**: Always test changes in staging before deploying to production, and keep regular backups of your data. 