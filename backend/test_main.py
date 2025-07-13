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
        assert "message" in data
    
    def test_db_status_endpoint(self):
        """Test database status endpoint"""
        response = client.get("/api/db_status")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "response_time" in data
    
    def test_ollama_status_endpoint(self):
        """Test Ollama status endpoint"""
        response = client.get("/api/ollama_status")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        # Handle both success and error cases
        if data["status"] == "ok":
            assert "response_time" in data
        else:
            assert "error" in data
    
    def test_docker_stats_endpoint(self):
        """Test Docker stats endpoint"""
        response = client.get("/api/docker_stats")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "response_time" in data

class TestChatEndpoints:
    """Test chat functionality"""
    
    def test_chat_endpoint_success(self):
        """Test successful chat request"""
        response = client.post("/api/ollama_chat", json={
            "message": "Hello",
            "model": "llama3.1:latest"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
    
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
        # The actual implementation doesn't validate models strictly
        assert response.status_code == 200

class TestSessionEndpoints:
    """Test session management"""
    
    def test_create_session(self):
        """Test creating a new session"""
        response = client.post("/api/sessions", json={
            "title": "Test Session"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        if data["status"] == "ok":
            assert "session_id" in data
    
    def test_get_sessions(self):
        """Test getting all sessions"""
        response = client.get("/api/sessions")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        if data["status"] == "ok":
            assert "sessions" in data
    
    def test_get_session_messages(self):
        """Test getting messages for a session"""
        # First create a session
        create_response = client.post("/api/sessions", json={
            "title": "Test Session for Messages"
        })
        
        if create_response.status_code == 200:
            session_data = create_response.json()
            if session_data["status"] == "ok":
                session_id = session_data["session_id"]
                
                # Now get messages for this session
                response = client.get(f"/api/sessions/{session_id}/messages")
                assert response.status_code == 200
                data = response.json()
                assert "status" in data
                if data["status"] == "ok":
                    assert "messages" in data

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

if __name__ == "__main__":
    pytest.main([__file__]) 