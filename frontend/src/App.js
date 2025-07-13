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

// Configure axios defaults
axios.defaults.timeout = 300000; // 5 minutes timeout for large models
axios.defaults.headers.common['Content-Type'] = 'application/json';

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
            Ollama Container
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
        {containers
          .filter(c => c.name === 'test-llm-app-ollama-1')
          .map((c, idx) => {
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

function ChatMessage({ message, isUser, performanceData }) {
  const getPerformanceScore = (tokensPerSecond) => {
    if (tokensPerSecond >= 100) return { score: 'Fast', color: 'success', value: tokensPerSecond };
    if (tokensPerSecond >= 50) return { score: 'Good', color: 'warning', value: tokensPerSecond };
    if (tokensPerSecond >= 20) return { score: 'Slow', color: 'error', value: tokensPerSecond };
    return { score: 'Very Slow', color: 'error', value: tokensPerSecond };
  };

  const performanceScore = performanceData ? getPerformanceScore(performanceData.eval_rate) : null;

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
        {!isUser && performanceData && (
          <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">
              Performance: {performanceData.total_duration.toFixed(2)}s total
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <Chip 
                label={`${performanceScore.score} (${performanceScore.value.toFixed(1)} tokens/s)`}
                color={performanceScore.color}
                size="small"
              />
              <Typography variant="caption" color="text.secondary">
                {performanceData.eval_count} tokens generated
              </Typography>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
}

function ChatWindow({ currentSession, onSessionChange }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState('mistral:7b');
  const availableModels = ['mistral:7b', 'phi3:mini', 'llama3.1:latest'];
  const messagesEndRef = React.useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

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
        // Use performance_data from database (will be null for old messages)
        const messagesWithPerformance = res.data.messages.map(msg => ({
          ...msg,
          performanceData: msg.performance_data || msg.performanceData
        }));
        setMessages(messagesWithPerformance);
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
      const res = await axios.post(`${API_URL}/api/ollama_chat`, { 
        message: userMessage,
        session_id: currentSession?.id,
        model // <-- send selected model
      });
      
      if (res.data.status === 'ok') {
        // Reload messages to get the updated conversation with performance data
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
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {currentSession ? currentSession.title : 'New Chat'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {currentSession ? 'Continue your conversation' : 'Start a new conversation'}
          </Typography>
        </Box>
        <Box>
          <TextField
            select
            label="Model"
            value={model}
            onChange={e => setModel(e.target.value)}
            size="small"
            SelectProps={{ native: true }}
            sx={{ minWidth: 160 }}
          >
            {availableModels.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </TextField>
        </Box>
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
              {currentSession ? 'Continue your conversation' : 'Welcome to AI Chat'}
            </Typography>
            <Typography variant="body2">
              {currentSession ? 'Type a message to continue' : 'Start a conversation by typing a message below'}
            </Typography>
          </Box>
        )}
        
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg.content} isUser={msg.role === 'user'} performanceData={msg.performanceData} />
        ))}
        
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
            <Paper sx={{ p: 2, backgroundColor: 'grey.100', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  Model {model} is thinking...
                </Typography>
              </Box>
            </Paper>
          </Box>
        )}
        <div ref={messagesEndRef} />
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

  const waitForBackend = async (maxRetries = 10, delay = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        // Try using fetch instead of axios
        const response = await fetch(`${API_URL}/api/health`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          mode: 'cors'
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return true;
      } catch (error) {
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    return false;
  };

  const fetchStatuses = async () => {
    const t0 = performance.now();
    try {
      // Try to wait for backend to be ready, but don't fail if it doesn't work
      let backendReady = false;
      try {
        backendReady = await waitForBackend(3, 2000); // Shorter timeout for faster failure
      } catch (e) {
        // Proceed anyway
      }
      
      // Fetch all statuses in parallel
      const [dbRes, ollamaRes, dockerRes] = await Promise.allSettled([
        axios.get(`${API_URL}/api/db_status`),
        axios.get(`${API_URL}/api/ollama_status`),
        axios.get(`${API_URL}/api/docker_stats`)
      ]);
      
      const dbTime = dbRes.status === 'fulfilled' ? dbRes.value.data.response_time : null;
      const ollamaTime = ollamaRes.status === 'fulfilled' ? ollamaRes.value.data.response_time : null;
      const dockerTime = dockerRes.status === 'fulfilled' ? dockerRes.value.data.response_time : null;
      
      setDbStatus({
        status: dbRes.status === 'fulfilled' && dbRes.value.data.status === 'ok' ? 'ok' : 'error',
        details: dbRes.status === 'fulfilled' && dbRes.value.data.status === 'ok' ? 
          `Tables: ${dbRes.value.data.table_count || 0}, Sessions: ${dbRes.value.data.session_count || 0}, Messages: ${dbRes.value.data.message_count || 0} (Time: ${dbTime ? dbTime.toFixed(2) + 's' : 'n/a'})` : 
          'Connection failed'
      });
      setOllamaStatus({
        status: ollamaRes.status === 'fulfilled' && ollamaRes.value.data.status === 'ok' ? 'ok' : 'error',
        details: ollamaRes.status === 'fulfilled' && ollamaRes.value.data.status === 'ok' ? 
          `Models: ${ollamaRes.value.data.models?.join(', ') || 'No models found'} (Time: ${ollamaTime ? ollamaTime.toFixed(2) + 's' : 'n/a'})` : 
          'Connection failed'
      });
      setDockerStatus({
        status: dockerRes.status === 'fulfilled' && dockerRes.value.data.status === 'ok' ? 'ok' : 'error',
        containers: dockerRes.status === 'fulfilled' ? dockerRes.value.data.containers || [] : [],
        responseTime: dockerTime,
        error: dockerRes.status === 'fulfilled' ? dockerRes.value.data.error || null : 'Connection failed'
      });
      
      // Update history
      if (dockerRes.status === 'fulfilled' && dockerRes.value.data.containers) {
        setDockerHistory(prev => {
          const updated = { ...prev };
          const list = dockerRes.value.data.containers;
          list.forEach(c => {
            if (!updated[c.name]) {
              updated[c.name] = { cpu: [], mem: [] };
            }
            updated[c.name].cpu = [...updated[c.name].cpu.slice(-19), c.cpu_percent];
            updated[c.name].mem = [...updated[c.name].mem.slice(-19), c.mem_percent];
          });
          return updated;
        });
      }
      
      setStatusLoaded(true);
      const t1 = performance.now();
    } catch (e) {
      setDbStatus({ status: 'error', details: 'Network error' });
      setOllamaStatus({ status: 'error', details: 'Network error' });
      setDockerStatus({ status: 'error', containers: [], responseTime: null, error: 'Network error' });
      setStatusLoaded(true);
      const t1 = performance.now();
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
    // Add a small delay to ensure everything is ready
    const timer = setTimeout(() => {
      fetchStatuses();
      fetchSessions();
    }, 1000);
    
    // Check status every 30 seconds instead of 5 seconds to reduce flickering
    const interval = setInterval(fetchStatuses, 30000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  // --- WebSocket for live docker stats ---
  useEffect(() => {
    const connectWebSocket = async () => {
      // Wait for backend to be ready before connecting WebSocket
      const backendReady = await waitForBackend(5, 2000);
      if (!backendReady) {
        console.error('Backend not ready for WebSocket connection');
        return;
      }

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

      return ws;
    };

    let ws = null;
    connectWebSocket().then(websocket => {
      ws = websocket;
    });

    return () => {
      if (ws) ws.close();
    };
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