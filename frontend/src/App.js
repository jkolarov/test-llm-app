import React, { useEffect, useState } from 'react';
import { Container, Typography, Card, CardContent, Grid, TextField, Button, CircularProgress, Box, Paper } from '@mui/material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function StatusCard({ title, status, details, loading }) {
  return (
    <Card sx={{ minWidth: 200, mb: 2 }}>
      <CardContent>
        <Typography variant="h6">{title}</Typography>
        {loading ? <CircularProgress size={20} /> : <Typography color={status === 'ok' ? 'green' : 'red'}>{status}</Typography>}
        {details && <Typography variant="body2">{details}</Typography>}
      </CardContent>
    </Card>
  );
}

function ChatWindow() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    setMessages(msgs => [...msgs, { role: 'user', content: input }]);
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/ollama_chat`, { message: input });
      if (res.data.status === 'ok') {
        setMessages(msgs => [...msgs, { role: 'ai', content: res.data.response }]);
      } else {
        setMessages(msgs => [...msgs, { role: 'ai', content: 'Error: ' + res.data.error }]);
      }
    } catch (e) {
      setMessages(msgs => [...msgs, { role: 'ai', content: 'Error: ' + e.message }]);
    }
    setInput('');
    setLoading(false);
  };

  return (
    <Paper sx={{ p: 2, mt: 2 }}>
      <Typography variant="h6">Ollama Chat</Typography>
      <Box sx={{ minHeight: 120, maxHeight: 200, overflowY: 'auto', mb: 1, p: 1, bgcolor: '#f5f5f5' }}>
        {messages.map((msg, i) => (
          <Typography key={i} align={msg.role === 'user' ? 'right' : 'left'} color={msg.role === 'user' ? 'primary' : 'secondary'}>
            <b>{msg.role === 'user' ? 'You' : 'AI'}:</b> {msg.content}
          </Typography>
        ))}
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          size="small"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && sendMessage()}
          placeholder="Type your message..."
          disabled={loading}
        />
        <Button variant="contained" onClick={sendMessage} disabled={loading || !input.trim()}>Send</Button>
      </Box>
    </Paper>
  );
}

function App() {
  const [frontendStatus, setFrontendStatus] = useState('ok');
  const [dbStatus, setDbStatus] = useState({ status: 'loading', details: '' });
  const [ollamaStatus, setOllamaStatus] = useState({ status: 'loading', details: '' });

  const fetchDbStatus = async () => {
    setDbStatus({ status: 'loading' });
    try {
      const res = await axios.get(`${API_URL}/api/db_status`);
      if (res.data.status === 'ok') {
        setDbStatus({ status: 'ok', details: `Tables: ${res.data.table_count}` });
      } else {
        setDbStatus({ status: 'error', details: res.data.error });
      }
    } catch (e) {
      setDbStatus({ status: 'error', details: e.message });
    }
  };

  const fetchOllamaStatus = async () => {
    setOllamaStatus({ status: 'loading' });
    try {
      const res = await axios.get(`${API_URL}/api/ollama_status`);
      if (res.data.status === 'ok') {
        const models = res.data.models.map(m => m.name).join(', ');
        setOllamaStatus({ status: 'ok', details: `Models: ${models}` });
      } else {
        setOllamaStatus({ status: 'error', details: res.data.error });
      }
    } catch (e) {
      setOllamaStatus({ status: 'error', details: e.message });
    }
  };

  useEffect(() => {
    fetchDbStatus();
    fetchOllamaStatus();
    const interval = setInterval(() => {
      fetchDbStatus();
      fetchOllamaStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>Ollama Test App</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <StatusCard title="Frontend" status={frontendStatus} details={"Frontend is running"} loading={false} />
        </Grid>
        <Grid item xs={12}>
          <StatusCard title="Database" status={dbStatus.status} details={dbStatus.details} loading={dbStatus.status === 'loading'} />
        </Grid>
        <Grid item xs={12}>
          <StatusCard title="Ollama Model" status={ollamaStatus.status} details={ollamaStatus.details} loading={ollamaStatus.status === 'loading'} />
        </Grid>
      </Grid>
      <ChatWindow />
    </Container>
  );
}

export default App; 