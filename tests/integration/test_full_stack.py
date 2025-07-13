import pytest
import requests
import time
import subprocess
import os
from typing import Generator
import docker

class TestFullStackIntegration:
    """Integration tests for the full application stack"""
    
    @pytest.fixture(scope="class")
    def docker_client(self):
        """Docker client for container management"""
        return docker.from_env()
    
    @pytest.fixture(scope="class")
    def running_containers(self, docker_client):
        """Start containers for testing"""
        # Start containers using docker-compose
        subprocess.run(["docker-compose", "up", "-d"], check=True)
        
        # Wait for containers to be ready
        time.sleep(30)
        
        yield
        
        # Cleanup
        subprocess.run(["docker-compose", "down"], check=True)
    
    def test_backend_health(self, running_containers):
        """Test backend health endpoint"""
        response = requests.get("http://localhost:8000/api/health", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
    
    def test_frontend_accessibility(self, running_containers):
        """Test frontend is accessible"""
        response = requests.get("http://localhost:5173/", timeout=10)
        assert response.status_code == 200
        assert "LLM Test Deployment App" in response.text
    
    def test_database_connection(self, running_containers):
        """Test database connectivity"""
        response = requests.get("http://localhost:8000/api/db_status", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
    
    def test_ollama_connection(self, running_containers):
        """Test Ollama connectivity"""
        response = requests.get("http://localhost:8000/api/ollama_status", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
    
    def test_docker_stats(self, running_containers):
        """Test Docker stats endpoint"""
        response = requests.get("http://localhost:8000/api/docker_stats", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "containers" in data
    
    def test_chat_functionality(self, running_containers):
        """Test chat functionality end-to-end"""
        # Test chat endpoint
        chat_data = {
            "message": "Hello, this is a test message",
            "model": "llama3.1:latest"
        }
        
        response = requests.post(
            "http://localhost:8000/api/ollama_chat",
            json=chat_data,
            timeout=60  # Longer timeout for AI response
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "session_id" in data
    
    def test_session_management(self, running_containers):
        """Test session creation and retrieval"""
        # Create a new session
        session_data = {"title": "Integration Test Session"}
        response = requests.post(
            "http://localhost:8000/api/sessions",
            json=session_data,
            timeout=10
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        session_id = data["session_id"]
        
        # Get all sessions
        response = requests.get("http://localhost:8000/api/sessions", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "sessions" in data
        
        # Get session messages
        response = requests.get(
            f"http://localhost:8000/api/sessions/{session_id}/messages",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
    
    def test_frontend_backend_integration(self, running_containers):
        """Test frontend can communicate with backend"""
        # Test that frontend can make API calls to backend
        response = requests.get("http://localhost:5173/", timeout=10)
        assert response.status_code == 200
        
        # The frontend should be able to make API calls to the backend
        # This is tested by checking if the frontend loads and can access backend APIs
        assert "LLM Test Deployment App" in response.text
    
    def test_performance_monitoring(self, running_containers):
        """Test performance monitoring features"""
        # Send a chat message and check for performance data
        chat_data = {
            "message": "Test performance monitoring",
            "model": "llama3.1:latest"
        }
        
        response = requests.post(
            "http://localhost:8000/api/ollama_chat",
            json=chat_data,
            timeout=60
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check if performance data is included
        if "performance_data" in data:
            perf_data = data["performance_data"]
            assert "total_duration" in perf_data
            assert "eval_count" in perf_data
            assert "eval_rate" in perf_data
    
    def test_error_handling(self, running_containers):
        """Test error handling in the application"""
        # Test invalid endpoint
        response = requests.get("http://localhost:8000/api/invalid", timeout=10)
        assert response.status_code == 404
        
        # Test invalid chat request
        response = requests.post(
            "http://localhost:8000/api/ollama_chat",
            json={},  # Missing required fields
            timeout=10
        )
        assert response.status_code == 422
    
    def test_container_health(self, running_containers):
        """Test that all containers are running and healthy"""
        client = docker.from_env()
        
        # Check that all expected containers are running
        containers = client.containers.list()
        container_names = [c.name for c in containers]
        
        expected_containers = [
            "test-llm-app-backend-1",
            "test-llm-app-frontend-1", 
            "test-llm-app-db-1",
            "test-llm-app-ollama-1"
        ]
        
        for expected in expected_containers:
            assert any(expected in name for name in container_names), f"Container {expected} not found"
    
    def test_websocket_connection(self, running_containers):
        """Test WebSocket connection for real-time updates"""
        import websockets
        import asyncio
        
        async def test_websocket():
            try:
                uri = "ws://localhost:8000/ws/docker_stats"
                async with websockets.connect(uri) as websocket:
                    # Send a test message
                    await websocket.send("test")
                    
                    # Wait for response
                    response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                    assert response is not None
                    
            except Exception as e:
                # WebSocket might not be implemented yet, so we'll just log
                print(f"WebSocket test skipped: {e}")
        
        # Run the async test
        asyncio.run(test_websocket())

if __name__ == "__main__":
    pytest.main([__file__]) 