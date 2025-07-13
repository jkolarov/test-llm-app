import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemText,
  Divider,
  Alert,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Send, Add, Refresh } from '@mui/icons-material';
import axios from 'axios';

// Configure axios defaults
axios.defaults.timeout = 300000;
axios.defaults.headers.common['Content-Type'] = 'application/json';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function App() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [selectedModel, setSelectedModel] = useState('llama3.1:8b');
  const [status, setStatus] = useState({
    frontend: 'online',
    database: 'checking',
    aiModel: 'checking',
    docker: 'checking'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const models = [
    'llama3.1:8b',
    'llama3.1:3b',
    'llama3.1:1b',
    'ollama3:latest'
  ];

  useEffect(() => {
    checkStatus();
    loadSessions();
  }, []);

  const checkStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/status`);
      setStatus(response.data);
    } catch (error) {
      setError('Connection failed');
      setStatus({
        frontend: 'online',
        database: 'offline',
        aiModel: 'offline',
        docker: 'offline'
      });
    }
  };

  const loadSessions = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/sessions`);
      setSessions(response.data);
      if (response.data.length > 0 && !currentSession) {
        setCurrentSession(response.data[0].id);
        loadMessages(response.data[0].id);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const loadMessages = async (sessionId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/chat/${sessionId}`);
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const createNewSession = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/sessions`);
      const newSession = response.data;
      setSessions(prev => [newSession, ...prev]);
      setCurrentSession(newSession.id);
      setMessages([]);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentSession) return;

    const messageToSend = newMessage;
    setNewMessage('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/chat/${currentSession}`, {
        message: messageToSend,
        model: selectedModel
      });

      setMessages(prev => [...prev, response.data]);
    } catch (error) {
      setError('Failed to send message');
      console.error('Failed to send message:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          LLM Test Deployment App
        </Typography>
        
        {/* Status Chips */}
        <Box sx={{ mb: 2 }}>
          <Grid container spacing={1}>
            <Grid item>
              <Chip 
                label="Frontend" 
                color={status.frontend === 'online' ? 'success' : 'error'}
                size="small"
              />
            </Grid>
            <Grid item>
              <Chip 
                label="Database" 
                color={status.database === 'online' ? 'success' : 'error'}
                size="small"
              />
            </Grid>
            <Grid item>
              <Chip 
                label="AI Model" 
                color={status.aiModel === 'online' ? 'success' : 'error'}
                size="small"
              />
            </Grid>
            <Grid item>
              <Chip 
                label="Docker Containers" 
                color={status.docker === 'online' ? 'success' : 'error'}
                size="small"
              />
            </Grid>
          </Grid>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
      </Box>

      <Grid container spacing={3}>
        {/* Chat Interface */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, height: '70vh', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">New Chat</Typography>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Model</InputLabel>
                <Select
                  value={selectedModel}
                  label="Model"
                  onChange={(e) => setSelectedModel(e.target.value)}
                >
                  {models.map((model) => (
                    <MenuItem key={model} value={model}>
                      {model}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Messages */}
            <Box sx={{ flexGrow: 1, overflow: 'auto', mb: 2 }}>
              {messages.map((message, index) => (
                <Box key={index} sx={{ mb: 2 }}>
                  <Paper sx={{ p: 2, backgroundColor: message.role === 'user' ? '#f0f0f0' : '#e3f2fd' }}>
                    <Typography variant="body1">{message.content}</Typography>
                    {message.performance_data && (
                      <Box sx={{ mt: 1, p: 1, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                        <Typography variant="caption" color="textSecondary">
                          Performance: {JSON.stringify(message.performance_data)}
                        </Typography>
                      </Box>
                    )}
                  </Paper>
                </Box>
              ))}
              {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              )}
            </Box>

            {/* Message Input */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                multiline
                maxRows={4}
                placeholder="Type your message"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
              />
              <Button
                variant="contained"
                onClick={sendMessage}
                disabled={!newMessage.trim() || loading}
                endIcon={<Send />}
              >
                Send
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '70vh', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Chat History</Typography>
              <Tooltip title="New Session">
                <IconButton onClick={createNewSession} size="small">
                  <Add />
                </IconButton>
              </Tooltip>
            </Box>

            <List sx={{ flexGrow: 1, overflow: 'auto' }}>
              {sessions.map((session) => (
                <React.Fragment key={session.id}>
                  <ListItem 
                    button 
                    selected={currentSession === session.id}
                    onClick={() => {
                      setCurrentSession(session.id);
                      loadMessages(session.id);
                    }}
                  >
                    <ListItemText
                      primary={`Session ${session.id}`}
                      secondary={new Date(session.created_at).toLocaleString()}
                    />
                  </ListItem>
                  <Divider />
                </React.Fragment>
              ))}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}

export default App; 