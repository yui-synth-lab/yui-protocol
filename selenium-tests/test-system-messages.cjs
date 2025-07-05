const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const path = require('path');

class SystemMessageTester {
  constructor() {
    this.driver = null;
    this.consoleLogs = [];
    this.systemMessages = [];
  }

  async setup() {
    const options = new chrome.Options();
    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');
    // options.addArguments('--headless');

    this.driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();

    await this.driver.executeScript(`
      window.consoleLogs = [];
      window.systemMessages = [];
      const originalLog = console.log;
      console.log = function(...args) {
        const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
        window.consoleLogs.push({
          level: 'log',
          message: message,
          timestamp: new Date().toISOString()
        });
        if (message.includes('[UI] Progress message') && message.includes('system')) {
          window.systemMessages.push({
            message: message,
            timestamp: new Date().toISOString()
          });
        }
        originalLog.apply(console, args);
      };
    `);
  }

  async navigateToApp() {
    await this.driver.get('http://localhost:3001');
    console.log('アプリケーションに移動しました');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  async findAndClickButton(text) {
    try {
      const buttons = await this.driver.findElements(By.xpath(`//button[contains(text(), '${text}')]`));
      if (buttons.length > 0) {
        await buttons[0].click();
        console.log(`ボタンをクリックしました: ${text}`);
        return true;
      }
      const testIdButtons = await this.driver.findElements(By.css(`[data-testid*="${text.toLowerCase().replace(' ', '-')}"]`));
      if (testIdButtons.length > 0) {
        await testIdButtons[0].click();
        console.log(`data-testidでボタンをクリックしました: ${text}`);
        return true;
      }
      console.log(`ボタンが見つかりません: ${text}`);
      return false;
    } catch (error) {
      console.error(`ボタンクリックエラー: ${text}`, error);
      return false;
    }
  }

  async startSession() {
    // 1. サイドバーの「New」ボタンをクリック
    const newButton = await this.driver.findElements(By.xpath("//button[normalize-space(text())='New']"));
    if (newButton.length > 0) {
      await newButton[0].click();
      console.log('「New」ボタンをクリックしました');
      await new Promise(resolve => setTimeout(resolve, 500));
    } else {
      console.log('「New」ボタンが見つかりません');
      return false;
    }
    
    // 2. セッション名を入力
    const titleInput = await this.driver.findElements(By.css('input[placeholder*="title"], input[placeholder*="Title"], input[name="title"]'));
    if (titleInput.length > 0) {
      await titleInput[0].clear();
      await titleInput[0].sendKeys('System Message Test Session');
      console.log('セッション名を入力しました: System Message Test Session');
      await new Promise(resolve => setTimeout(resolve, 500));
    } else {
      console.log('セッション名入力フィールドが見つかりません');
      return false;
    }
    
    // 3. フォームの「Create Session」ボタンをクリック
    const createButton = await this.driver.findElements(By.xpath("//button[normalize-space(text())='Create Session']"));
    if (createButton.length > 0) {
      await createButton[0].click();
      console.log('「Create Session」ボタンをクリックしました');
      return true;
    } else {
      console.log('「Create Session」ボタンが見つかりません');
      return false;
    }
  }

  async getConsoleLogs() {
    try {
      const logs = await this.driver.executeScript('return window.consoleLogs;');
      return logs || [];
    } catch (error) {
      console.error('コンソールログの取得エラー:', error);
      return [];
    }
  }

  async getSystemMessages() {
    try {
      const messages = await this.driver.executeScript('return window.systemMessages;');
      return messages || [];
    } catch (error) {
      console.error('Systemメッセージの取得エラー:', error);
      return [];
    }
  }

  async waitForSystemMessage(timeout = 30000) {
    console.log('Systemメッセージの出現を待機中...');
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const messages = await this.getSystemMessages();
      if (messages.length > 0) {
        console.log(`Systemメッセージが検出されました: ${messages.length}件`);
        return messages;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log('Systemメッセージの待機がタイムアウトしました');
    return [];
  }

  async monitorSystemMessages(duration = 60000) {
    console.log(`${duration}ms間Systemメッセージを監視します...`);
    const startTime = Date.now();
    const allSystemMessages = [];
    const allLogs = [];
    while (Date.now() - startTime < duration) {
      const logs = await this.getConsoleLogs();
      const systemMessages = await this.getSystemMessages();
      if (logs.length > 0) {
        allLogs.push(...logs);
      }
      if (systemMessages.length > 0) {
        allSystemMessages.push(...systemMessages);
        console.log(`[${new Date().toISOString()}] Systemメッセージ検出: ${systemMessages.length}件`);
        systemMessages.forEach(msg => {
          console.log(`  - ${msg.message}`);
        });
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return { allLogs, allSystemMessages };
  }

  async checkMessagePersistence() {
    console.log('メッセージの永続性をチェック中...');
    const initialMessages = await this.getSystemMessages();
    console.log(`初期Systemメッセージ数: ${initialMessages.length}`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    const finalMessages = await this.getSystemMessages();
    console.log(`最終Systemメッセージ数: ${finalMessages.length}`);
    if (finalMessages.length < initialMessages.length) {
      console.log('⚠️  Systemメッセージが消失しました！');
      return false;
    } else {
      console.log('✅ Systemメッセージは保持されています');
      return true;
    }
  }

  async saveResults(logs, systemMessages, filename = 'system-message-test-results.json') {
    const results = {
      timestamp: new Date().toISOString(),
      totalLogs: logs.length,
      systemMessages: systemMessages.length,
      logs: logs,
      systemMessages: systemMessages
    };
    const outputPath = path.join(__dirname, 'logs', filename);
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`結果を ${outputPath} に保存しました`);
  }

  async cleanup() {
    if (this.driver) {
      await this.driver.quit();
      console.log('ブラウザを終了しました');
    }
  }
}

async function main() {
  const tester = new SystemMessageTester();
  try {
    console.log('=== Systemメッセージテスト開始 ===');
    await tester.setup();
    await tester.navigateToApp();
    const sessionStarted = await tester.startSession();
    if (!sessionStarted) {
      console.log('セッション開始に失敗しました');
      return;
    }
    const { allLogs, allSystemMessages } = await tester.monitorSystemMessages(120000); // 2分間
    const persistenceCheck = await tester.checkMessagePersistence();
    await tester.saveResults(allLogs, allSystemMessages);
    console.log('\n=== テスト結果 ===');
    console.log(`総ログ数: ${allLogs.length}`);
    console.log(`Systemメッセージ数: ${allSystemMessages.length}`);
    console.log(`永続性チェック: ${persistenceCheck ? '✅ 成功' : '❌ 失敗'}`);
    if (allSystemMessages.length > 0) {
      console.log('\n=== Systemメッセージ詳細 ===');
      allSystemMessages.forEach((msg, index) => {
        console.log(`${index + 1}. [${msg.timestamp}] ${msg.message}`);
      });
    }
  } catch (error) {
    console.error('テスト実行エラー:', error);
  } finally {
    await tester.cleanup();
  }
}

async function captureSystemMessages() {
  let driver;
  
  try {
    console.log('🚀 Starting Selenium test for system message capture...');
    
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
    await titleInput.sendKeys('Selenium Test Session');
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
    
    // Enter a prompt and send it
    console.log('💬 Entering and sending prompt...');
    const textarea = await driver.findElement(By.css('textarea'));
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
    
    const outputPath = path.join(__dirname, 'logs', 'system-messages-results.json');
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
    
    const errorPath = path.join(__dirname, 'logs', 'system-messages-error.json');
    fs.writeFileSync(errorPath, JSON.stringify(errorResults, null, 2));
    console.log(`💾 Error details saved to: ${errorPath}`);
  } finally {
    if (driver) {
      await driver.quit();
      console.log('🔚 Browser closed');
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = SystemMessageTester; 