from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncpg
import httpx
import os
import json
from typing import Optional, List
import docker
from datetime import datetime
import uuid
import re
from urllib.parse import quote_plus
import asyncio
import time
from fastapi import WebSocket, WebSocketDisconnect

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

# Initialize database tables
async def init_db():
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        
        # Enable vector extension
        await conn.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        
        # Create chat sessions table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        """)
        
        # Create messages table with vector embeddings
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
                role TEXT NOT NULL CHECK (role IN ('user', 'ai')),
                content TEXT NOT NULL,
                embedding vector(384),
                created_at TIMESTAMP DEFAULT NOW()
            );
        """)
        
        # Create index for vector similarity search
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS messages_embedding_idx 
            ON messages 
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100);
        """)
        
        await conn.close()
        print("Database initialized successfully")
    except Exception as e:
        print(f"Database initialization error: {e}")

# Pydantic models
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    session_id: str

class SessionCreate(BaseModel):
    title: Optional[str] = None

class Session(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime

class Message(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    created_at: datetime

# Simple embedding function (placeholder - in production, use a proper embedding model)
def get_embedding(text: str) -> str:
    # This is a simple hash-based embedding for demo purposes
    # In production, use a proper embedding model like sentence-transformers
    import hashlib
    hash_obj = hashlib.md5(text.encode())
    hash_bytes = hash_obj.digest()
    # Convert to 384-dimensional vector (simple approach)
    embedding = []
    for i in range(384):
        embedding.append((hash_bytes[i % 16] / 255.0) * 2 - 1)
    # Convert to PostgreSQL vector format
    return '[' + ','.join(map(str, embedding)) + ']'

# Web search function using multiple sources
async def web_search(query: str, max_results: int = 5) -> str:
    """Search the web and return relevant information"""
    try:
        results = []
        
        # Try DuckDuckGo first
        search_url = f"https://api.duckduckgo.com/?q={quote_plus(query)}&format=json&no_html=1&skip_disambig=1"
        
        # Configure httpx client with proper timeouts for web search
        timeout = httpx.Timeout(10.0, connect=3.0, read=7.0, write=2.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(search_url)
            
            if response.status_code == 200:
                data = response.json()
                
                # Get abstract if available
                if data.get('Abstract'):
                    results.append(f"Summary: {data['Abstract']}")
                
                # Get related topics
                if data.get('RelatedTopics'):
                    for topic in data['RelatedTopics'][:3]:
                        if isinstance(topic, dict) and topic.get('Text'):
                            results.append(f"Related: {topic['Text']}")
            
            # For sports queries, try additional sources
            if any(word in query.lower() for word in ['barcelona', 'madrid', 'football', 'soccer', 'game', 'match', 'schedule']):
                # Try multiple sports-specific searches
                sports_searches = [
                    f"{query} 2024 schedule fixture",
                    f"{query} next match",
                    f"{query} upcoming games",
                    f"{query} la liga schedule",
                    f"{query} champions league"
                ]
                
                for sports_query in sports_searches:
                    try:
                        sports_url = f"https://api.duckduckgo.com/?q={quote_plus(sports_query)}&format=json&no_html=1"
                        sports_response = await client.get(sports_url, timeout=8.0)
                        if sports_response.status_code == 200:
                            sports_data = sports_response.json()
                            if sports_data.get('Abstract'):
                                results.append(f"Sports Info: {sports_data['Abstract']}")
                                break  # Use first successful result
                    except:
                        continue
            
            # For financial queries, try additional sources
            elif any(word in query.lower() for word in ['stock market', 'stock', 'market', 'trading', 'finance', 'financial', 'nasdaq', 'nyse', 'dow', 'crypto', 'bitcoin', 'ethereum']):
                # Try multiple financial-specific searches
                financial_searches = [
                    f"{query} latest news",
                    f"{query} current status",
                    f"{query} market update",
                    f"{query} trading today",
                    f"{query} financial news",
                    f"{query} price today",
                    f"{query} market analysis"
                ]
                
                for financial_query in financial_searches:
                    try:
                        financial_url = f"https://api.duckduckgo.com/?q={quote_plus(financial_query)}&format=json&no_html=1"
                        financial_response = await client.get(financial_url, timeout=8.0)
                        if financial_response.status_code == 200:
                            financial_data = financial_response.json()
                            if financial_data.get('Abstract'):
                                results.append(f"Financial Info: {financial_data['Abstract']}")
                                break  # Use first successful result
                    except:
                        continue
                
                # Try Wikipedia for team information
                try:
                    wiki_query = "FC Barcelona" if "barcelona" in query.lower() else query
                    wiki_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote_plus(wiki_query)}"
                    wiki_response = await client.get(wiki_url, timeout=5.0)
                    if wiki_response.status_code == 200:
                        wiki_data = wiki_response.json()
                        if wiki_data.get('extract'):
                            # Extract relevant parts about current season
                            extract = wiki_data['extract']
                            if len(extract) > 200:
                                extract = extract[:200] + "..."
                            results.append(f"Team Info: {extract}")
                except:
                    pass
            
            # If still no results, try a general search
            if not results:
                general_searches = [
                    f"{query} latest news",
                    f"{query} current status",
                    f"{query} today",
                    f"{query} 2024",
                    f"{query} recent"
                ]
                
                for general_query in general_searches:
                    try:
                        general_url = f"https://api.duckduckgo.com/?q={quote_plus(general_query)}&format=json&no_html=1"
                        general_response = await client.get(general_url, timeout=8.0)
                        if general_response.status_code == 200:
                            general_data = general_response.json()
                            if general_data.get('Abstract'):
                                results.append(f"Latest Info: {general_data['Abstract']}")
                                break
                    except:
                        continue
        
        if results:
            return "\n".join(results)
        else:
            # Provide helpful fallback information for different query types
            if any(word in query.lower() for word in ['barcelona', 'madrid', 'football', 'soccer', 'game', 'match']):
                return f"WEB_SEARCH_NO_CURRENT_DATA: I couldn't find current schedule information for '{query}'. For the most up-to-date schedules, please check:\n- Official FC Barcelona website\n- La Liga official website\n- ESPN FC\n- BBC Sport\n- Goal.com"
            elif any(word in query.lower() for word in ['stock market', 'stock', 'market', 'trading', 'finance', 'financial', 'crypto', 'bitcoin', 'ethereum']):
                return f"WEB_SEARCH_NO_CURRENT_DATA: I couldn't find current market data for '{query}'. For real-time market data, please check:\n- Yahoo Finance\n- Bloomberg\n- CNBC\n- MarketWatch\n- Reuters Finance\n- CoinGecko (for crypto)\n- CoinMarketCap (for crypto)"
            else:
                return f"WEB_SEARCH_NO_CURRENT_DATA: I couldn't find current information about '{query}'. Please check official websites for the most up-to-date information."
                    
    except Exception as e:
        return f"Search error: {str(e)}"
    
    return "No information found."

# Function to detect if a query needs web search
def needs_web_search(message: str) -> bool:
    """Detect if a message requires real-time information from the web"""
    search_keywords = [
        'when is', 'next game', 'schedule', 'live', 'current', 'today', 'tomorrow',
        'latest', 'news', 'weather', 'score', 'result', 'fixture', 'match',
        'barcelona', 'real madrid', 'manchester', 'chelsea', 'arsenal', 'liverpool',
        'champions league', 'premier league', 'la liga', 'serie a', 'bundesliga',
        'world cup', 'euro', 'olympics', 'nba', 'nfl', 'mlb', 'nhl',
        # Financial terms
        'stock market', 'stock', 'market', 'trading', 'finance', 'financial',
        'nasdaq', 'nyse', 'dow jones', 's&p', 'ftse', 'currency', 'forex',
        # Technology and current events
        'ai news', 'artificial intelligence', 'tech news', 'technology',
        'crypto', 'bitcoin', 'ethereum', 'blockchain',
        # General current information
        'what is', 'tell me about', 'how is', 'what are', 'current',
        'latest', 'recent', 'now', 'today', 'this week', 'this month'
    ]
    
    message_lower = message.lower()
    return any(keyword in message_lower for keyword in search_keywords)

# Web search endpoint for testing
@app.get("/api/web_search")
async def search_web(query: str):
    """Test endpoint for web search functionality"""
    try:
        results = await web_search(query)
        return {"status": "ok", "query": query, "results": results}
    except Exception as e:
        return {"status": "error", "error": str(e)}

# DB status endpoint
@app.get("/api/db_status")
async def db_status():
    import time
    start = time.time()
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        count = await conn.fetchval("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
        session_count = await conn.fetchval("SELECT COUNT(*) FROM chat_sessions;")
        message_count = await conn.fetchval("SELECT COUNT(*) FROM messages;")
        await conn.close()
        elapsed = time.time() - start
        return {
            "status": "ok",
            "table_count": count,
            "session_count": session_count,
            "message_count": message_count,
            "response_time": elapsed
        }
    except Exception as e:
        elapsed = time.time() - start
        return {"status": "error", "error": str(e), "response_time": elapsed}

# Ollama status endpoint
@app.get("/api/ollama_status")
async def ollama_status():
    import time
    start = time.time()
    try:
        print(f"🔍 Checking Ollama status at: {OLLAMA_URL}")
        # Configure httpx client with proper timeouts
        timeout = httpx.Timeout(5.0, connect=2.0, read=3.0, write=2.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(f"{OLLAMA_URL}/api/tags")
            elapsed = time.time() - start
            print(f"📄 Ollama response status: {resp.status_code} in {elapsed:.2f}s")
            if resp.status_code == 200:
                data = resp.json()
                models = data.get("models", [])
                print(f"✅ Ollama models found: {len(models)}")
                return {"status": "ok", "models": models, "response_time": elapsed}
            else:
                print(f"❌ Ollama error: {resp.text}")
                return {"status": "error", "error": resp.text, "response_time": elapsed}
    except Exception as e:
        elapsed = time.time() - start
        print(f"❌ Ollama exception: {str(e)} after {elapsed:.2f}s")
        return {"status": "error", "error": str(e) or 'Ollama connection failed', "response_time": elapsed}

# Global cache for docker statistics
_docker_stats_cache: list = []
_docker_stats_ts: float = 0.0
_docker_stats_lock: asyncio.Lock = asyncio.Lock()

async def _collect_docker_stats() -> list:
    """Heavy operation that queries Docker for container stats."""
    client = docker.DockerClient(base_url='unix://var/run/docker.sock')
    containers = await asyncio.to_thread(client.containers.list)

    async def container_stats(c):
        try:
            s = await asyncio.to_thread(c.stats, stream=False)
            cpu_percent = 0.0
            if 'cpu_stats' in s and 'precpu_stats' in s:
                cpu_delta = s['cpu_stats']['cpu_usage']['total_usage'] - s['precpu_stats']['cpu_usage']['total_usage']
                system_delta = s['cpu_stats']['system_cpu_usage'] - s['precpu_stats']['system_cpu_usage']
                if system_delta > 0.0:
                    cpu_count = len(s['cpu_stats']['cpu_usage'].get('percpu_usage', [1])) or 1
                    cpu_percent = (cpu_delta / system_delta) * cpu_count * 100.0
            mem_usage = s['memory_stats']['usage']
            mem_limit = s['memory_stats'].get('limit', 1)
            mem_percent = (mem_usage / mem_limit) * 100.0 if mem_limit else 0.0
            return {
                'name': c.name,
                'status': c.status,
                'cpu_percent': round(cpu_percent, 2),
                'mem_usage': mem_usage,
                'mem_limit': mem_limit,
                'mem_percent': round(mem_percent, 2)
            }
        except Exception as e:
            return {
                'name': c.name,
                'status': c.status,
                'error': str(e)
            }

    return await asyncio.gather(*(container_stats(c) for c in containers))

async def _docker_stats_refresher():
    """Background task to refresh docker stats every 15 s."""
    global _docker_stats_cache, _docker_stats_ts
    while True:
        try:
            data = await _collect_docker_stats()
            async with _docker_stats_lock:
                _docker_stats_cache = data
                _docker_stats_ts = time.time()
        except Exception as e:
            # Log but continue
            print(f"⚠️  Docker stats refresher error: {e}")
        await asyncio.sleep(15)

# Docker stats endpoint
@app.get("/api/docker_stats")
async def docker_stats():
    import time
    start = time.time()
    global _docker_stats_cache, _docker_stats_ts
    async with _docker_stats_lock:
        cache = _docker_stats_cache
    if cache:
        elapsed = time.time() - start
        return {'status': 'ok', 'containers': cache, 'response_time': elapsed, 'cached': True}
    # If no cache yet (first run), compute synchronously
    try:
        data = await _collect_docker_stats()
        elapsed = time.time() - start
        async with _docker_stats_lock:
            _docker_stats_cache = data
            _docker_stats_ts = time.time()
        return {'status': 'ok', 'containers': data, 'response_time': elapsed, 'cached': False}
    except Exception as e:
        elapsed = time.time() - start
        return {'status': 'error', 'error': str(e), 'response_time': elapsed}

# Chat sessions endpoints
@app.get("/api/sessions")
async def get_sessions():
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        rows = await conn.fetch("""
            SELECT id, title, created_at, updated_at 
            FROM chat_sessions 
            ORDER BY updated_at DESC
        """)
        await conn.close()
        sessions = [
            Session(
                id=str(row['id']),
                title=row['title'] or f"Chat {i+1}",
                created_at=row['created_at'],
                updated_at=row['updated_at']
            )
            for i, row in enumerate(rows)
        ]
        return {"status": "ok", "sessions": sessions}
    except Exception as e:
        return {"status": "error", "error": str(e)}

@app.post("/api/sessions")
async def create_session(session: SessionCreate):
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        session_id = await conn.fetchval("""
            INSERT INTO chat_sessions (title) 
            VALUES ($1) 
            RETURNING id
        """, session.title or f"Chat {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        await conn.close()
        return {"status": "ok", "session_id": str(session_id)}
    except Exception as e:
        return {"status": "error", "error": str(e)}

@app.get("/api/sessions/{session_id}/messages")
async def get_session_messages(session_id: str):
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        rows = await conn.fetch("""
            SELECT id, session_id, role, content, created_at 
            FROM messages 
            WHERE session_id = $1 
            ORDER BY created_at ASC
        """, session_id)
        await conn.close()
        messages = [
            Message(
                id=str(row['id']),
                session_id=str(row['session_id']),
                role=row['role'],
                content=row['content'],
                created_at=row['created_at']
            )
            for row in rows
        ]
        return {"status": "ok", "messages": messages}
    except Exception as e:
        return {"status": "error", "error": str(e)}

# Enhanced chat endpoint with memory and web search
@app.post("/api/ollama_chat")
async def ollama_chat(req: ChatRequest):
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        
        # Create session if not provided
        if not req.session_id:
            session_id = await conn.fetchval("""
                INSERT INTO chat_sessions (title) 
                VALUES ($1) 
                RETURNING id
            """, f"Chat {datetime.now().strftime('%Y-%m-%d %H:%M')}")
            req.session_id = str(session_id)
        
        # Store user message
        user_embedding = get_embedding(req.message)
        await conn.execute("""
            INSERT INTO messages (session_id, role, content, embedding) 
            VALUES ($1, $2, $3, $4)
        """, req.session_id, 'user', req.message, user_embedding)
        
        # Check if web search is needed
        web_info = ""
        if needs_web_search(req.message):
            print(f"🔍 Web search triggered for: {req.message}")
            web_info = await web_search(req.message)
            print(f"📄 Web search results: {web_info[:200]}...")
            web_info = f"\n[Web Search Results: {web_info}]\n"
        else:
            print(f"❌ Web search NOT triggered for: {req.message}")
        
        # Get relevant context from previous conversations
        context_messages = await conn.fetch("""
            SELECT content, role 
            FROM messages 
            WHERE session_id = $1 
            ORDER BY created_at DESC 
            LIMIT 10
        """, req.session_id)
        
        # Build context for LLM
        context = ""
        if context_messages:
            context = "Previous conversation:\n"
            for msg in reversed(context_messages):
                context += f"{msg['role'].upper()}: {msg['content']}\n"
            context += "\nCurrent conversation:\n"
        
        # Prepare prompt with context and web search results
        system_prompt = """You are a helpful AI assistant with access to web search results. 
When provided with web search information, use it to give accurate and up-to-date answers.

IMPORTANT RULES:
1. If web search results are provided, use them as your primary source of information.
2. If web search results are available, start your response with "Based on my web search:" and then provide the information.
3. If web search results indicate that current information is not available (like fallback messages), acknowledge this clearly.
4. NEVER provide outdated information from your training data when web search indicates current data is not available.
5. For sports queries, if web search doesn't find current schedules, say "I couldn't find current schedule information" and suggest checking official websites.
6. For financial queries, if web search doesn't find current data, say "I couldn't find current market data" and suggest checking financial websites.
7. Always be transparent about the limitations of available information.

For sports queries, focus on current season information, upcoming matches, and recent results.
For financial queries, provide current market information when available.
If no specific current information is available from web search, acknowledge this and suggest checking official websites.
Always be helpful and informative, even when current information is limited."""
        
        full_prompt = f"{system_prompt}\n\n{context}{web_info}USER: {req.message}\nASSISTANT:"
        
        # Call Ollama
        # Configure httpx client with proper timeouts for longer generation requests
        timeout = httpx.Timeout(60.0, connect=5.0, read=55.0, write=5.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": "mistral:7b", 
                    "prompt": full_prompt,
                    "stream": False
                },
            )
            
            if resp.status_code == 200:
                data = resp.json()
                ai_response = data.get("response", "")
                
                # Store AI response
                ai_embedding = get_embedding(ai_response)
                await conn.execute("""
                    INSERT INTO messages (session_id, role, content, embedding) 
                    VALUES ($1, $2, $3, $4)
                """, req.session_id, 'ai', ai_response, ai_embedding)
                
                # Update session timestamp
                await conn.execute("""
                    UPDATE chat_sessions 
                    SET updated_at = NOW() 
                    WHERE id = $1
                """, req.session_id)
                
                await conn.close()
                return {"status": "ok", "response": ai_response, "session_id": req.session_id}
            else:
                await conn.close()
                return {"status": "error", "error": resp.text}
                
    except Exception as e:
        return {"status": "error", "error": str(e)}

# Startup event to initialize database
@app.on_event("startup")
async def startup_event():
    await init_db()
    # start docker stats refresher
    asyncio.create_task(_docker_stats_refresher())

# ---------------- WebSocket live stream -----------------

@app.websocket("/ws/docker_stats")
async def websocket_docker_stats(ws: WebSocket):
    """Continuously stream docker container stats to the client."""
    await ws.accept()
    try:
        while True:
            data = await _collect_docker_stats()
            await ws.send_json({"ts": time.time(), "containers": data})
            await asyncio.sleep(2)  # adjust interval as needed
    except WebSocketDisconnect:
        print("🛑 Docker stats WS disconnected")
    except Exception as e:
        print(f"⚠️  Docker stats WS error: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 