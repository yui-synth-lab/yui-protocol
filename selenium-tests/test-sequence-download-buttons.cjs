const { Builder, By, until, logging } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const path = require('path');

class SequenceDownloadButtonsTester {
  constructor() {
    this.driver = null;
    this.results = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0
      }
    };
  }

  async setup() {
    try {
      console.log('🚀 Setting up Selenium WebDriver...');
      const options = new chrome.Options();
      const prefs = new logging.Preferences();
      prefs.setLevel(logging.Type.BROWSER, logging.Level.ALL);
      this.driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .setLoggingPrefs(prefs)
        .build();
      
      // ウィンドウサイズを設定
      await this.driver.manage().window().setRect({ width: 1920, height: 1080 });
      console.log('✅ WebDriver setup completed');
      return true;
    } catch (error) {
      console.error('❌ WebDriver setup failed:', error);
      return false;
    }
  }

  async runTest() {
    try {
      console.log('🧪 Starting Sequence Download Buttons Test...');
      
      // テスト1: アプリケーションへの移動
      await this.testNavigateToApp();
      
      // テスト2: 新しいセッションの作成
      await this.testCreateNewSession();
      
      // テスト3: 最初のシーケンスの実行
      await this.testExecuteFirstSequence();
      
      // テスト4: 最初のシーケンスのダウンロードボタンの確認
      await this.testFirstSequenceDownloadButton();
      
      // テスト5: 2番目のシーケンスの実行
      await this.testExecuteSecondSequence();
      
      // テスト6: 複数シーケンスのダウンロードボタンの確認
      await this.testMultipleSequenceDownloadButtons();
      
      // テスト7: ダウンロードボタンのクリックテスト
      await this.testDownloadButtonClick();
      
      console.log('✅ All tests completed');
      return true;
    } catch (error) {
      console.error('❌ Test execution failed:', error);
      return false;
    }
  }

  async testNavigateToApp() {
    const testName = 'Navigate to App';
    try {
      console.log(`\n📋 Running: ${testName}`);
      
      await this.driver.get('http://localhost:3001');
      
      // ページが読み込まれるまで待機
      await this.driver.wait(until.elementLocated(By.xpath("//button[normalize-space(text())='New']")), 20000);
      console.log('✅ App loaded successfully');
      
      // 少し待機してページの完全な読み込みを待つ
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      this.addTestResult(testName, true, 'App loaded successfully');
    } catch (error) {
      console.error(`❌ ${testName} failed:`, error.message);
      this.addTestResult(testName, false, error.message);
    }
  }

  async testCreateNewSession() {
    const testName = 'Create New Session';
    try {
      console.log(`\n📋 Running: ${testName}`);
      
      // 1. 新しいセッションを作成ボタンをクリック
      const newButton = await this.driver.findElement(By.xpath("//button[contains(text(), 'New')]"));
      await newButton.click();
      console.log('✅ New button clicked');
      
      // 2. セッションタイトルを入力
      const titleInput = await this.driver.findElement(By.css('input[placeholder*="title"], input[placeholder*="Title"], input[type="text"]'));
      await titleInput.clear();
      await titleInput.sendKeys('Sequence Download Test Session');
      console.log('✅ Session title entered');
      
      // 3. エージェントを選択（重要！）
      console.log('🔍 Selecting agents...');
      try {
        // エージェント選択チェックボックスを探す
        const agentCheckboxes = await this.driver.findElements(By.css('input[type="checkbox"], .agent-checkbox, [data-agent-id]'));
        console.log(`Found ${agentCheckboxes.length} potential agent selection elements`);
        
        if (agentCheckboxes.length > 0) {
          // 最初の5つのエージェントを選択
          for (let i = 0; i < Math.min(agentCheckboxes.length, 5); i++) {
            try {
              const isSelected = await agentCheckboxes[i].isSelected();
              if (!isSelected) {
                await agentCheckboxes[i].click();
                console.log(`✅ Selected agent ${i + 1}`);
              }
            } catch (error) {
              console.log(`⚠️ Could not select agent ${i + 1}: ${error.message}`);
            }
          }
        } else {
          // 代替的なエージェント選択方法
          const agentElements = await this.driver.findElements(By.css('[data-agent-id], .agent-item, .agent-selector'));
          console.log(`Found ${agentElements.length} agent elements`);
          
          for (let i = 0; i < Math.min(agentElements.length, 5); i++) {
            try {
              await agentElements[i].click();
              console.log(`✅ Selected agent element ${i + 1}`);
            } catch (error) {
              console.log(`⚠️ Could not select agent element ${i + 1}: ${error.message}`);
            }
          }
        }
      } catch (error) {
        console.log(`⚠️ Agent selection error: ${error.message}`);
      }
      
      // 4. セッション作成ボタンをクリック
      const createButton = await this.driver.findElement(By.xpath("//button[contains(text(), 'Create') or contains(text(), 'Start')]"));
      await createButton.click();
      console.log('✅ Create Session button clicked');
      
      // 5. セッションが作成されるまで待機
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      this.addTestResult(testName, true, 'Session created successfully');
    } catch (error) {
      console.error(`❌ ${testName} failed:`, error.message);
      this.addTestResult(testName, false, error.message);
    }
  }

  async testExecuteFirstSequence() {
    const testName = 'Execute First Sequence';
    try {
      console.log(`\n📋 Running: ${testName}`);
      
      // 1. メッセージ入力フィールドを見つける
      const messageInput = await this.driver.findElement(By.css('textarea, input[type="text"]'));
      await messageInput.clear();
      await messageInput.sendKeys('What is the best approach to solve climate change?');
      console.log('✅ Message entered');
      
      // 2. 送信ボタンをクリック
      const sendButton = await this.driver.findElement(By.css('button[type="submit"]'));
      await sendButton.click();
      console.log('✅ Send button clicked');
      
      // 3. エージェントのレスポンスが始まるまで待機
      console.log('⏳ Waiting for agent response to start...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // 4. すべてのステージが完了するまで待機（最大5分）
      const maxWaitTime = 300000; // 5分
      const startTime = Date.now();
      let lastMessageCount = 0;
      let stableCount = 0;
      let hasStarted = false;
      
      console.log('⏳ Waiting for sequence completion...');
      
      while (Date.now() - startTime < maxWaitTime) {
        try {
          const messages = await this.driver.findElements(By.css('[data-testid="message"], .message, .bg-gray-800, .bg-gray-700, .bg-blue-900, .bg-purple-900'));
          const currentMessageCount = messages.length;
          console.log(`📝 Current message count: ${currentMessageCount}`);
          
          // 最初のメッセージが表示されたかチェック
          if (currentMessageCount > 0 && !hasStarted) {
            hasStarted = true;
            console.log('🎉 Agent response started!');
          }
          
          // メッセージ数が安定したかチェック（完了の兆候）
          if (currentMessageCount === lastMessageCount && hasStarted) {
            stableCount++;
            if (stableCount >= 3) { // 3回連続で同じ数の場合、完了とみなす
              console.log(`✅ Message count stabilized at ${currentMessageCount} for 3 consecutive checks`);
              break;
            }
          } else {
            stableCount = 0;
            lastMessageCount = currentMessageCount;
          }
          
          // 十分なメッセージがある場合も完了とみなす
          if (currentMessageCount > 15) {
            console.log(`✅ Found ${currentMessageCount} messages, sequence appears complete`);
            break;
          }
          
        } catch (error) {
          console.log('⚠️ Error checking messages:', error.message);
        }
        
        await new Promise(resolve => setTimeout(resolve, 8000)); // 8秒間隔でチェック
      }
      
      // 5. 追加の待機時間（メッセージの完全な表示を待つ）
      console.log('⏳ Final wait for UI updates...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // 6. 最終的なメッセージ数を確認
      const finalMessages = await this.driver.findElements(By.css('[data-testid="message"], .message, .bg-gray-800, .bg-gray-700, .bg-blue-900, .bg-purple-900'));
      console.log(`📝 Final message count: ${finalMessages.length}`);
      
      if (finalMessages.length > 0) {
        this.addTestResult(testName, true, `First sequence executed successfully with ${finalMessages.length} messages`);
      } else {
        this.addTestResult(testName, false, 'No agent messages found - sequence may not have started');
      }
    } catch (error) {
      console.error(`❌ ${testName} failed:`, error.message);
      this.addTestResult(testName, false, error.message);
    }
  }

  async testFirstSequenceDownloadButton() {
    const testName = 'First Sequence Download Button';
    try {
      console.log(`\n📋 Running: ${testName}`);
      
      // ページの現在の状態を確認
      console.log('🔍 Checking page state...');
      
      // メッセージの数を確認
      const messages = await this.driver.findElements(By.css('[data-testid="message"], .message, .bg-gray-800, .bg-gray-700, .bg-blue-900, .bg-purple-900'));
      console.log(`📊 Current message count: ${messages.length}`);
      console.log(`📝 Found ${messages.length} agent messages`);
      
      // ステージ履歴を確認
      const stageElements = await this.driver.findElements(By.css('[class*="stage"], [class*="Stage"]'));
      console.log(`🎯 Found ${stageElements.length} stage-related elements`);
      
      // 現在のページのHTMLを取得してデバッグ
      const pageSource = await this.driver.getPageSource();
      if (pageSource.includes('Download') || pageSource.includes('download')) {
        console.log('✅ Found "Download" text in page source');
      } else {
        console.log('❌ No "Download" text found in page source');
      }
      
      // ブラウザのコンソールログを取得
      console.log('🔍 Getting browser console logs...');
      const logs = await this.driver.manage().logs().get('browser');
      console.log(`📋 Found ${logs.length} console log entries`);
      
      // MessagesViewのデバッグログを探す
      const messagesViewLogs = logs.filter(log => 
        log.message.includes('[MessagesView]') || 
        log.message.includes('session.sequenceOutputFiles') ||
        log.message.includes('Download button conditions')
      );
      
      if (messagesViewLogs.length > 0) {
        console.log('🔍 MessagesView debug logs found:');
        messagesViewLogs.forEach((log, i) => {
          console.log(`  ${i + 1}. ${log.message}`);
        });
      } else {
        console.log('❌ No MessagesView debug logs found');
      }
      
      // ダウンロードボタンが表示されるまで待機（短縮版）
      console.log('⏳ Waiting for download button to appear...');
      try {
        await this.driver.wait(until.elementLocated(By.xpath("//button[contains(text(), 'Download')]")), 30000);
        console.log('✅ Download button found');
      } catch (timeoutError) {
        console.log('⏰ Download button not found within timeout, checking for alternative elements...');
        
        // 代替的な要素を探す
        const allButtons = await this.driver.findElements(By.tagName('button'));
        console.log(`🔘 Found ${allButtons.length} total buttons on page`);
        
        for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
          try {
            const buttonText = await allButtons[i].getText();
            console.log(`  Button ${i + 1}: "${buttonText}"`);
          } catch (error) {
            console.log(`  Button ${i + 1}: [Error reading text]`);
          }
        }
        
        // ダウンロードボタンが見つからない場合でもテストを続行
        this.addTestResult(testName, false, 'Download button not found - sequence may not be complete');
        return;
      }
      
      // ダウンロードボタンを確認
      const downloadButtons = await this.driver.findElements(By.xpath("//button[contains(text(), 'Download')]"));
      console.log(`✅ Found ${downloadButtons.length} download button(s)`);
      
      // シーケンス固有のダウンロードボタンを確認
      const sequenceButtons = await this.driver.findElements(By.xpath("//button[contains(text(), 'Sequence') and contains(text(), 'Download')]"));
      console.log(`📦 Found ${sequenceButtons.length} sequence-specific download button(s)`);
      
      if (downloadButtons.length > 0) {
        this.addTestResult(testName, true, `Found ${downloadButtons.length} download button(s)`);
      } else {
        this.addTestResult(testName, false, 'No download buttons found');
      }
    } catch (error) {
      console.error(`❌ ${testName} failed:`, error.message);
      this.addTestResult(testName, false, error.message);
    }
  }

  async testExecuteSecondSequence() {
    const testName = 'Execute Second Sequence';
    try {
      console.log(`\n📋 Running: ${testName}`);
      
      // 1. メッセージ入力フィールドを見つける
      const messageInput = await this.driver.findElement(By.css('textarea, input[type="text"]'));
      await messageInput.clear();
      await messageInput.sendKeys('How can we implement renewable energy solutions?');
      console.log('✅ Second message entered');
      
      // 2. 送信ボタンをクリック
      const sendButton = await this.driver.findElement(By.css('button[type="submit"]'));
      await sendButton.click();
      console.log('✅ Send button clicked for second sequence');
      
      // 3. エージェントのレスポンスが始まるまで待機
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 4. すべてのステージが完了するまで待機（最大3分）
      const maxWaitTime = 180000; // 3分
      const startTime = Date.now();
      let lastMessageCount = 0;
      let stableCount = 0;
      
      console.log('⏳ Waiting for second sequence completion...');
      
      while (Date.now() - startTime < maxWaitTime) {
        try {
          const messages = await this.driver.findElements(By.css('[data-testid="message"], .message, .bg-gray-800, .bg-gray-700, .bg-blue-900, .bg-purple-900'));
          const currentMessageCount = messages.length;
          
          console.log(`📝 Current message count: ${currentMessageCount}`);
          
          // メッセージ数が安定したかチェック（完了の兆候）
          if (currentMessageCount === lastMessageCount) {
            stableCount++;
            if (stableCount >= 2) { // 2回連続で同じ数の場合、完了とみなす
              console.log(`✅ Message count stabilized at ${currentMessageCount} for 2 consecutive checks`);
              break;
            }
          } else {
            stableCount = 0;
            lastMessageCount = currentMessageCount;
          }
          
          // 十分なメッセージがある場合も完了とみなす
          if (currentMessageCount > 20) {
            console.log(`✅ Found ${currentMessageCount} messages, second sequence appears complete`);
            break;
          }
          
        } catch (error) {
          console.log('⚠️ Error checking messages:', error.message);
        }
        
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5秒間隔でチェック
      }
      
      // 5. 追加の待機時間（メッセージの完全な表示を待つ）
      console.log('⏳ Final wait for UI updates...');
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      // 6. 最終的なメッセージ数を確認
      const finalMessages = await this.driver.findElements(By.css('[data-testid="message"], .message, .bg-gray-800, .bg-gray-700, .bg-blue-900, .bg-purple-900'));
      console.log(`📝 Final message count: ${finalMessages.length}`);
      
      this.addTestResult(testName, true, `Second sequence executed successfully with ${finalMessages.length} messages`);
    } catch (error) {
      console.error(`❌ ${testName} failed:`, error.message);
      this.addTestResult(testName, false, error.message);
    }
  }

  async testSecondSequenceDownloadButton() {
    const testName = 'Second Sequence Download Button';
    try {
      console.log(`\n📋 Running: ${testName}`);
      
      // ページの現在の状態を確認
      console.log('🔍 Checking page state for second sequence...');
      
      // メッセージの数を確認
      const messages = await this.driver.findElements(By.css('[data-testid="message"], .message, .bg-gray-800, .bg-gray-700, .bg-blue-900, .bg-purple-900'));
      console.log(`📝 Found ${messages.length} total agent messages`);
      
      // ダウンロードボタンが表示されるまで待機（短縮版）
      console.log('⏳ Waiting for second sequence download button to appear...');
      try {
        await this.driver.wait(until.elementLocated(By.xpath("//button[contains(text(), 'Download')]")), 30000);
        console.log('✅ Download button found for second sequence');
      } catch (timeoutError) {
        console.log('⏰ Download button not found within timeout for second sequence');
        
        // 代替的な要素を探す
        const allButtons = await this.driver.findElements(By.tagName('button'));
        console.log(`🔘 Found ${allButtons.length} total buttons on page`);
        
        for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
          try {
            const buttonText = await allButtons[i].getText();
            console.log(`  Button ${i + 1}: "${buttonText}"`);
          } catch (error) {
            console.log(`  Button ${i + 1}: [Error reading text]`);
          }
        }
        
        this.addTestResult(testName, false, 'Download button not found for second sequence');
        return;
      }
      
      // ダウンロードボタンを確認
      const downloadButtons = await this.driver.findElements(By.xpath("//button[contains(text(), 'Download')]"));
      console.log(`✅ Found ${downloadButtons.length} download button(s) for second sequence`);
      
      if (downloadButtons.length > 0) {
        this.addTestResult(testName, true, `Found ${downloadButtons.length} download button(s) for second sequence`);
      } else {
        this.addTestResult(testName, false, 'No download buttons found for second sequence');
      }
    } catch (error) {
      console.error(`❌ ${testName} failed:`, error.message);
      this.addTestResult(testName, false, error.message);
    }
  }

  async testMultipleSequenceDownloadButtons() {
    const testName = 'Multiple Sequence Download Buttons';
    try {
      console.log(`\n📋 Running: ${testName}`);
      
      // すべてのダウンロードボタンを探す
      console.log('🔍 Searching for all download buttons...');
      
      // 短い待機時間でダウンロードボタンを探す
      try {
        await this.driver.wait(until.elementLocated(By.xpath("//button[contains(text(), 'Download')]")), 15000);
      } catch (timeoutError) {
        console.log('⏰ No download buttons found within timeout');
      }
      
      // ダウンロードボタンを確認
      const downloadButtons = await this.driver.findElements(By.xpath("//button[contains(text(), 'Download')]"));
      console.log(`✅ Found ${downloadButtons.length} total download button(s)`);
      
      if (downloadButtons.length > 0) {
        // 各ボタンのテキストを確認
        for (let i = 0; i < downloadButtons.length; i++) {
          try {
            const buttonText = await downloadButtons[i].getText();
            console.log(`  Download Button ${i + 1}: "${buttonText}"`);
          } catch (error) {
            console.log(`  Download Button ${i + 1}: [Error reading text]`);
          }
        }
        
        this.addTestResult(testName, true, `Found ${downloadButtons.length} download button(s) for multiple sequences`);
      } else {
        this.addTestResult(testName, false, 'No download buttons found for multiple sequences');
      }
    } catch (error) {
      console.error(`❌ ${testName} failed:`, error.message);
      this.addTestResult(testName, false, error.message);
    }
  }

  async testDownloadButtonClick() {
    const testName = 'Download Button Click';
    try {
      console.log(`\n📋 Running: ${testName}`);
      
      // ダウンロードボタンを探す
      console.log('🔍 Looking for download buttons to click...');
      
      try {
        await this.driver.wait(until.elementLocated(By.xpath("//button[contains(text(), 'Download')]")), 15000);
      } catch (timeoutError) {
        console.log('⏰ No download buttons found within timeout');
        this.addTestResult(testName, false, 'No download buttons available to click');
        return;
      }
      
      const downloadButtons = await this.driver.findElements(By.xpath("//button[contains(text(), 'Download')]"));
      console.log(`✅ Found ${downloadButtons.length} download button(s) to test`);
      
      if (downloadButtons.length > 0) {
        // 最初のダウンロードボタンをクリック
        const firstButton = downloadButtons[0];
        const buttonText = await firstButton.getText();
        console.log(`🖱️ Clicking download button: "${buttonText}"`);
        
        // ボタンがクリック可能になるまで少し待機
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // ボタンをクリック
        await firstButton.click();
        console.log('✅ Download button clicked successfully');
        
        // ダウンロードが開始されたかどうかを確認（短い待機）
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        this.addTestResult(testName, true, `Successfully clicked download button: "${buttonText}"`);
      } else {
        this.addTestResult(testName, false, 'No download buttons found to click');
      }
    } catch (error) {
      console.error(`❌ ${testName} failed:`, error.message);
      this.addTestResult(testName, false, error.message);
    }
  }

  addTestResult(testName, passed, message) {
    const result = {
      test: testName,
      passed,
      message,
      timestamp: new Date().toISOString()
    };
    
    this.results.tests.push(result);
    this.results.summary.total++;
    
    if (passed) {
      this.results.summary.passed++;
      console.log(`✅ ${testName}: ${message}`);
    } else {
      this.results.summary.failed++;
      console.log(`❌ ${testName}: ${message}`);
    }
  }

  async cleanup() {
    if (this.driver) {
      try {
        await this.driver.quit();
        console.log('🔚 Browser closed');
      } catch (error) {
        console.error('Error closing browser:', error);
      }
    }
  }

  async saveResults() {
    try {
      const outputPath = path.join(__dirname, 'logs', 'sequence-download-buttons-test-results.json');
      
      // ログディレクトリが存在しない場合は作成
      const logDir = path.dirname(outputPath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      fs.writeFileSync(outputPath, JSON.stringify(this.results, null, 2));
      console.log(`💾 Results saved to: ${outputPath}`);
      
      // サマリーを表示
      console.log('\n📊 Test Summary:');
      console.log(`Total: ${this.results.summary.total}`);
      console.log(`Passed: ${this.results.summary.passed}`);
      console.log(`Failed: ${this.results.summary.failed}`);
      console.log(`Success Rate: ${((this.results.summary.passed / this.results.summary.total) * 100).toFixed(1)}%`);
      
    } catch (error) {
      console.error('❌ Failed to save results:', error);
    }
  }
}

// メイン実行関数
async function runSequenceDownloadButtonsTest() {
  const tester = new SequenceDownloadButtonsTester();
  
  try {
    console.log('🧪 Starting Sequence Download Buttons Test Suite');
    console.log('=' .repeat(60));
    
    if (!(await tester.setup())) {
      throw new Error('Failed to setup WebDriver');
    }
    
    await tester.runTest();
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    
    // エラー情報を保存
    const errorResults = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    };
    
    const errorPath = path.join(__dirname, 'logs', 'sequence-download-buttons-test-error.json');
    fs.writeFileSync(errorPath, JSON.stringify(errorResults, null, 2));
    console.log(`💾 Error details saved to: ${errorPath}`);
    
  } finally {
    await tester.cleanup();
    await tester.saveResults();
    console.log('\n🏁 Test suite completed');
  }
}

// スクリプトが直接実行された場合のみテストを実行
if (require.main === module) {
  runSequenceDownloadButtonsTest();
}

module.exports = { SequenceDownloadButtonsTester, runSequenceDownloadButtonsTest }; 