import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import App from '../App';

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    defaults: {
      timeout: 300000,
      headers: {
        common: {
          'Content-Type': 'application/json'
        }
      }
    }
  }
}));

// Mock WebSocket
global.WebSocket = vi.fn().mockImplementation(() => ({
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

const theme = createTheme();

const renderWithTheme = (component) => {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {component}
    </ThemeProvider>
  );
};

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the app title', () => {
    renderWithTheme(<App />);
    expect(screen.getByText(/LLM Test Deployment App/i)).toBeInTheDocument();
  });

  it('shows loading states initially', () => {
    renderWithTheme(<App />);
    expect(screen.getByText(/Database/i)).toBeInTheDocument();
    expect(screen.getByText(/AI Model/i)).toBeInTheDocument();
    expect(screen.getByText(/Docker Containers/i)).toBeInTheDocument();
  });

  it('displays chat interface', () => {
    renderWithTheme(<App />);
    expect(screen.getByText(/New Chat/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Type your message/i)).toBeInTheDocument();
  });

  it('shows model selection dropdown', () => {
    renderWithTheme(<App />);
    expect(screen.getByText(/Model/i)).toBeInTheDocument();
  });

  it('displays session list', () => {
    renderWithTheme(<App />);
    expect(screen.getByText(/Chat History/i)).toBeInTheDocument();
  });
});

describe('Status Components', () => {
  it('renders status chips', () => {
    renderWithTheme(<App />);
    expect(screen.getByText(/Frontend/i)).toBeInTheDocument();
    expect(screen.getByText(/Database/i)).toBeInTheDocument();
    expect(screen.getByText(/AI Model/i)).toBeInTheDocument();
  });
});

describe('Chat Functionality', () => {
  it('allows typing in message input', () => {
    renderWithTheme(<App />);
    const input = screen.getByPlaceholderText(/Type your message/i);
    fireEvent.change(input, { target: { value: 'Hello, AI!' } });
    expect(input.value).toBe('Hello, AI!');
  });

  it('shows send button', () => {
    renderWithTheme(<App />);
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('shows model dropdown with options', () => {
    renderWithTheme(<App />);
    // Check that the model dropdown exists
    expect(screen.getByText(/Model/i)).toBeInTheDocument();
    // The dropdown should be present (combobox role)
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});

describe('Session Management', () => {
  it('shows new session button', () => {
    renderWithTheme(<App />);
    // The button has aria-label="New Session"
    expect(screen.getByRole('button', { name: /new session/i })).toBeInTheDocument();
  });
});

describe('Error Handling', () => {
  it('handles API errors gracefully', async () => {
    const { getByText } = renderWithTheme(<App />);
    
    // Simulate API error
    const axios = await import('axios');
    axios.default.get.mockRejectedValueOnce(new Error('API Error'));
    
    await waitFor(() => {
      // The actual error message is "Connection failed" from checkStatus function
      expect(getByText(/Connection failed/i)).toBeInTheDocument();
    });
  });
});

describe('Responsive Design', () => {
  it('renders on different screen sizes', () => {
    // Test mobile view
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });
    
    renderWithTheme(<App />);
    expect(screen.getByText(/LLM Test Deployment App/i)).toBeInTheDocument();
  });
}); 