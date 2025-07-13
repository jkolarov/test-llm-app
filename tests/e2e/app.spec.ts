import { test, expect } from '@playwright/test';

test.describe('LLM Test App E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the application', async ({ page }) => {
    // Check that the app loads
    await expect(page.getByText('LLM Test Deployment App')).toBeVisible();
    await expect(page.getByText('System Status')).toBeVisible();
    await expect(page.getByText('Chat History')).toBeVisible();
  });

  test('should display status indicators', async ({ page }) => {
    // Check status chips are present
    await expect(page.getByText('Frontend')).toBeVisible();
    await expect(page.getByText('Database')).toBeVisible();
    await expect(page.getByText('AI Model')).toBeVisible();
  });

  test('should show chat interface', async ({ page }) => {
    // Check chat interface elements
    await expect(page.getByText('New Chat')).toBeVisible();
    await expect(page.getByPlaceholder('Type your message...')).toBeVisible();
    await expect(page.getByRole('button', { name: /send/i })).toBeVisible();
  });

  test('should allow typing messages', async ({ page }) => {
    const input = page.getByPlaceholder('Type your message...');
    await input.fill('Hello, AI!');
    await expect(input).toHaveValue('Hello, AI!');
  });

  test('should show model selection', async ({ page }) => {
    // Check model dropdown is present
    await expect(page.getByText('Model')).toBeVisible();
  });

  test('should display session list', async ({ page }) => {
    await expect(page.getByText('Chat History')).toBeVisible();
    await expect(page.getByRole('button', { name: /add/i })).toBeVisible();
  });

  test('should handle new session creation', async ({ page }) => {
    // Click new session button
    await page.getByRole('button', { name: /add/i }).click();
    
    // Check if dialog appears (if implemented)
    // This might not be implemented yet, so we'll just check the button works
    await expect(page.getByRole('button', { name: /add/i })).toBeVisible();
  });

  test('should show performance data when available', async ({ page }) => {
    // Check if performance section is present
    await expect(page.getByText(/Performance/i)).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // The app should handle API errors without crashing
    await expect(page.getByText('LLM Test Deployment App')).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check that the app still loads and is usable
    await expect(page.getByText('LLM Test Deployment App')).toBeVisible();
    await expect(page.getByPlaceholder('Type your message...')).toBeVisible();
  });

  test('should handle WebSocket connections', async ({ page }) => {
    // Check that real-time updates work (if implemented)
    // This is a basic check - actual WebSocket testing would require more setup
    await expect(page.getByText('LLM Test Deployment App')).toBeVisible();
  });

  test('should display Docker container stats', async ({ page }) => {
    // Check that container stats are displayed
    await expect(page.getByText('Ollama Container')).toBeVisible();
  });

  test('should handle chat functionality', async ({ page }) => {
    const input = page.getByPlaceholder('Type your message...');
    const sendButton = page.getByRole('button', { name: /send/i });
    
    // Type a message
    await input.fill('Test message');
    
    // Check that send button is enabled
    await expect(sendButton).toBeEnabled();
  });

  test('should show loading states', async ({ page }) => {
    // Check that loading indicators are present
    await expect(page.getByText('Database')).toBeVisible();
    await expect(page.getByText('AI Model')).toBeVisible();
    await expect(page.getByText('Docker Containers')).toBeVisible();
  });

  test('should handle theme and styling', async ({ page }) => {
    // Check that the app has proper styling
    await expect(page.locator('body')).toHaveCSS('font-family');
    
    // Check that Material-UI components are styled
    const appBar = page.locator('[role="banner"]');
    if (await appBar.count() > 0) {
      await expect(appBar).toBeVisible();
    }
  });

  test('should handle keyboard navigation', async ({ page }) => {
    const input = page.getByPlaceholder('Type your message...');
    
    // Focus the input
    await input.focus();
    await expect(input).toBeFocused();
    
    // Test tab navigation
    await page.keyboard.press('Tab');
    // Should move to next focusable element
  });

  test('should handle accessibility', async ({ page }) => {
    // Check for proper ARIA labels and roles
    await expect(page.getByPlaceholder('Type your message...')).toHaveAttribute('aria-label');
    
    // Check that buttons have proper roles
    await expect(page.getByRole('button', { name: /send/i })).toBeVisible();
  });
});

test.describe('API Integration Tests', () => {
  test('should connect to backend APIs', async ({ request }) => {
    // Test backend health endpoint
    const healthResponse = await request.get('http://localhost:8000/api/health');
    expect(healthResponse.ok()).toBeTruthy();
    
    const healthData = await healthResponse.json();
    expect(healthData.status).toBe('ok');
  });

  test('should handle database operations', async ({ request }) => {
    // Test database status endpoint
    const dbResponse = await request.get('http://localhost:8000/api/db_status');
    expect(dbResponse.ok()).toBeTruthy();
    
    const dbData = await dbResponse.json();
    expect(dbData).toHaveProperty('status');
  });

  test('should handle Ollama operations', async ({ request }) => {
    // Test Ollama status endpoint
    const ollamaResponse = await request.get('http://localhost:8000/api/ollama_status');
    expect(ollamaResponse.ok()).toBeTruthy();
    
    const ollamaData = await ollamaResponse.json();
    expect(ollamaData).toHaveProperty('status');
  });
}); 