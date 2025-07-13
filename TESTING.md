# Testing Strategy

This document outlines the comprehensive testing strategy for the LLM Test Application.

## Test Types

### 1. Unit Tests

#### Backend Unit Tests (`backend/test_main.py`)
- **Health Endpoints**: Test `/api/health`, `/api/db_status`, `/api/ollama_status`, `/api/docker_stats`
- **Chat Functionality**: Test chat endpoints with various scenarios
- **Session Management**: Test session creation, retrieval, and message handling
- **Error Handling**: Test 404, 405, 422, and 500 error responses
- **Mock Dependencies**: Uses mocking to isolate components

#### Frontend Unit Tests (`frontend/src/test/App.test.jsx`)
- **Component Rendering**: Test that all components render correctly
- **User Interactions**: Test typing, button clicks, form submissions
- **State Management**: Test component state changes
- **Error Handling**: Test API error scenarios
- **Responsive Design**: Test mobile and desktop layouts
- **Accessibility**: Test ARIA labels and keyboard navigation

### 2. Integration Tests (`tests/integration/test_full_stack.py`)

#### Full Stack Integration
- **Container Health**: Verify all Docker containers are running
- **API Connectivity**: Test backend endpoints with real database
- **Frontend-Backend Communication**: Test API calls from frontend
- **Database Operations**: Test session and message persistence
- **Performance Monitoring**: Test performance data collection
- **WebSocket Connections**: Test real-time updates

#### Test Scenarios
```python
# Example integration test
def test_chat_functionality(self, running_containers):
    """Test chat functionality end-to-end"""
    chat_data = {
        "message": "Hello, this is a test message",
        "model": "llama3.1:latest"
    }
    
    response = requests.post(
        "http://localhost:8000/api/ollama_chat",
        json=chat_data,
        timeout=60
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "session_id" in data
```

### 3. End-to-End Tests (`tests/e2e/app.spec.ts`)

#### Browser Testing with Playwright
- **Cross-Browser Testing**: Chrome, Firefox, Safari, Mobile
- **User Journey Testing**: Complete user workflows
- **Visual Testing**: UI rendering and styling
- **Performance Testing**: Load times and responsiveness
- **Accessibility Testing**: Screen reader compatibility

#### Test Scenarios
```typescript
// Example E2E test
test('should handle chat functionality', async ({ page }) => {
  const input = page.getByPlaceholder('Type your message...');
  const sendButton = page.getByRole('button', { name: /send/i });
  
  await input.fill('Test message');
  await expect(sendButton).toBeEnabled();
});
```

## Running Tests

### Local Development

#### Backend Tests
```bash
cd backend
pip install -r requirements.txt
python -m pytest test_main.py -v
```

#### Frontend Tests
```bash
cd frontend
npm install
npm test
npm run test:coverage
```

#### Integration Tests
```bash
# Start the application
docker-compose up -d

# Run integration tests
cd tests/integration
python -m pytest test_full_stack.py -v
```

#### E2E Tests
```bash
cd tests/e2e
npx playwright install
npx playwright test
```

### CI/CD Pipeline

The GitHub Actions workflows automatically run:

1. **Backend Tests** (`test-backend.yml`)
   - Unit tests with pytest
   - Code coverage reporting
   - Security scanning
   - Linting

2. **Frontend Tests** (`test-frontend.yml`)
   - Unit tests with Vitest
   - Code coverage reporting
   - Security scanning
   - Build verification

3. **Integration Tests** (`integration-tests.yml`)
   - Full stack integration tests
   - Database connectivity
   - API endpoint testing
   - Container health checks

4. **E2E Tests** (`integration-tests.yml`)
   - Cross-browser testing
   - User journey testing
   - Visual regression testing

## Test Coverage

### Backend Coverage
- **API Endpoints**: 100% endpoint coverage
- **Error Handling**: All error scenarios tested
- **Database Operations**: CRUD operations tested
- **External Services**: Ollama and Docker integration tested

### Frontend Coverage
- **Component Rendering**: All components tested
- **User Interactions**: All user actions tested
- **State Management**: State changes verified
- **Error Scenarios**: API failures handled

### Integration Coverage
- **Full Stack**: End-to-end workflows
- **Data Flow**: Frontend to backend communication
- **Performance**: Real-time monitoring
- **Scalability**: Container orchestration

## Test Data Management

### Fixtures
- **Test Sessions**: Pre-created chat sessions
- **Test Messages**: Sample conversation data
- **Performance Data**: Mock performance metrics
- **Error Scenarios**: Simulated failure conditions

### Database
- **Test Database**: Isolated test environment
- **Data Cleanup**: Automatic cleanup after tests
- **Migration Testing**: Database schema validation

## Performance Testing

### Load Testing
- **Concurrent Users**: Multiple simultaneous chat sessions
- **Message Volume**: High-frequency message processing
- **Memory Usage**: Container resource monitoring
- **Response Times**: API latency measurement

### Stress Testing
- **Model Loading**: Large model memory usage
- **Database Connections**: Connection pool limits
- **WebSocket Connections**: Real-time update scaling
- **Container Limits**: Resource constraint testing

## Security Testing

### Vulnerability Scanning
- **Dependency Scanning**: npm audit and safety checks
- **Code Analysis**: Static code analysis
- **Container Scanning**: Docker image security
- **API Security**: Input validation and sanitization

### Penetration Testing
- **API Endpoints**: Authentication and authorization
- **Input Validation**: SQL injection prevention
- **XSS Prevention**: Cross-site scripting protection
- **CSRF Protection**: Cross-site request forgery

## Continuous Monitoring

### Test Metrics
- **Test Execution Time**: Performance tracking
- **Coverage Reports**: Code coverage monitoring
- **Failure Rates**: Test reliability metrics
- **Flaky Tests**: Unstable test identification

### Quality Gates
- **Coverage Thresholds**: Minimum coverage requirements
- **Performance Benchmarks**: Response time limits
- **Security Standards**: Vulnerability thresholds
- **Reliability Metrics**: Test stability requirements

## Best Practices

### Test Organization
- **Clear Naming**: Descriptive test names
- **Grouped Tests**: Logical test organization
- **Documentation**: Test purpose and setup
- **Maintenance**: Regular test updates

### Test Data
- **Isolation**: Independent test data
- **Cleanup**: Automatic test cleanup
- **Realism**: Realistic test scenarios
- **Variety**: Diverse test cases

### CI/CD Integration
- **Fast Feedback**: Quick test execution
- **Parallel Execution**: Concurrent test runs
- **Artifact Management**: Test result storage
- **Notification**: Test failure alerts

## Future Enhancements

### Planned Improvements
- **Visual Regression Testing**: UI consistency checks
- **Performance Benchmarking**: Automated performance testing
- **Security Testing**: Automated security scanning
- **Load Testing**: Automated load testing
- **Mobile Testing**: Mobile-specific test scenarios

### Test Automation
- **Self-Healing Tests**: Automatic test maintenance
- **Smart Test Selection**: Intelligent test execution
- **Predictive Testing**: Failure prediction
- **Test Generation**: Automated test creation 