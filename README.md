# Ollama Test App

A test application with:
- **React** frontend (SPA, Material UI, chat, status cards)
- **FastAPI** backend (API for DB and Ollama)
- **PostgreSQL** with pgvector
- **Ollama** (small model, GPU-enabled)

## Architecture

- **frontend**: React SPA (port 3000)
- **backend**: FastAPI (port 8000)
- **db**: PostgreSQL + pgvector (port 5432)
- **ollama**: Ollama with NVIDIA GPU, running `mistral:7b` (port 11434)

## Prerequisites
- [Docker](https://www.docker.com/)
- [NVIDIA GPU drivers](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html) (for Ollama)
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)

## Quick Start

1. **Clone the repo**
2. **Build and start all services:**
   ```sh
   docker compose up --build
   ```
3. **Access the app:**
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - Backend API: [http://localhost:8000/docs](http://localhost:8000/docs)
   - Ollama: [http://localhost:11434](http://localhost:11434)

## Features
- **Status cards**: Live status for frontend, DB, and Ollama model
- **Chat**: Talk to the Ollama model (mistral:7b)
- **DB stats**: See table count and DB connection status

## Customization
- Change the Ollama model in `docker-compose.yml` if you want a different one (ensure it fits your GPU VRAM)
- Add more endpoints or UI features as needed

## Notes
- Ollama requires a supported NVIDIA GPU (6GB+ VRAM recommended for `mistral:7b`)
- The app is for testing/demo purposes and not production-hardened

---

**Enjoy!** 