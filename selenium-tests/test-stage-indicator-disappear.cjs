const { Builder, By, until } = require('selenium-webdriver');
const fs = require('fs');
const path = require('path');

async function testStageIndicatorDisappear() {
  let driver;
  
  try {
    console.log('🚀 Starting stage indicator disappear test...');
    
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
    await titleInput.sendKeys('Stage Indicator Disappear Test');
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
    await checkStageIndicatorDetailed(driver, 'initial');
    
    // Enter a prompt and send it
    console.log('💬 Entering and sending prompt...');
    const textarea = await driver.findElement(By.css('textarea'));
    await textarea.sendKeys('Test stage indicator disappear timing');
    console.log('✅ Entered prompt text');
    
    // Click Send button
    const sendButton = await driver.findElement(By.xpath("//button[contains(text(), 'Send')]"));
    await sendButton.click();
    console.log('✅ Clicked Send button');
    
    // Monitor stage progression with more frequent checks
    console.log('🔍 Monitoring stage progression with detailed tracking...');
    let stageChecks = 0;
    const maxStageChecks = 30; // More frequent checks
    const startTime = Date.now();
    const disappearEvents = [];
    
    while (stageChecks < maxStageChecks && (Date.now() - startTime) < 300000) { // 5 minutes max
      try {
        await driver.sleep(2000); // Check every 2 seconds
        stageChecks++;
        
        console.log(`📊 Stage check ${stageChecks}/${maxStageChecks}`);
        const state = await checkStageIndicatorDetailed(driver, `check-${stageChecks}`);
        
        // Track disappear events
        if (state.stageIndicatorCount === 0 && stageChecks > 1) {
          const disappearEvent = {
            checkNumber: stageChecks,
            timestamp: new Date().toISOString(),
            timeFromStart: Date.now() - startTime,
            previousState: state.previousState
          };
          disappearEvents.push(disappearEvent);
          console.log(`🚨 STAGE INDICATOR DISAPPEARED at check ${stageChecks}!`);
        }
        
        // Check if all stages are completed
        const finalizeIndicators = await driver.findElements(By.xpath("//*[contains(text(), 'finalize') or contains(text(), 'Finalize')]"));
        if (finalizeIndicators.length > 0) {
          console.log('🎉 Finalize stage detected, checking final state...');
          await checkStageIndicatorDetailed(driver, 'final');
          break;
        }
        
      } catch (e) {
        console.log(`⚠️ Error during stage check ${stageChecks}:`, e.message);
      }
    }
    
    console.log('⏰ Stage monitoring completed');
    
    // Capture final stage indicator state
    console.log('📸 Capturing final stage indicator state...');
    await checkStageIndicatorDetailed(driver, 'final-capture');
    
    // Save results
    const results = {
      timestamp: new Date().toISOString(),
      stageChecks,
      testDuration: Date.now() - startTime,
      disappearEvents,
      finalState: await getStageIndicatorStateDetailed(driver)
    };
    
    const outputPath = path.join(__dirname, 'logs', 'stage-indicator-disappear-results.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`💾 Results saved to: ${outputPath}`);
    
    // Display summary
    console.log('\n📋 Stage Indicator Disappear Test Summary:');
    console.log(`- Stage checks performed: ${stageChecks}`);
    console.log(`- Test duration: ${Math.round((Date.now() - startTime) / 1000)}s`);
    console.log(`- Disappear events: ${disappearEvents.length}`);
    
    if (disappearEvents.length > 0) {
      console.log('\n🚨 Disappear Events:');
      disappearEvents.forEach((event, i) => {
        console.log(`${i + 1}. Check ${event.checkNumber} at ${Math.round(event.timeFromStart / 1000)}s`);
      });
    } else {
      console.log('\n✅ No disappear events detected');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Save error information
    const errorResults = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    };
    
    const errorPath = path.join(__dirname, 'logs', 'stage-indicator-disappear-error.json');
    fs.writeFileSync(errorPath, JSON.stringify(errorResults, null, 2));
    console.log(`💾 Error details saved to: ${errorPath}`);
  } finally {
    if (driver) {
      await driver.quit();
      console.log('🔚 Browser closed');
    }
  }
}

async function checkStageIndicatorDetailed(driver, checkName) {
  try {
    const state = {
      stageIndicatorCount: 0,
      animatedCount: 0,
      completedCount: 0,
      progressText: '',
      stageLabels: [],
      currentStageElements: 0,
      pageTitle: '',
      url: '',
      timestamp: new Date().toISOString()
    };
    
    // Get page info
    state.pageTitle = await driver.getTitle();
    state.url = await driver.getCurrentUrl();
    
    // Look for stage indicator elements
    const stageIndicators = await driver.findElements(By.css('.w-4.h-4.rounded-full'));
    state.stageIndicatorCount = stageIndicators.length;
    console.log(`🔍 ${checkName}: Found ${state.stageIndicatorCount} stage indicator dots`);
    
    // Check stage progress text
    const progressTexts = await driver.findElements(By.xpath("//span[contains(text(), '/')]"));
    for (let i = 0; i < progressTexts.length; i++) {
      try {
        const text = await progressTexts[i].getText();
        if (text.match(/\d+\/\d+/)) {
          state.progressText = text;
          console.log(`📊 ${checkName}: Progress indicator: ${text}`);
        }
      } catch (e) {
        // Ignore errors for individual elements
      }
    }
    
    // Check for current stage indicators (animated)
    const animatedElements = await driver.findElements(By.css('.animate-pulse'));
    state.animatedCount = animatedElements.length;
    console.log(`⚡ ${checkName}: Found ${state.animatedCount} animated (current) stage indicators`);
    
    // Check for completed stages (checkmark)
    const completedStages = await driver.findElements(By.xpath("//div[contains(text(), '✓')]"));
    state.completedCount = completedStages.length;
    console.log(`✅ ${checkName}: Found ${state.completedCount} completed stage indicators`);
    
    // Check for stage labels in header
    const stageLabels = await driver.findElements(By.xpath("//*[contains(text(), 'stages completed')]"));
    for (let i = 0; i < stageLabels.length; i++) {
      try {
        const text = await stageLabels[i].getText();
        state.stageLabels.push(text);
        console.log(`📋 ${checkName}: Stage label: ${text}`);
      } catch (e) {
        // Ignore errors for individual elements
      }
    }
    
    // Check for current stage text
    const currentStageElements = await driver.findElements(By.css('.bg-blue-900, .bg-green-900, .bg-yellow-900, .bg-purple-900, .bg-indigo-900'));
    state.currentStageElements = currentStageElements.length;
    console.log(`🎯 ${checkName}: Found ${state.currentStageElements} current stage elements`);
    
    // Check if stage indicator container exists
    const stageIndicatorContainer = await driver.findElements(By.css('.flex.items-center.space-x-1'));
    console.log(`📦 ${checkName}: Stage indicator containers: ${stageIndicatorContainer.length}`);
    
    // Check for any elements with stage-related classes
    const allStageElements = await driver.findElements(By.css('[class*="stage"], [class*="indicator"]'));
    console.log(`🔍 ${checkName}: All stage-related elements: ${allStageElements.length}`);
    
    return state;
  } catch (e) {
    console.log(`⚠️ Error checking stage indicator (${checkName}):`, e.message);
    return { error: e.message, timestamp: new Date().toISOString() };
  }
}

async function getStageIndicatorStateDetailed(driver) {
  try {
    const state = {
      totalDots: 0,
      completedDots: 0,
      currentDots: 0,
      progressText: '',
      stageLabels: [],
      pageInfo: {
        title: '',
        url: ''
      }
    };
    
    // Get page info
    state.pageInfo.title = await driver.getTitle();
    state.pageInfo.url = await driver.getCurrentUrl();
    
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
testStageIndicatorDisappear().catch(console.error); 