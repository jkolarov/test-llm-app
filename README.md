# Ollama Test App

**Last updated:** July 2025

> 🚀 Now with full-stack CI/CD, GitHub Actions, and production-ready Docker deployment! See DEPLOYMENT_GUIDE.md for details.

A modern AI chat application with real-time system monitoring and live Docker container statistics.

## Architecture

- **Frontend**: React SPA with Material-UI, real-time charts, and WebSocket streaming
- **Backend**: FastAPI with async Docker stats, PostgreSQL integration, and WebSocket endpoints
- **Database**: PostgreSQL with pgvector for semantic search
- **AI**: Ollama with NVIDIA GPU support, running `mistral:7b`
- **Monitoring**: Live Docker container CPU/RAM usage with real-time charts

## Features

### 🤖 AI Chat
- Conversational interface with Ollama's Mistral 7B model
- Session management with persistent chat history
- Web search integration for real-time information
- Context-aware responses with conversation memory

### 📊 Real-Time Monitoring
- **Live Docker Stats**: Real-time CPU and RAM usage for all containers
- **System Status**: Database, AI model, and container health monitoring
- **WebSocket Streaming**: Live updates every 2 seconds without polling
- **Interactive Charts**: Mini sparkline graphs showing usage trends

### 🗄️ Database Features
- PostgreSQL with pgvector for semantic embeddings
- Chat session persistence
- Message history with vector similarity search
- Automatic database initialization

## Prerequisites
- [Docker](https://www.docker.com/)
- [NVIDIA GPU drivers](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html) (for Ollama)
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd test_app
   ```

2. **Build and start all services**
   ```bash
   docker-compose up --build
   ```

3. **Access the application**
   - **Frontend**: [http://localhost:3000](http://localhost:3000)
   - **Backend API**: [http://localhost:8000/docs](http://localhost:8000/docs)
   - **Ollama**: [http://localhost:11434](http://localhost:11434)

## API Endpoints

### Core Endpoints
- `GET /api/db_status` - Database health and statistics
- `GET /api/ollama_status` - AI model status and available models
- `GET /api/docker_stats` - Cached Docker container statistics
- `POST /api/ollama_chat` - Chat with the AI model
- `GET /api/sessions` - List chat sessions
- `POST /api/sessions` - Create new chat session

### WebSocket Endpoints
- `WS /ws/docker_stats` - Live streaming Docker container metrics

## Technical Highlights

### Performance Optimizations
- **Cached Docker Stats**: Background task refreshes stats every 15s, API responses in ~1ms
- **WebSocket Streaming**: Real-time updates without polling overhead
- **Async Operations**: Non-blocking Docker SDK calls using `asyncio.to_thread`
- **Connection Pooling**: Efficient database connections with asyncpg

### Frontend Features
- **Real-time Charts**: Live CPU/RAM usage graphs using Recharts
- **Responsive Design**: Material-UI components with modern styling
- **Session Management**: Persistent chat sessions with history
- **Status Monitoring**: Live system health indicators

### Backend Features
- **FastAPI**: Modern async Python web framework
- **Docker Integration**: Real-time container monitoring
- **Vector Database**: PostgreSQL with pgvector for semantic search
- **WebSocket Support**: Live data streaming

## Customization

### Change AI Model
Edit `docker-compose.yml` to use a different Ollama model:
```yaml
environment:
  - OLLAMA_MODEL=llama2:7b  # or any other model
```

### Adjust Monitoring Frequency
- **Docker Stats Cache**: Modify `_docker_stats_refresher()` sleep time in `backend/main.py`
- **WebSocket Updates**: Change the sleep interval in `websocket_docker_stats()`
- **Frontend Polling**: Update the interval in `fetchStatuses()` useEffect

### Add New Features
- **New API Endpoints**: Add to `backend/main.py`
- **Frontend Components**: Create new React components in `frontend/src/`
- **Database Tables**: Extend the schema in `init_db()`

## Development

### Local Development
```bash
# Backend development
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend development
cd frontend
npm install
npm start
```

### Docker Development
```bash
# Rebuild specific service
docker-compose build backend
docker-compose up -d backend

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

## System Requirements

### Minimum
- **GPU**: NVIDIA GPU with 6GB+ VRAM (for mistral:7b)
- **RAM**: 8GB system RAM
- **Storage**: 10GB free space

### Recommended
- **GPU**: NVIDIA RTX 3060 or better
- **RAM**: 16GB+ system RAM
- **Storage**: SSD with 20GB+ free space

## Troubleshooting

### Common Issues
1. **GPU not detected**: Ensure NVIDIA Container Toolkit is installed
2. **Ollama model not loading**: Check GPU VRAM and model size
3. **WebSocket connection failed**: Verify backend is running and accessible
4. **Docker stats slow**: Check Docker daemon and container permissions

### Logs
```bash
# View all logs
docker-compose logs

# View specific service
docker-compose logs backend
docker-compose logs ollama
```

## License

This project is for testing and demonstration purposes. Not production-hardened.

---

**Built with ❤️ using FastAPI, React, and Ollama** 