#!/bin/bash

# Production Deployment Script
# Usage: ./deploy/deploy.sh [start|stop|restart|update|rollback]

set -e

# Configuration
PROJECT_NAME="llm-app"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"
BACKUP_DIR="./backups"
LOG_FILE="./deploy/deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root"
        exit 1
    fi
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check NVIDIA Docker (for Ollama)
    if ! docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi &> /dev/null; then
        warn "NVIDIA Docker runtime not available. Ollama may not work properly."
    fi
    
    log "Prerequisites check completed"
}

# Load environment variables
load_env() {
    if [[ ! -f "$ENV_FILE" ]]; then
        error "Environment file $ENV_FILE not found"
        exit 1
    fi
    
    log "Loading environment variables from $ENV_FILE"
    export $(cat "$ENV_FILE" | grep -v '^#' | xargs)
}

# Create backup
create_backup() {
    log "Creating database backup..."
    mkdir -p "$BACKUP_DIR"
    BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"
    
    if docker-compose -f "$COMPOSE_FILE" exec -T db pg_dump -U postgres postgres > "$BACKUP_FILE" 2>/dev/null; then
        log "Backup created: $BACKUP_FILE"
    else
        warn "Could not create backup (database might not be running)"
    fi
}

# Download Ollama model
download_model() {
    log "Checking if Ollama model is available..."
    
    # Start Ollama service if not running
    docker-compose -f "$COMPOSE_FILE" up -d ollama
    
    # Wait for Ollama to be ready
    log "Waiting for Ollama to be ready..."
    for i in {1..30}; do
        if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
            break
        fi
        sleep 2
    done
    
    # Check if model exists
    if docker exec "${PROJECT_NAME}-ollama-1" ollama list | grep -q "mistral:7b"; then
        log "Model mistral:7b already exists"
    else
        log "Downloading mistral:7b model..."
        docker exec "${PROJECT_NAME}-ollama-1" ollama pull mistral:7b
        log "Model download completed"
    fi
}

# Start services
start_services() {
    log "Starting services..."
    docker-compose -f "$COMPOSE_FILE" up -d
    
    log "Waiting for services to be ready..."
    sleep 10
    
    # Check service health
    check_health
}

# Stop services
stop_services() {
    log "Stopping services..."
    docker-compose -f "$COMPOSE_FILE" down
}

# Restart services
restart_services() {
    log "Restarting services..."
    docker-compose -f "$COMPOSE_FILE" restart
}

# Update services
update_services() {
    log "Updating services..."
    
    # Create backup before update
    create_backup
    
    # Pull latest images
    docker-compose -f "$COMPOSE_FILE" pull
    
    # Rebuild and restart
    docker-compose -f "$COMPOSE_FILE" up -d --build
    
    log "Update completed"
}

# Check health
check_health() {
    log "Checking service health..."
    
    # Check frontend
    if curl -s http://localhost/health > /dev/null 2>&1; then
        log "Frontend is healthy"
    else
        warn "Frontend health check failed"
    fi
    
    # Check backend
    if curl -s http://localhost/api/db_status > /dev/null 2>&1; then
        log "Backend is healthy"
    else
        warn "Backend health check failed"
    fi
    
    # Check Ollama
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        log "Ollama is healthy"
    else
        warn "Ollama health check failed"
    fi
}

# Rollback function
rollback() {
    log "Rolling back to previous version..."
    
    # Stop current services
    stop_services
    
    # Restore from backup if available
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/*.sql 2>/dev/null | head -1)
    if [[ -n "$LATEST_BACKUP" ]]; then
        log "Restoring from backup: $LATEST_BACKUP"
        docker-compose -f "$COMPOSE_FILE" up -d db
        sleep 10
        docker-compose -f "$COMPOSE_FILE" exec -T db psql -U postgres postgres < "$LATEST_BACKUP"
    fi
    
    # Start services
    start_services
    
    log "Rollback completed"
}

# Main function
main() {
    local action="$1"
    
    # Initialize log file
    mkdir -p "$(dirname "$LOG_FILE")"
    echo "=== Deployment started at $(date) ===" >> "$LOG_FILE"
    
    # Check if running as root
    check_root
    
    # Check prerequisites
    check_prerequisites
    
    # Load environment variables
    load_env
    
    case "$action" in
        "start")
            start_services
            download_model
            check_health
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            restart_services
            check_health
            ;;
        "update")
            update_services
            download_model
            check_health
            ;;
        "rollback")
            rollback
            ;;
        *)
            echo "Usage: $0 {start|stop|restart|update|rollback}"
            exit 1
            ;;
    esac
    
    log "Deployment action '$action' completed"
    echo "=== Deployment completed at $(date) ===" >> "$LOG_FILE"
}

# Run main function with all arguments
main "$@" 