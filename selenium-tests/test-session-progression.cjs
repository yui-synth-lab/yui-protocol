const { Builder, By, until } = require('selenium-webdriver');
const fs = require('fs');
const path = require('path');

async function testSessionProgression() {
  let driver;
  
  try {
    console.log('🚀 Starting session progression test...');
    
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
    
    // Create a new session
    console.log('📝 Creating new session...');
    
    // Click "New" button to show create form
    const newButton = await driver.wait(until.elementLocated(By.xpath("//button[contains(text(), 'New')]")), 10000);
    await newButton.click();
    console.log('✅ Clicked "New" button');
    
    // Wait for form to appear and fill in session title
    await driver.wait(until.elementLocated(By.css('input[type="text"]')), 5000);
    const titleInput = await driver.findElement(By.css('input[type="text"]'));
    await titleInput.sendKeys('Selenium Test Session');
    console.log('✅ Entered session title');
    
    // Click "Create Session" button
    const createButton = await driver.wait(until.elementLocated(By.xpath("//button[contains(text(), 'Create Session')]")), 5000);
    await createButton.click();
    console.log('✅ Clicked "Create Session" button');
    
    // Wait for session to be created and navigate to thread view
    await driver.wait(until.elementLocated(By.css('textarea, [data-testid="message-input"], .message-input')), 30000);
    console.log('✅ Session created and thread view loaded');
    
    // Wait a bit for any initial messages to load
    await driver.sleep(3000);
    
    // Enter a prompt and send it
    console.log('💬 Entering and sending prompt...');
    const textarea = await driver.findElement(By.css('textarea, [data-testid="message-input"], .message-input'));
    await textarea.sendKeys('What are the benefits and challenges of artificial intelligence in modern society?');
    console.log('✅ Entered prompt text');
    
    // Click Send button
    const sendButton = await driver.findElement(By.xpath("//button[contains(text(), 'Send')]"));
    await sendButton.click();
    console.log('✅ Clicked Send button');
    
    // Wait for processing to start
    await driver.sleep(3000);
    
    // Monitor for system messages and continue buttons
    let systemMessagesFound = 0;
    let continueButtonsClicked = 0;
    const maxWaitTime = 300000; // 5 minutes
    const startTime = Date.now();
    
    console.log('🔍 Monitoring for system messages and continue buttons...');
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        // Check for system messages (purple style)
        const systemMessages = await driver.findElements(By.css('.bg-purple-900, .text-purple-200'));
        if (systemMessages.length > systemMessagesFound) {
          console.log(`✅ Found ${systemMessages.length} system messages`);
          systemMessagesFound = systemMessages.length;
        }
        
        // Check for "Continue Process" button
        const continueButtons = await driver.findElements(By.xpath("//button[contains(text(), 'Continue Process')]"));
        if (continueButtons.length > 0 && continueButtonsClicked < continueButtons.length) {
          console.log(`🔄 Found Continue Process button, clicking...`);
          for (let i = continueButtonsClicked; i < continueButtons.length; i++) {
            try {
              await continueButtons[i].click();
              console.log(`✅ Clicked Continue Process button ${i + 1}`);
              continueButtonsClicked++;
              await driver.sleep(2000); // Wait for processing
            } catch (e) {
              console.log(`⚠️ Failed to click continue button ${i + 1}:`, e.message);
            }
          }
        }
        
        // Check if all stages are completed (look for completion indicators)
        const messages = await driver.findElements(By.css('[data-testid="message"], .message, .bg-gray-800'));
        console.log(`📊 Current message count: ${messages.length}`);
        
        // Check for finalize stage completion
        const finalizeIndicators = await driver.findElements(By.xpath("//*[contains(text(), 'finalize') or contains(text(), 'Finalize')]"));
        if (finalizeIndicators.length > 0) {
          console.log('🎉 Finalize stage detected, process may be complete');
        }
        
        await driver.sleep(5000); // Check every 5 seconds
        
      } catch (e) {
        console.log('⚠️ Error during monitoring:', e.message);
        await driver.sleep(5000);
      }
    }
    
    console.log('⏰ Monitoring time limit reached');
    
    // Capture final state
    console.log('📸 Capturing final application state...');
    
    // Get all messages
    const allMessages = await driver.findElements(By.css('[data-testid="message"], .message, .bg-gray-800, .bg-gray-700, .bg-blue-900, .bg-purple-900'));
    console.log(`📊 Total messages found: ${allMessages.length}`);
    
    // Extract message content
    const messageData = [];
    for (let i = 0; i < allMessages.length; i++) {
      try {
        const message = allMessages[i];
        const text = await message.getText();
        const className = await message.getAttribute('class');
        
        messageData.push({
          index: i,
          text: text.substring(0, 500), // Limit text length
          className: className,
          isSystemMessage: className.includes('purple') || text.includes('system') || text.includes('System')
        });
        
        if (className.includes('purple') || text.includes('system') || text.includes('System')) {
          console.log(`🔍 System message ${i}:`, text.substring(0, 200));
        }
      } catch (e) {
        console.log(`⚠️ Error extracting message ${i}:`, e.message);
      }
    }
    
    // Save results
    const results = {
      timestamp: new Date().toISOString(),
      systemMessagesFound,
      continueButtonsClicked,
      totalMessages: allMessages.length,
      messages: messageData,
      testDuration: Date.now() - startTime
    };
    
    const outputPath = path.join(__dirname, 'logs', 'session-progression-results.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`💾 Results saved to: ${outputPath}`);
    
    // Display summary
    console.log('\n📋 Test Summary:');
    console.log(`- System messages found: ${systemMessagesFound}`);
    console.log(`- Continue buttons clicked: ${continueButtonsClicked}`);
    console.log(`- Total messages: ${allMessages.length}`);
    console.log(`- Test duration: ${Math.round((Date.now() - startTime) / 1000)}s`);
    
    // Display system messages
    const systemMessages = messageData.filter(m => m.isSystemMessage);
    if (systemMessages.length > 0) {
      console.log('\n🔍 System Messages Found:');
      systemMessages.forEach((msg, i) => {
        console.log(`${i + 1}. ${msg.text.substring(0, 100)}...`);
      });
    } else {
      console.log('\n❌ No system messages detected');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Save error information
    const errorResults = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    };
    
    const errorPath = path.join(__dirname, 'logs', 'session-progression-error.json');
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
testSessionProgression().catch(console.error); 