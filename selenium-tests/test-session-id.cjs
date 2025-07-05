const { Builder, By, until } = require('selenium-webdriver');
const fs = require('fs');
const path = require('path');

async function testSessionIdIncrement() {
  let driver;
  
  try {
    console.log('🚀 Starting session ID increment test...');
    
    // Setup Chrome driver
    driver = await new Builder()
      .forBrowser('chrome')
      .build();
    
    // Navigate to the application
    await driver.get('http://localhost:3000');
    console.log('✅ Navigated to application');
    
    // Wait for page to load
    await driver.wait(until.elementLocated(By.css('h1')), 10000);
    console.log('✅ Page loaded successfully');
    
    const sessionIds = [];
    
    // Create multiple sessions to test ID increment
    for (let i = 1; i <= 3; i++) {
      console.log(`📝 Creating session ${i}...`);
      
      // Click "New" button to show create form
      const newButton = await driver.wait(until.elementLocated(By.xpath("//button[contains(text(), 'New')]")), 10000);
      await newButton.click();
      console.log(`✅ Clicked "New" button for session ${i}`);
      
      // Wait for form to appear and fill in session title
      await driver.wait(until.elementLocated(By.css('input[type="text"]')), 5000);
      const titleInput = await driver.findElement(By.css('input[type="text"]'));
      await titleInput.clear();
      await titleInput.sendKeys(`Session ID Test ${i}`);
      console.log(`✅ Entered session title for session ${i}`);
      
      // Click "Create Session" button
      const createButton = await driver.wait(until.elementLocated(By.xpath("//button[contains(text(), 'Create Session')]")), 5000);
      await createButton.click();
      console.log(`✅ Clicked "Create Session" button for session ${i}`);
      
      // Wait for session to be created and navigate to thread view
      await driver.wait(until.elementLocated(By.css('textarea')), 15000);
      console.log(`✅ Session ${i} created and thread view loaded`);
      
      // Get current URL to extract session ID
      const currentUrl = await driver.getCurrentUrl();
      const urlMatch = currentUrl.match(/\/session\/([^\/]+)/);
      if (urlMatch) {
        const sessionId = urlMatch[1];
        sessionIds.push(sessionId);
        console.log(`📊 Session ${i} ID: ${sessionId}`);
      }
      
      // Go back to sessions list
      await driver.get('http://localhost:3000');
      await driver.wait(until.elementLocated(By.css('h1')), 10000);
      console.log(`✅ Returned to sessions list after session ${i}`);
      
      // Wait a bit before creating next session
      await driver.sleep(2000);
    }
    
    // Analyze session IDs
    console.log('\n📋 Session ID Analysis:');
    console.log('Session IDs:', sessionIds);
    
    const numericIds = sessionIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    console.log('Numeric IDs:', numericIds);
    
    if (numericIds.length > 1) {
      const isSequential = numericIds.every((id, index) => {
        if (index === 0) return true;
        return id === numericIds[index - 1] + 1;
      });
      
      console.log(`✅ Sequential check: ${isSequential ? 'PASS' : 'FAIL'}`);
      
      if (isSequential) {
        console.log('🎉 Session IDs are properly incrementing!');
      } else {
        console.log('❌ Session IDs are not incrementing properly');
      }
    }
    
    // Save results
    const results = {
      timestamp: new Date().toISOString(),
      sessionIds: sessionIds,
      numericIds: numericIds,
      isSequential: numericIds.length > 1 ? numericIds.every((id, index) => {
        if (index === 0) return true;
        return id === numericIds[index - 1] + 1;
      }) : false
    };
    
    const outputPath = path.join(__dirname, 'logs', 'session-id-test-results.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`💾 Results saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Save error information
    const errorResults = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    };
    
    const errorPath = path.join(__dirname, 'logs', 'session-id-test-error.json');
    fs.writeFileSync(errorPath, JSON.stringify(errorResults, null, 2));
    console.log(`💾 Error details saved to: ${errorPath}`);
  } finally {
    if (driver) {
      await driver.quit();
      console.log('🔚 Browser closed');
    }
  }
}

// Run the test
testSessionIdIncrement().catch(console.error); 