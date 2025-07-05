# Selenium Testing Framework

This document describes the automated end-to-end testing framework for the YUI Protocol using Selenium WebDriver.

## Overview

The Selenium testing framework provides comprehensive automated testing of the YUI Protocol web application, covering user interactions, stage progression, session management, and UI behavior across different scenarios.

## Prerequisites

### System Requirements
- Node.js 18+
- Chrome browser installed
- ChromeDriver (automatically managed by selenium-webdriver)

### Dependencies
```bash
npm install selenium-webdriver
```

## Test Scripts

### 1. Console Log Testing (`test-console-log.cjs`)
**Purpose**: Tests console logging functionality and message display
**Coverage**:
- Console message logging
- Message formatting and display
- Error handling in console output
- Log persistence across sessions

**Usage**:
```bash
npm run test:console
```

### 2. System Messages Testing (`test-system-messages.cjs`)
**Purpose**: Tests system message generation and display
**Coverage**:
- System message creation
- Message categorization
- Display formatting
- Message persistence

**Usage**:
```bash
npm run test:system
```

### 3. Session Progression Testing (`test-session-progression.cjs`)
**Purpose**: Tests the complete 5-stage dialogue progression
**Coverage**:
- Stage 1: Individual Thought
- Stage 2: Mutual Reflection
- Stage 3: Conflict Resolution
- Stage 4: Synthesis Attempt
- Stage 5: Output Generation
- Stage transitions and timing
- Progress indicators

**Usage**:
```bash
npm run test:progression
```

### 4. Stage Indicator Testing (`test-stage-indicator.cjs`)
**Purpose**: Tests stage indicator UI behavior
**Coverage**:
- Stage indicator display
- Progress visualization
- Stage label updates
- Color coding and styling
- Responsive behavior

**Usage**:
```bash
npm run test:stage-indicator
```

### 5. Stage Indicator Disappear Testing (`test-stage-indicator-disappear.cjs`)
**Purpose**: Tests stage indicator behavior when stages complete
**Coverage**:
- Indicator disappearance on completion
- Animation and transitions
- State management
- UI cleanup

**Usage**:
```bash
npm run test:stage-disappear
```

### 6. Stage Indicator Sequence Testing (`test-stage-indicator-sequence.cjs`)
**Purpose**: Tests stage indicator behavior across multiple stage sequences
**Coverage**:
- Sequential stage progression
- Indicator state persistence
- Multiple session handling
- Cross-session state management

**Usage**:
```bash
npm run test:stage-indicator-sequence
```

### 7. Reset Sequence Testing (`test-reset-sequence.cjs`)
**Purpose**: Tests session reset and restart functionality
**Coverage**:
- Session reset behavior
- State cleanup
- Restart functionality
- Data persistence after reset

**Usage**:
```bash
npm run test:reset-sequence
```

### 8. Session ID Testing (`test-session-id.cjs`)
**Purpose**: Tests session ID generation and management
**Coverage**:
- Session ID creation
- ID uniqueness
- ID persistence
- URL routing with session IDs

**Usage**:
```bash
npm run test:session-id
```

## Configuration

### Test Environment Setup

1. **Server Configuration**:
   - Development server runs on port 3000 (Vite)
   - Backend server runs on port 3001
   - Ensure both servers are running before executing tests

2. **Browser Configuration**:
   - Tests use Chrome browser by default
   - ChromeDriver is automatically managed
   - Headless mode supported for CI/CD

3. **Test Data**:
   - Test sessions are created with unique IDs
   - Sample prompts are provided for testing
   - Cleanup is performed after each test

### Environment Variables

```bash
# Test Configuration
TEST_BASE_URL=http://localhost:3000
TEST_API_URL=http://localhost:3001
TEST_TIMEOUT=30000
TEST_HEADLESS=false

# Browser Configuration
CHROME_HEADLESS=false
CHROME_WINDOW_SIZE=1920,1080
```

## Running Tests

### Individual Test Execution

```bash
# Run specific test
npm run test:console
npm run test:system
npm run test:progression
npm run test:stage-indicator
npm run test:stage-disappear
npm run test:reset-sequence
npm run test:session-id
npm run test:stage-indicator-sequence
```

### Batch Test Execution

```bash
# Run all Selenium tests
npm run test:selenium
```

### CI/CD Integration

```bash
# Run tests in headless mode for CI
CHROME_HEADLESS=true npm run test:selenium
```

## Test Structure

### Common Test Framework

All test scripts follow a common structure:

```javascript
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

class TestFramework {
  constructor() {
    this.driver = null;
    this.baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';
    this.apiUrl = process.env.TEST_API_URL || 'http://localhost:3001';
  }

  async setup() {
    // Browser setup
  }

  async teardown() {
    // Cleanup
  }

  async runTest() {
    // Test implementation
  }
}
```

### Test Utilities

Common utilities available across all tests:

```javascript
// Wait for element
async waitForElement(selector, timeout = 10000) {
  return await this.driver.wait(until.elementLocated(By.css(selector)), timeout);
}

// Click element
async clickElement(selector) {
  const element = await this.waitForElement(selector);
  await element.click();
}

// Input text
async inputText(selector, text) {
  const element = await this.waitForElement(selector);
  await element.clear();
  await element.sendKeys(text);
}

// Get element text
async getElementText(selector) {
  const element = await this.waitForElement(selector);
  return await element.getText();
}
```

## Test Scenarios

### 1. Basic Functionality Tests
- Application startup and loading
- Navigation and routing
- Basic UI interactions
- Form submission and validation

### 2. Session Management Tests
- Session creation and persistence
- Session switching and navigation
- Session cleanup and reset
- URL-based session access

### 3. Stage Progression Tests
- Complete 5-stage dialogue flow
- Stage transitions and timing
- Progress indicators and updates
- Error handling during progression

### 4. UI Behavior Tests
- Responsive design testing
- Animation and transition testing
- Accessibility testing
- Cross-browser compatibility

### 5. Error Handling Tests
- Network error scenarios
- API failure handling
- Invalid input handling
- Graceful degradation

## Debugging

### Logging

Tests include comprehensive logging:

```javascript
console.log(`[Test] Starting test: ${testName}`);
console.log(`[Test] Current URL: ${await this.driver.getCurrentUrl()}`);
console.log(`[Test] Element found: ${selector}`);
```

### Screenshots

Automatic screenshot capture on failure:

```javascript
if (process.env.CAPTURE_SCREENSHOTS === 'true') {
  await this.driver.takeScreenshot().then(
    data => require('fs').writeFileSync(`test-screenshot-${Date.now()}.png`, data, 'base64')
  );
}
```

### Video Recording

Optional video recording for debugging:

```javascript
if (process.env.RECORD_VIDEO === 'true') {
  // Video recording setup
}
```

## Performance Testing

### Load Testing

```bash
# Run performance tests
npm run test:performance
```

### Metrics Collection

- Page load times
- Stage execution times
- Memory usage
- CPU utilization

## Continuous Integration

### GitHub Actions

```yaml
name: Selenium Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - run: npm run server &
      - run: npm run dev &
      - run: npm run test:selenium
```

### Docker Integration

```dockerfile
FROM node:18
RUN apt-get update && apt-get install -y chromium-browser
ENV CHROME_BIN=/usr/bin/chromium-browser
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "run", "test:selenium"]
```

## Troubleshooting

### Common Issues

1. **ChromeDriver Version Mismatch**:
   ```bash
   npm install chromedriver@latest
   ```

2. **Port Conflicts**:
   ```bash
   # Check for running processes
   lsof -i :3000
   lsof -i :3001
   ```

3. **Browser Crashes**:
   ```bash
   # Increase memory limit
   CHROME_ARGS="--max-old-space-size=4096" npm run test:selenium
   ```

### Debug Mode

```bash
# Run tests in debug mode
DEBUG=true npm run test:selenium
```

## Best Practices

1. **Test Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Always clean up test data and browser state
3. **Timeouts**: Use appropriate timeouts for different operations
4. **Error Handling**: Implement proper error handling and logging
5. **Maintenance**: Keep tests updated with UI changes

## Contributing

When adding new tests:

1. Follow the existing test structure
2. Include comprehensive logging
3. Add proper error handling
4. Update this documentation
5. Ensure tests are reliable and repeatable

## Support

For issues with the Selenium testing framework:

1. Check the troubleshooting section
2. Review test logs and screenshots
3. Verify environment setup
4. Open an issue with detailed information 