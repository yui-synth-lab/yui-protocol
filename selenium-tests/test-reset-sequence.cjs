const { Builder, By, until } = require('selenium-webdriver');
const fs = require('fs');
const path = require('path');

async function testResetSequence() {
  let driver;
  
  try {
    console.log('🚀 Starting reset sequence test...');
    
    // Setup Chrome driver
    driver = await new Builder()
      .forBrowser('chrome')
      .build();
    
    // Navigate to the application
    await driver.get('http://localhost:3001');
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
    await titleInput.sendKeys('Reset Sequence Test Session');
    console.log('✅ Entered session title');
    
    // Click "Create Session" button
    const createButton = await driver.wait(until.elementLocated(By.xpath("//button[contains(text(), 'Create Session')]")), 5000);
    await createButton.click();
    console.log('✅ Clicked "Create Session" button');
    
    // Wait for session to be created and navigate to thread view
    await driver.wait(until.elementLocated(By.css('textarea')), 15000);
    console.log('✅ Session created and thread view loaded');
    
    // Wait a bit for any initial messages to load
    await driver.sleep(2000);
    
    // Enter first prompt and send it
    console.log('💬 Entering first prompt...');
    const textarea = await driver.findElement(By.css('textarea'));
    await textarea.sendKeys('First sequence: What is artificial intelligence?');
    console.log('✅ Entered first prompt text');
    
    // Click Send button
    const sendButton = await driver.findElement(By.xpath("//button[contains(text(), 'Send')]"));
    await sendButton.click();
    console.log('✅ Clicked Send button for first sequence');
    
    // Wait for first sequence to complete
    console.log('⏳ Waiting for first sequence to complete...');
    let firstSequenceCompleted = false;
    const maxWaitTime = 300000; // 5 minutes
    const startTime = Date.now();
    
    while (!firstSequenceCompleted && (Date.now() - startTime) < maxWaitTime) {
      try {
        await driver.sleep(5000);
        
        // Check for finalize stage completion
        const finalizeIndicators = await driver.findElements(By.xpath("//*[contains(text(), 'finalize') or contains(text(), 'Finalize')]"));
        if (finalizeIndicators.length > 0) {
          console.log('🎉 First sequence completed');
          firstSequenceCompleted = true;
        }
        
        // Check for all stages completed
        const completedStages = await driver.findElements(By.xpath("//div[contains(text(), '✓')]"));
        if (completedStages.length >= 6) {
          console.log('✅ All stages completed in first sequence');
          firstSequenceCompleted = true;
        }
        
      } catch (e) {
        console.log('⚠️ Error checking first sequence completion:', e.message);
      }
    }
    
    if (!firstSequenceCompleted) {
      console.log('⚠️ First sequence did not complete within time limit');
    }
    
    // Wait a bit more to ensure all messages are loaded
    await driver.sleep(3000);
    
    // Clear textarea and enter second prompt
    console.log('🔄 Preparing for second sequence...');
    const textarea2 = await driver.findElement(By.css('textarea'));
    await textarea2.clear();
    await textarea2.sendKeys('Second sequence: How does machine learning work?');
    console.log('✅ Entered second prompt text');
    
    // Click Send button for second sequence
    const sendButton2 = await driver.findElement(By.xpath("//button[contains(text(), 'Send')]"));
    await sendButton2.click();
    console.log('✅ Clicked Send button for second sequence');
    
    // Monitor second sequence and capture agent inputs
    console.log('🔍 Monitoring second sequence for agent inputs...');
    let secondSequenceCompleted = false;
    const agentInputs = [];
    const startTime2 = Date.now();
    
    while (!secondSequenceCompleted && (Date.now() - startTime2) < maxWaitTime) {
      try {
        await driver.sleep(3000);
        
        // Capture all messages to analyze agent inputs
        const allMessages = await driver.findElements(By.css('[data-testid="message"], .message, .bg-gray-800, .bg-gray-700, .bg-blue-900, .bg-purple-900'));
        
        for (let i = 0; i < allMessages.length; i++) {
          try {
            const message = allMessages[i];
            const text = await message.getText();
            const className = await message.getAttribute('class');
            
            // Look for agent messages (not user or system messages)
            if (text.includes('Mock response') && !text.includes('system') && !text.includes('System')) {
              // プロンプト内容を抽出（"your query is \"...\"" の部分）
              const promptMatch = text.match(/your query is \"([\s\S]*?)\"/);
              const promptPassed = promptMatch ? promptMatch[1] : null;
              const agentInput = {
                timestamp: new Date().toISOString(),
                text: text.substring(0, 1000), // Limit text length
                promptPassed,
                className: className,
                messageIndex: i
              };
              
              // Check if this is a new agent input
              const isNew = !agentInputs.some(existing => 
                existing.text.substring(0, 200) === agentInput.text.substring(0, 200)
              );
              
              if (isNew) {
                agentInputs.push(agentInput);
                console.log(`🤖 New agent input detected: ${text.substring(0, 100)}...`);
                if (promptPassed) {
                  console.log(`   👉 Prompt passed to agent: ${promptPassed.substring(0, 200)}...`);
                }
              }
            }
          } catch (e) {
            // Ignore errors for individual messages
          }
        }
        
        // Check for finalize stage completion
        const finalizeIndicators = await driver.findElements(By.xpath("//*[contains(text(), 'finalize') or contains(text(), 'Finalize')]"));
        if (finalizeIndicators.length > 0) {
          console.log('🎉 Second sequence completed');
          secondSequenceCompleted = true;
        }
        
        // Check for all stages completed again
        const completedStages = await driver.findElements(By.xpath("//div[contains(text(), '✓')]"));
        if (completedStages.length >= 6) {
          console.log('✅ All stages completed in second sequence');
          secondSequenceCompleted = true;
        }
        
      } catch (e) {
        console.log('⚠️ Error monitoring second sequence:', e.message);
      }
    }
    
    console.log('⏰ Sequence monitoring completed');
    
    // Capture final state
    console.log('📸 Capturing final application state...');
    const finalMessages = await driver.findElements(By.css('[data-testid="message"], .message, .bg-gray-800, .bg-gray-700, .bg-blue-900, .bg-purple-900'));
    console.log(`📊 Total messages found: ${finalMessages.length}`);
    
    // Extract final message content
    const finalMessageData = [];
    for (let i = 0; i < finalMessages.length; i++) {
      try {
        const message = finalMessages[i];
        const text = await message.getText();
        const className = await message.getAttribute('class');
        
        finalMessageData.push({
          index: i,
          text: text.substring(0, 500),
          className: className,
          isAgentInput: text.includes('Mock response') && !text.includes('system'),
          isUserMessage: text.includes('First sequence') || text.includes('Second sequence'),
          isSystemMessage: text.includes('system') || text.includes('System')
        });
      } catch (e) {
        console.log(`⚠️ Error extracting message ${i}:`, e.message);
      }
    }
    
    // Save results
    const results = {
      timestamp: new Date().toISOString(),
      firstSequenceCompleted,
      secondSequenceCompleted,
      totalMessages: finalMessages.length,
      agentInputs: agentInputs,
      finalMessages: finalMessageData,
      testDuration: Date.now() - startTime
    };
    
    const outputPath = path.join(__dirname, 'logs', 'reset-sequence-results.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`💾 Results saved to: ${outputPath}`);
    
    // Display summary
    console.log('\n📋 Reset Sequence Test Summary:');
    console.log(`- First sequence completed: ${firstSequenceCompleted}`);
    console.log(`- Second sequence completed: ${secondSequenceCompleted}`);
    console.log(`- Total messages: ${finalMessages.length}`);
    console.log(`- Agent inputs captured: ${agentInputs.length}`);
    console.log(`- Test duration: ${Math.round((Date.now() - startTime) / 1000)}s`);
    
    // Display agent inputs
    if (agentInputs.length > 0) {
      console.log('\n🤖 Agent Inputs Analysis:');
      agentInputs.forEach((input, i) => {
        console.log(`${i + 1}. ${input.text.substring(0, 150)}...`);
      });
    }
    
    // Display user messages to verify prompts
    const userMessages = finalMessageData.filter(m => m.isUserMessage);
    if (userMessages.length > 0) {
      console.log('\n👤 User Messages:');
      userMessages.forEach((msg, i) => {
        console.log(`${i + 1}. ${msg.text.substring(0, 100)}...`);
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Save error information
    const errorResults = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    };
    
    const errorPath = path.join(__dirname, 'logs', 'reset-sequence-error.json');
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
testResetSequence().catch(console.error);