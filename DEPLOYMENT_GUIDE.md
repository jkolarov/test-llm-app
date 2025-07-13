# Deployment Guide

This guide covers deploying the full-stack AI chat application to different platforms.

## Architecture Overview

- **Frontend**: React SPA (deployed to GitHub Pages)
- **Backend**: FastAPI with PostgreSQL and Ollama (requires Docker + GPU)
- **Database**: PostgreSQL with pgvector
- **AI**: Ollama with NVIDIA GPU support

## Deployment Options

### Option 1: GitHub Pages (Frontend Only)

The frontend can be deployed to GitHub Pages, but you'll need to:

1. **Deploy the backend separately** (see options below)
2. **Update the API URL** in the frontend to point to your deployed backend

#### Steps:
1. Push to main branch
2. GitHub Actions will automatically build and deploy to GitHub Pages
3. Update `REACT_APP_API_URL` environment variable to point to your backend

### Option 2: Full Stack Deployment (Recommended)

For a complete deployment, you need:

#### Prerequisites:
- Docker and Docker Compose
- NVIDIA GPU with drivers
- NVIDIA Container Toolkit
- Domain name (optional)

#### Deployment Steps:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/jkolarov/test-llm-app.git
   cd test-llm-app
   ```

2. **Configure environment variables:**
   ```bash
   # Create .env file
   cp env.production.example .env
   # Edit .env with your configuration
   ```

3. **Deploy with Docker Compose:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

4. **Access the application:**
   - Frontend: http://your-domain:3000
   - Backend API: http://your-domain:8000
   - Ollama: http://your-domain:11434

### Option 3: Cloud Deployment

#### AWS/GCP/Azure:
- Use GPU instances for Ollama
- Deploy PostgreSQL to managed service
- Use load balancer for frontend/backend

#### Railway/Render/Heroku:
- Backend can be deployed to these platforms
- Frontend can be deployed to Vercel/Netlify
- Note: GPU support may be limited

## Environment Variables

### Frontend (.env):
```env
REACT_APP_API_URL=http://your-backend-domain:8000
```

### Backend (.env):
```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
OLLAMA_URL=http://ollama:11434
```

## Production Configuration

### Docker Compose Production:
```yaml
# docker-compose.prod.yml
version: '3.9'
services:
  frontend:
    build: ./frontend
    ports:
      - "80:3000"
    environment:
      - REACT_APP_API_URL=http://your-domain/api
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:password@db:5432/dbname
    depends_on:
      - db
      - ollama

  db:
    image: ankane/pgvector
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: dbname
    volumes:
      - pgdata:/var/lib/postgresql/data

  ollama:
    image: ollama/ollama:latest
    runtime: nvidia
    environment:
      - NVIDIA_VISIBLE_DEVICES=all
    volumes:
      - ollama_data:/root/.ollama

volumes:
  pgdata:
  ollama_data:
```

## Security Considerations

1. **Environment Variables**: Never commit secrets to Git
2. **HTTPS**: Use SSL certificates for production
3. **Firewall**: Restrict access to necessary ports only
4. **Database**: Use strong passwords and restrict network access
5. **API Keys**: Rotate regularly and use least privilege

## Monitoring and Maintenance

### Health Checks:
- Frontend: http://your-domain/health
- Backend: http://your-domain:8000/api/health
- Database: Check connection status
- Ollama: Check model availability

### Logs:
```bash
# View all logs
docker compose logs -f

# View specific service
docker compose logs -f backend
docker compose logs -f frontend
```

### Updates:
```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker compose down
docker compose up -d --build
```

## Troubleshooting

### Common Issues:

1. **GPU not detected:**
   ```bash
   nvidia-smi  # Check GPU status
   docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi
   ```

2. **Ollama model not loading:**
   ```bash
   docker compose logs ollama
   # Check available VRAM
   nvidia-smi
   ```

3. **Database connection failed:**
   ```bash
   docker compose logs db
   # Check if database is running
   docker compose ps db
   ```

4. **Frontend can't connect to backend:**
   - Check CORS configuration
   - Verify API URL in frontend
   - Check network connectivity

### Performance Optimization:

1. **GPU Memory**: Monitor VRAM usage
2. **Database**: Add indexes for better performance
3. **Caching**: Implement Redis for session storage
4. **Load Balancing**: Use multiple backend instances

## CI/CD Pipeline

The repository includes GitHub Actions workflows:

- **Frontend**: Builds and deploys to GitHub Pages
- **Backend**: Tests and validates Python code
- **Security**: Runs security scans on dependencies

### Manual Deployment:
```bash
# Frontend only
cd frontend
npm run deploy

# Full stack
docker compose -f docker-compose.prod.yml up -d
```

## Support

For issues and questions:
1. Check the logs first
2. Review this deployment guide
3. Check the main README.md
4. Open an issue on GitHub

---

**Note**: This is a development/demo application. For production use, implement proper security measures, monitoring, and backup strategies. 