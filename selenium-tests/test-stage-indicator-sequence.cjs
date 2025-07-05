const { Builder, By, until } = require('selenium-webdriver');
const fs = require('fs');
const path = require('path');

async function testStageIndicatorSequence() {
  let driver;
  
  try {
    console.log('🚀 Starting stage indicator sequence test...');
    
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
    await titleInput.sendKeys('Stage Indicator Sequence Test');
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
    
    // Check stage indicator after first sequence
    console.log('🔍 Checking stage indicator after first sequence...');
    const stageIndicatorAfterFirst = await driver.findElement(By.css('.flex.items-center.space-x-1'));
    const stageIndicatorTextAfterFirst = await stageIndicatorAfterFirst.getText();
    console.log(`📊 Stage indicator after first sequence: ${stageIndicatorTextAfterFirst}`);
    
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
    
    // Wait a bit for the new sequence to start
    await driver.sleep(5000);
    
    // Check stage indicator after starting second sequence
    console.log('🔍 Checking stage indicator after starting second sequence...');
    const stageIndicatorAfterSecond = await driver.findElement(By.css('.flex.items-center.space-x-1'));
    const stageIndicatorTextAfterSecond = await stageIndicatorAfterSecond.getText();
    console.log(`📊 Stage indicator after starting second sequence: ${stageIndicatorTextAfterSecond}`);
    
    // Monitor second sequence progress
    console.log('⏳ Monitoring second sequence progress...');
    let secondSequenceCompleted = false;
    const startTime2 = Date.now();
    
    while (!secondSequenceCompleted && (Date.now() - startTime2) < maxWaitTime) {
      try {
        await driver.sleep(3000);
        
        // Check current stage indicator
        const currentStageIndicator = await driver.findElement(By.css('.flex.items-center.space-x-1'));
        const currentStageText = await currentStageIndicator.getText();
        console.log(`📊 Current stage indicator: ${currentStageText}`);
        
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
    
    // Final stage indicator check
    console.log('🔍 Final stage indicator check...');
    const finalStageIndicator = await driver.findElement(By.css('.flex.items-center.space-x-1'));
    const finalStageText = await finalStageIndicator.getText();
    console.log(`📊 Final stage indicator: ${finalStageText}`);
    
    // Save results
    const results = {
      timestamp: new Date().toISOString(),
      firstSequenceCompleted,
      secondSequenceCompleted,
      stageIndicatorAfterFirst: stageIndicatorTextAfterFirst,
      stageIndicatorAfterSecond: stageIndicatorTextAfterSecond,
      finalStageIndicator: finalStageText,
      testDuration: Date.now() - startTime
    };
    
    const outputPath = path.join(__dirname, 'logs', 'stage-indicator-sequence-results.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`💾 Results saved to: ${outputPath}`);
    
    // Display summary
    console.log('\n📋 Stage Indicator Sequence Test Summary:');
    console.log(`- First sequence completed: ${firstSequenceCompleted}`);
    console.log(`- Second sequence completed: ${secondSequenceCompleted}`);
    console.log(`- Stage indicator after first: ${stageIndicatorTextAfterFirst}`);
    console.log(`- Stage indicator after second start: ${stageIndicatorTextAfterSecond}`);
    console.log(`- Final stage indicator: ${finalStageText}`);
    console.log(`- Test duration: ${Math.round((Date.now() - startTime) / 1000)}s`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Save error information
    const errorResults = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    };
    
    const errorPath = path.join(__dirname, 'logs', 'stage-indicator-sequence-error.json');
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
testStageIndicatorSequence().catch(console.error); 