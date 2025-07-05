const { Builder, By, until } = require('selenium-webdriver');
const fs = require('fs');
const path = require('path');

async function testStageIndicator() {
  let driver;
  
  try {
    console.log('🚀 Starting stage indicator test...');
    
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
    await titleInput.sendKeys('Stage Indicator Test Session');
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
    
    // Check initial stage indicator state
    console.log('🔍 Checking initial stage indicator state...');
    await checkStageIndicator(driver, 'initial');
    
    // Enter a prompt and send it
    console.log('💬 Entering and sending prompt...');
    const textarea = await driver.findElement(By.css('textarea'));
    await textarea.sendKeys('Test stage progression and indicator display');
    console.log('✅ Entered prompt text');
    
    // Click Send button
    const sendButton = await driver.findElement(By.xpath("//button[contains(text(), 'Send')]"));
    await sendButton.click();
    console.log('✅ Clicked Send button');
    
    // Monitor stage progression
    console.log('🔍 Monitoring stage progression...');
    let stageChecks = 0;
    const maxStageChecks = 20; // Check up to 20 times
    const startTime = Date.now();
    
    while (stageChecks < maxStageChecks && (Date.now() - startTime) < 300000) { // 5 minutes max
      try {
        await driver.sleep(5000); // Wait 5 seconds between checks
        stageChecks++;
        
        console.log(`📊 Stage check ${stageChecks}/${maxStageChecks}`);
        await checkStageIndicator(driver, `check-${stageChecks}`);
        
        // Check if all stages are completed
        const finalizeIndicators = await driver.findElements(By.xpath("//*[contains(text(), 'finalize') or contains(text(), 'Finalize')]"));
        if (finalizeIndicators.length > 0) {
          console.log('🎉 Finalize stage detected, checking final state...');
          await checkStageIndicator(driver, 'final');
          break;
        }
        
      } catch (e) {
        console.log(`⚠️ Error during stage check ${stageChecks}:`, e.message);
      }
    }
    
    console.log('⏰ Stage monitoring completed');
    
    // Capture final stage indicator state
    console.log('📸 Capturing final stage indicator state...');
    await checkStageIndicator(driver, 'final-capture');
    
    // Save results
    const results = {
      timestamp: new Date().toISOString(),
      stageChecks,
      testDuration: Date.now() - startTime,
      finalState: await getStageIndicatorState(driver)
    };
    
    const outputPath = path.join(__dirname, 'logs', 'stage-indicator-results.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`💾 Results saved to: ${outputPath}`);
    
    // Display summary
    console.log('\n📋 Stage Indicator Test Summary:');
    console.log(`- Stage checks performed: ${stageChecks}`);
    console.log(`- Test duration: ${Math.round((Date.now() - startTime) / 1000)}s`);
    console.log(`- Final stage state: ${JSON.stringify(results.finalState, null, 2)}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Save error information
    const errorResults = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    };
    
    const errorPath = path.join(__dirname, 'logs', 'stage-indicator-error.json');
    fs.writeFileSync(errorPath, JSON.stringify(errorResults, null, 2));
    console.log(`💾 Error details saved to: ${errorPath}`);
  } finally {
    if (driver) {
      await driver.quit();
      console.log('🔚 Browser closed');
    }
  }
}

async function checkStageIndicator(driver, checkName) {
  try {
    // Look for stage indicator elements
    const stageIndicators = await driver.findElements(By.css('.w-4.h-4.rounded-full'));
    console.log(`🔍 ${checkName}: Found ${stageIndicators.length} stage indicator dots`);
    
    // Check stage progress text
    const progressTexts = await driver.findElements(By.xpath("//span[contains(text(), '/')]"));
    for (let i = 0; i < progressTexts.length; i++) {
      try {
        const text = await progressTexts[i].getText();
        if (text.match(/\d+\/\d+/)) {
          console.log(`📊 ${checkName}: Progress indicator: ${text}`);
        }
      } catch (e) {
        // Ignore errors for individual elements
      }
    }
    
    // Check for current stage indicators (animated)
    const animatedElements = await driver.findElements(By.css('.animate-pulse'));
    console.log(`⚡ ${checkName}: Found ${animatedElements.length} animated (current) stage indicators`);
    
    // Check for completed stages (checkmark)
    const completedStages = await driver.findElements(By.xpath("//div[contains(text(), '✓')]"));
    console.log(`✅ ${checkName}: Found ${completedStages.length} completed stage indicators`);
    
    // Check for stage labels in header
    const stageLabels = await driver.findElements(By.xpath("//*[contains(text(), 'stages completed')]"));
    for (let i = 0; i < stageLabels.length; i++) {
      try {
        const text = await stageLabels[i].getText();
        console.log(`📋 ${checkName}: Stage label: ${text}`);
      } catch (e) {
        // Ignore errors for individual elements
      }
    }
    
    // Check for current stage text
    const currentStageElements = await driver.findElements(By.css('.bg-blue-900, .bg-green-900, .bg-yellow-900, .bg-purple-900, .bg-indigo-900'));
    console.log(`🎯 ${checkName}: Found ${currentStageElements.length} current stage elements`);
    
  } catch (e) {
    console.log(`⚠️ Error checking stage indicator (${checkName}):`, e.message);
  }
}

async function getStageIndicatorState(driver) {
  try {
    const state = {
      totalDots: 0,
      completedDots: 0,
      currentDots: 0,
      progressText: '',
      stageLabels: []
    };
    
    // Count total stage indicator dots
    const allDots = await driver.findElements(By.css('.w-4.h-4.rounded-full'));
    state.totalDots = allDots.length;
    
    // Count completed dots (with checkmark)
    const completedDots = await driver.findElements(By.xpath("//div[contains(text(), '✓')]"));
    state.completedDots = completedDots.length;
    
    // Count current dots (animated)
    const currentDots = await driver.findElements(By.css('.animate-pulse'));
    state.currentDots = currentDots.length;
    
    // Get progress text
    const progressElements = await driver.findElements(By.xpath("//span[contains(text(), '/')]"));
    for (let i = 0; i < progressElements.length; i++) {
      try {
        const text = await progressElements[i].getText();
        if (text.match(/\d+\/\d+/)) {
          state.progressText = text;
          break;
        }
      } catch (e) {
        // Ignore errors
      }
    }
    
    // Get stage labels
    const labelElements = await driver.findElements(By.xpath("//*[contains(text(), 'stages completed')]"));
    for (let i = 0; i < labelElements.length; i++) {
      try {
        const text = await labelElements[i].getText();
        state.stageLabels.push(text);
      } catch (e) {
        // Ignore errors
      }
    }
    
    return state;
  } catch (e) {
    console.log('⚠️ Error getting stage indicator state:', e.message);
    return { error: e.message };
  }
}

// Run the test
testStageIndicator().catch(console.error); 