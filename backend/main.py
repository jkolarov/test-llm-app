from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncpg
import httpx
import os
import json
from typing import Optional

app = FastAPI()

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db:5432/postgres")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")

# DB status endpoint
@app.get("/api/db_status")
async def db_status():
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        count = await conn.fetchval("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
        await conn.close()
        return {"status": "ok", "table_count": count}
    except Exception as e:
        return {"status": "error", "error": str(e)}

# Ollama status endpoint
@app.get("/api/ollama_status")
async def ollama_status():
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{OLLAMA_URL}/api/tags")
            if resp.status_code == 200:
                models = resp.json().get("models", [])
                return {"status": "ok", "models": models}
            else:
                return {"status": "error", "error": resp.text}
    except Exception as e:
        return {"status": "error", "error": str(e)}

# Chat request/response models
class ChatRequest(BaseModel):
    message: str

class OllamaGenerateResponse(BaseModel):
    response: str
    done: Optional[bool] = None

@app.post("/api/ollama_chat")
async def ollama_chat(req: ChatRequest):
    try:
        async with httpx.AsyncClient() as client:
            # Use chat endpoint with streaming disabled
            resp = await client.post(
                f"{OLLAMA_URL}/api/chat",
                json={
                    "model": "mistral:7b", 
                    "messages": [{"role": "user", "content": req.message}],
                    "stream": False
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                return {"status": "ok", "response": data.get("message", {}).get("content", "")}
            else:
                return {"status": "error", "error": resp.text}
    except Exception as e:
        return {"status": "error", "error": str(e)} 