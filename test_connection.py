import httpx
import asyncio
import time

async def test_ollama_connection():
    start = time.time()
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get('http://ollama:11434/api/tags', timeout=5.0)
            elapsed = time.time() - start
            print(f"Status: {resp.status_code}")
            print(f"Response time: {elapsed:.2f}s")
            if resp.status_code == 200:
                data = resp.json()
                print(f"Models: {data.get('models', [])}")
            return resp.status_code == 200
    except Exception as e:
        elapsed = time.time() - start
        print(f"Error: {e}")
        print(f"Time elapsed: {elapsed:.2f}s")
        return False

if __name__ == "__main__":
    asyncio.run(test_ollama_connection()) 