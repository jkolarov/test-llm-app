import pytest
import asyncio
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import json
from main import app

client = TestClient(app)

class TestHealthEndpoints:
    """Test health and status endpoints"""
    
    def test_health_endpoint(self):
        """Test the health endpoint returns 200"""
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "timestamp" in data
    
    def test_db_status_endpoint(self):
        """Test database status endpoint"""
        with patch('main.get_db_status') as mock_db_status:
            mock_db_status.return_value = {
                "status": "ok",
                "table_count": 2,
                "session_count": 5,
                "message_count": 10,
                "response_time": 0.05
            }
            response = client.get("/api/db_status")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ok"
            assert "table_count" in data
    
    def test_ollama_status_endpoint(self):
        """Test Ollama status endpoint"""
        with patch('main.get_ollama_status') as mock_ollama_status:
            mock_ollama_status.return_value = {
                "status": "ok",
                "models": ["llama3.1:latest", "mistral:7b"],
                "response_time": 0.1
            }
            response = client.get("/api/ollama_status")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ok"
            assert "models" in data
    
    def test_docker_stats_endpoint(self):
        """Test Docker stats endpoint"""
        with patch('main.get_docker_stats') as mock_docker_stats:
            mock_docker_stats.return_value = {
                "status": "ok",
                "containers": [
                    {
                        "name": "test-llm-app-ollama-1",
                        "cpu_percent": 15.5,
                        "mem_percent": 25.2,
                        "mem_usage": "1.2GB / 4GB"
                    }
                ],
                "response_time": 0.05
            }
            response = client.get("/api/docker_stats")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ok"
            assert "containers" in data

class TestChatEndpoints:
    """Test chat functionality"""
    
    def test_chat_endpoint_success(self):
        """Test successful chat request"""
        with patch('main.chat_with_ollama') as mock_chat:
            mock_chat.return_value = {
                "status": "ok",
                "response": "Hello! How can I help you today?",
                "session_id": "test-session-123",
                "performance_data": {
                    "total_duration": 2.5,
                    "eval_count": 50,
                    "eval_rate": 20.0
                }
            }
            
            response = client.post("/api/ollama_chat", json={
                "message": "Hello",
                "model": "llama3.1:latest"
            })
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ok"
            assert "response" in data
            assert "session_id" in data
            assert "performance_data" in data
    
    def test_chat_endpoint_missing_message(self):
        """Test chat endpoint with missing message"""
        response = client.post("/api/ollama_chat", json={})
        assert response.status_code == 422
    
    def test_chat_endpoint_invalid_model(self):
        """Test chat endpoint with invalid model"""
        response = client.post("/api/ollama_chat", json={
            "message": "Hello",
            "model": "invalid-model"
        })
        assert response.status_code == 400

class TestSessionEndpoints:
    """Test session management"""
    
    def test_create_session(self):
        """Test creating a new session"""
        with patch('main.create_session') as mock_create:
            mock_create.return_value = {
                "status": "ok",
                "session_id": "new-session-123"
            }
            
            response = client.post("/api/sessions", json={
                "title": "Test Session"
            })
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ok"
            assert "session_id" in data
    
    def test_get_sessions(self):
        """Test getting all sessions"""
        with patch('main.get_sessions') as mock_get:
            mock_get.return_value = {
                "status": "ok",
                "sessions": [
                    {
                        "id": "session-1",
                        "title": "Test Session 1",
                        "created_at": "2024-01-01T00:00:00Z",
                        "updated_at": "2024-01-01T00:00:00Z"
                    }
                ]
            }
            
            response = client.get("/api/sessions")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ok"
            assert "sessions" in data
            assert len(data["sessions"]) > 0
    
    def test_get_session_messages(self):
        """Test getting messages for a session"""
        with patch('main.get_session_messages') as mock_get:
            mock_get.return_value = {
                "status": "ok",
                "messages": [
                    {
                        "id": 1,
                        "role": "user",
                        "content": "Hello",
                        "created_at": "2024-01-01T00:00:00Z"
                    },
                    {
                        "id": 2,
                        "role": "ai",
                        "content": "Hi there!",
                        "created_at": "2024-01-01T00:00:01Z",
                        "performance_data": {
                            "total_duration": 1.5,
                            "eval_count": 30,
                            "eval_rate": 20.0
                        }
                    }
                ]
            }
            
            response = client.get("/api/sessions/test-session-123/messages")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ok"
            assert "messages" in data
            assert len(data["messages"]) > 0

class TestErrorHandling:
    """Test error handling and edge cases"""
    
    def test_invalid_endpoint(self):
        """Test 404 for invalid endpoint"""
        response = client.get("/api/invalid")
        assert response.status_code == 404
    
    def test_method_not_allowed(self):
        """Test 405 for wrong HTTP method"""
        response = client.get("/api/ollama_chat")
        assert response.status_code == 405
    
    def test_internal_server_error(self):
        """Test 500 error handling"""
        with patch('main.get_db_status') as mock_db_status:
            mock_db_status.side_effect = Exception("Database error")
            response = client.get("/api/db_status")
            assert response.status_code == 500

if __name__ == "__main__":
    pytest.main([__file__]) 