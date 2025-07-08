import React, { useEffect, useState } from 'react';
import { 
  Container, 
  Typography, 
  Card, 
  CardContent, 
  Grid, 
  TextField, 
  Button, 
  CircularProgress, 
  Box, 
  Paper,
  AppBar,
  Toolbar,
  Chip,
  Fade,
  Slide,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Divider,
  ListItemButton,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress
} from '@mui/material';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { 
  Send as SendIcon, 
  CheckCircle, 
  Error, 
  Info,
  Storage,
  Psychology,
  Apps,
  Add,
  History,
  Chat
} from '@mui/icons-material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Helper to build websocket URL from API_URL
const WS_URL = API_URL.replace('http', 'ws');

function StatusChip({ status, label, icon }) {
  return (
    <Chip
      icon={icon}
      label={label}
      color={status === 'ok' ? 'success' : status === 'loading' ? 'warning' : 'error'}
      variant="outlined"
      size="small"
    />
  );
}

function StatCard({ title, status, details, icon, color = 'primary' }) {
  return (
    <Card sx={{ mb: 2, minHeight: 120 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          {icon}
          <Typography variant="h6" sx={{ ml: 1, fontWeight: 600 }}>
            {title}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Chip 
            label={status} 
            color={status === 'ok' ? 'success' : status === 'loading' ? 'warning' : 'error'}
            size="small"
          />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
          {details}
        </Typography>
      </CardContent>
    </Card>
  );
}

// Docker containers card with gauges
function DockerCard({ status, containers, responseTime, error, history }) {
  if (status !== 'ok') {
    return (
      <StatCard
        title="Docker Containers"
        status={status}
        details={error || 'Connection failed'}
        icon={<Apps color="primary" />}
      />
    );
  }

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Apps color="primary" />
          <Typography variant="h6" sx={{ ml: 1, fontWeight: 600 }}>
            Docker Containers
          </Typography>
          <Chip
            label={status}
            color="success"
            size="small"
            sx={{ ml: 1 }}
          />
          {responseTime !== null && (
            <Typography variant="caption" sx={{ ml: 1 }}>
              {responseTime.toFixed(2)}s
            </Typography>
          )}
        </Box>
        {containers.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No running containers
          </Typography>
        )}
        {containers.map((c, idx) => {
          const hist = history[c.name] || { cpu: [], mem: [] };
          const data = hist.cpu.map((v,i)=>({idx:i, cpu:v, mem: hist.mem[i] || 0}));
          return (
            <Box key={idx} sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {c.name}
              </Typography>
              <ResponsiveContainer width="100%" height={50}>
                <LineChart data={data} margin={{top:4,right:4,left:0,bottom:4}}>
                  <Line type="monotone" dataKey="cpu" stroke="#4caf50" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="mem" stroke="#2196f3" dot={false} strokeWidth={2} />
                  <XAxis dataKey="idx" hide={true} />
                  <YAxis domain={[0,100]} hide={true} />
                  <Tooltip formatter={(value,name)=>[value.toFixed(1)+'%', name==='cpu'?'CPU':'RAM']} />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ChatMessage({ message, isUser }) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        mb: 2,
      }}
    >
      <Paper
        sx={{
          p: 2,
          maxWidth: '70%',
          backgroundColor: isUser ? 'primary.main' : 'grey.100',
          color: isUser ? 'white' : 'text.primary',
          borderRadius: 2,
        }}
      >
        <Typography variant="body1">{message}</Typography>
      </Paper>
    </Box>
  );
}

function ChatWindow({ currentSession, onSessionChange }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Load messages when session changes
  useEffect(() => {
    if (currentSession) {
      loadSessionMessages(currentSession.id);
    } else {
      setMessages([]);
    }
  }, [currentSession]);

  const loadSessionMessages = async (sessionId) => {
    try {
      const res = await axios.get(`${API_URL}/api/sessions/${sessionId}/messages`);
      if (res.data.status === 'ok') {
        setMessages(res.data.messages);
      }
    } catch (e) {
      console.error('Error loading messages:', e);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    const userMessage = input.trim();
    setInput('');
    setLoading(true);
    
    try {
      console.log('Sending message:', userMessage);
      const res = await axios.post(`${API_URL}/api/ollama_chat`, { 
        message: userMessage,
        session_id: currentSession?.id
      });
      
      console.log('Response received:', res.data);
      
      if (res.data.status === 'ok') {
        // Reload messages to get the updated conversation
        await loadSessionMessages(res.data.session_id);
        
        // Update current session if it's a new one
        if (!currentSession && res.data.session_id) {
          onSessionChange({ id: res.data.session_id, title: 'New Chat' });
        }
      } else {
        console.error('API error:', res.data.error);
        setMessages(msgs => [...msgs, { role: 'ai', content: 'Error: ' + res.data.error }]);
      }
    } catch (e) {
      console.error('Network error:', e);
      setMessages(msgs => [...msgs, { role: 'ai', content: 'Error: ' + e.message }]);
    }
    setLoading(false);
  };

  return (
    <Box sx={{ height: '70vh', display: 'flex', flexDirection: 'column' }}>
      {/* Chat Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper' }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {currentSession ? currentSession.title : 'New Chat'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {currentSession ? 'Continue your conversation' : 'Start a new conversation'}
        </Typography>
      </Box>

      {/* Messages Area */}
      <Box 
        sx={{ 
          flex: 1, 
          overflowY: 'auto', 
          p: 2,
          backgroundColor: 'grey.50',
          display: 'flex',
          flexDirection: 'column',
          gap: 1
        }}
      >
        {messages.length === 0 && !loading && (
          <Box sx={{ textAlign: 'center', mt: 4, color: 'text.secondary' }}>
            <Typography variant="h6" gutterBottom>
              {currentSession ? 'Continue your conversation' : 'Welcome to Mistral AI Chat'}
            </Typography>
            <Typography variant="body2">
              {currentSession ? 'Type a message to continue' : 'Start a conversation by typing a message below'}
            </Typography>
          </Box>
        )}
        
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg.content} isUser={msg.role === 'user'} />
        ))}
        
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
            <Paper sx={{ p: 2, backgroundColor: 'grey.100', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  Searching and thinking...
                </Typography>
              </Box>
            </Paper>
          </Box>
        )}
      </Box>

      {/* Input Area */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', backgroundColor: 'background.paper' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && sendMessage()}
            disabled={loading}
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
              }
            }}
          />
          <Button
            variant="contained"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            sx={{ borderRadius: 3, minWidth: 48 }}
          >
            <SendIcon />
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

function SessionList({ sessions, currentSession, onSessionSelect, onNewSession }) {
  const [newSessionDialog, setNewSessionDialog] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');

  const handleNewSession = async () => {
    try {
      const res = await axios.post(`${API_URL}/api/sessions`, { 
        title: newSessionTitle || undefined 
      });
      if (res.data.status === 'ok') {
        onNewSession({ id: res.data.session_id, title: newSessionTitle || 'New Chat' });
        setNewSessionTitle('');
        setNewSessionDialog(false);
      }
    } catch (e) {
      console.error('Error creating session:', e);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Chat History
        </Typography>
        <IconButton onClick={() => setNewSessionDialog(true)} size="small">
          <Add />
        </IconButton>
      </Box>
      
      <List sx={{ maxHeight: 300, overflow: 'auto' }}>
        {sessions.map((session) => (
          <ListItem key={session.id} disablePadding>
            <ListItemButton
              selected={currentSession?.id === session.id}
              onClick={() => onSessionSelect(session)}
              sx={{ borderRadius: 1, mb: 0.5 }}
            >
              <Chat sx={{ mr: 1, fontSize: 20 }} />
              <ListItemText
                primary={session.title}
                secondary={new Date(session.updated_at).toLocaleDateString()}
                primaryTypographyProps={{ fontSize: '0.9rem' }}
                secondaryTypographyProps={{ fontSize: '0.75rem' }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Dialog open={newSessionDialog} onClose={() => setNewSessionDialog(false)}>
        <DialogTitle>New Chat Session</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Session Title (optional)"
            fullWidth
            variant="outlined"
            value={newSessionTitle}
            onChange={(e) => setNewSessionTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleNewSession()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewSessionDialog(false)}>Cancel</Button>
          <Button onClick={handleNewSession} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function App() {
  const [frontendStatus, setFrontendStatus] = useState('ok');
  const [dbStatus, setDbStatus] = useState({ status: 'loading', details: 'Loading...' });
  const [ollamaStatus, setOllamaStatus] = useState({ status: 'loading', details: 'Loading...' });
  const [dockerStatus, setDockerStatus] = useState({ status: 'loading', containers: [], responseTime: null, error: null });
  const [dockerHistory, setDockerHistory] = useState({}); // { containerName: { cpu: [], mem: [] } }
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);

  const fetchStatuses = async () => {
    const t0 = performance.now();
    try {
      console.log('Fetching statuses from:', API_URL);
      const [dbRes, ollamaRes, dockerRes] = await Promise.all([
        axios.get(`${API_URL}/api/db_status?t=${Date.now()}`),
        axios.get(`${API_URL}/api/ollama_status?t=${Date.now()}`),
        axios.get(`${API_URL}/api/docker_stats?t=${Date.now()}`)
      ]);
      const t1 = performance.now();
      const dbTime = dbRes.data.response_time || null;
      const ollamaTime = ollamaRes.data.response_time || null;
      const dockerTime = dockerRes.data.response_time || null;
      console.log('DB response:', dbRes.data, 'Time:', dbTime);
      console.log('Ollama response:', ollamaRes.data, 'Time:', ollamaTime);
      console.log('Docker response:', dockerRes.data, 'Time:', dockerTime);
      setDbStatus({
        status: dbRes.data.status === 'ok' ? 'ok' : 'error',
        details: dbRes.data.status === 'ok' ? 
          `Tables: ${dbRes.data.table_count || 0}, Sessions: ${dbRes.data.session_count || 0}, Messages: ${dbRes.data.message_count || 0} (Time: ${dbTime ? dbTime.toFixed(2) + 's' : 'n/a'})` : 
          (dbRes.data.error || 'Connection failed') + (dbTime ? ` (Time: ${dbTime.toFixed(2)}s)` : '')
      });
      setOllamaStatus({
        status: ollamaRes.data.status === 'ok' ? 'ok' : 'error',
        details: ollamaRes.data.status === 'ok' ? 
          `Models: ${ollamaRes.data.models?.map(m => m.name).join(', ') || 'No models found'} (Time: ${ollamaTime ? ollamaTime.toFixed(2) + 's' : 'n/a'})` : 
          (ollamaRes.data.error || 'Connection failed') + (ollamaTime ? ` (Time: ${ollamaTime.toFixed(2)}s)` : '')
      });
      setDockerStatus({
        status: dockerRes.data.status === 'ok' ? 'ok' : 'error',
        containers: dockerRes.data.containers || [],
        responseTime: dockerTime,
        error: dockerRes.data.error || null
      });
      // update history
      setDockerHistory(prev => {
        const updated = { ...prev };
        const list = dockerRes.data.containers || [];
        list.forEach(c => {
          if (!updated[c.name]) {
            updated[c.name] = { cpu: [], mem: [] };
          }
          updated[c.name].cpu = [...updated[c.name].cpu.slice(-19), c.cpu_percent];
          updated[c.name].mem = [...updated[c.name].mem.slice(-19), c.mem_percent];
        });
        return updated;
      });
      setStatusLoaded(true);
      console.log(`Total status fetch time: ${(t1-t0).toFixed(2)}ms`);
    } catch (e) {
      const t1 = performance.now();
      console.error('Error fetching statuses:', e);
      setDbStatus({ status: 'error', details: e.message || 'Connection failed' });
      setOllamaStatus({ status: 'error', details: e.message || 'Connection failed' });
      setDockerStatus({ status: 'error', details: e.message || 'Connection failed' });
      setStatusLoaded(true);
      console.log(`Total status fetch time (error): ${(t1-t0).toFixed(2)}ms`);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/sessions`);
      if (res.data.status === 'ok') {
        setSessions(res.data.sessions);
      }
    } catch (e) {
      console.error('Error fetching sessions:', e);
    }
  };

  useEffect(() => {
    fetchStatuses();
    fetchSessions();
    // Check status every 30 seconds instead of 5 seconds to reduce flickering
    const interval = setInterval(fetchStatuses, 30000);
    return () => clearInterval(interval);
  }, []);

  // --- WebSocket for live docker stats ---
  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/ws/docker_stats`);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const list = msg.containers || [];

        setDockerStatus(prev => ({
          status: 'ok',
          containers: list,
          responseTime: 0,
          error: null
        }));

        // update history
        setDockerHistory(prev => {
          const updated = { ...prev };
          list.forEach(c => {
            if (!updated[c.name]) updated[c.name] = { cpu: [], mem: [] };
            updated[c.name].cpu = [...updated[c.name].cpu.slice(-119), c.cpu_percent];
            updated[c.name].mem = [...updated[c.name].mem.slice(-119), c.mem_percent];
          });
          return updated;
        });
      } catch {}
    };

    ws.onerror = () => {
      console.error('Docker WS error');
    };

    return () => ws.close();
  }, []);

  const handleSessionSelect = (session) => {
    setCurrentSession(session);
  };

  const handleNewSession = (session) => {
    setCurrentSession(session);
    fetchSessions(); // Refresh the session list
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'grey.50' }}>
      {/* Header */}
      <AppBar position="static" elevation={0} sx={{ backgroundColor: 'white', color: 'text.primary' }}>
        <Toolbar>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
            LLM Test Deployment App
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <StatusChip 
              status={frontendStatus} 
              label="Frontend" 
              icon={<CheckCircle />} 
            />
            <StatusChip 
              status={dbStatus.status} 
              label="Database" 
              icon={dbStatus.status === 'ok' ? <CheckCircle /> : <Error />} 
            />
            <StatusChip 
              status={ollamaStatus.status} 
              label="AI Model" 
              icon={ollamaStatus.status === 'ok' ? <CheckCircle /> : <Error />} 
            />
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
        {/* Sidebar */}
        <Box sx={{ width: 350, p: 2, backgroundColor: 'white', borderRight: 1, borderColor: 'divider', overflowY: 'auto' }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            System Status
          </Typography>
          <Box sx={{ mb: 3 }}>
            <StatCard
              title="Database"
              status={dbStatus.status}
              details={dbStatus.details}
              icon={<Storage color="primary" />}
            />
            <StatCard
              title="AI Model"
              status={ollamaStatus.status}
              details={ollamaStatus.details}
              icon={<Psychology color="primary" />}
            />
            <DockerCard 
              status={dockerStatus.status} 
              containers={dockerStatus.containers} 
              responseTime={dockerStatus.responseTime}
              error={dockerStatus.error}
              history={dockerHistory}
            />
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          <SessionList
            sessions={sessions}
            currentSession={currentSession}
            onSessionSelect={handleSessionSelect}
            onNewSession={handleNewSession}
          />
        </Box>

        {/* Chat Area */}
        <Box sx={{ flex: 1, p: 2 }}>
          <Paper 
            elevation={0} 
            sx={{ 
              borderRadius: 3, 
              overflow: 'hidden',
              border: 1,
              borderColor: 'divider',
              height: '100%'
            }}
          >
            <ChatWindow 
              currentSession={currentSession}
              onSessionChange={setCurrentSession}
            />
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}

export default App; 