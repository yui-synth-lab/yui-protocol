const { Builder, By, until, Key } = require('selenium-webdriver');
const fs = require('fs');
const path = require('path');

class MessageCountUpdateTester {
  constructor() {
    this.driver = null;
    this.testResults = {
      testName: 'Message Count Update Test',
      timestamp: new Date().toISOString(),
      results: [],
      summary: {}
    };
  }

  async setup() {
    console.log('=== メッセージカウント更新テスト開始 ===');
    
    // Chromeドライバーの設定
    this.driver = await new Builder()
      .forBrowser('chrome')
      .build();
    
    // ウィンドウサイズを設定
    await this.driver.manage().window().setRect({ width: 1920, height: 1080 });
    
    console.log('Chromeドライバーを初期化しました');
  }

  async navigateToApp() {
    try {
      console.log('アプリケーションに移動中...');
      await this.driver.get('http://localhost:3001');
      
      // ページが読み込まれるまで待機
      await this.driver.wait(until.elementLocated(By.xpath("//button[normalize-space(text())='New']")), 20000);
      console.log('アプリケーションに正常に移動しました');
      
      // 少し待機してページの完全な読み込みを待つ
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return true;
    } catch (error) {
      console.error('アプリケーションへの移動に失敗しました:', error.message);
      return false;
    }
  }

  async createNewSession() {
    try {
      console.log('新しいセッションを作成中...');
      
      // 1. 「New」ボタンをクリック
      const newButton = await this.driver.findElement(By.xpath("//button[normalize-space(text())='New']"));
      await newButton.click();
      console.log('「New」ボタンをクリックしました');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 2. セッション名を入力
      const titleInput = await this.driver.findElement(By.css('input[placeholder*="title"], input[placeholder*="Title"], input[name="title"]'));
      await titleInput.clear();
      await titleInput.sendKeys('Message Count Test Session');
      console.log('セッション名を入力しました: Message Count Test Session');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 3. 「Create Session」ボタンをクリック
      const createButton = await this.driver.findElement(By.xpath("//button[normalize-space(text())='Create Session']"));
      await createButton.click();
      console.log('「Create Session」ボタンをクリックしました');
      
      // 4. セッションが作成されるまで待機
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return true;
    } catch (error) {
      console.error('セッション作成に失敗しました:', error.message);
      return false;
    }
  }

  async getInitialMessageCount() {
    try {
      // 現在選択されているセッションのメッセージカウントを取得
      const sessionElement = await this.driver.findElement(By.css('button.bg-blue-950.border-blue-800'));
      const messageCountText = await sessionElement.findElement(By.css('p.text-xs.text-gray-400')).getText();
      
      // "X agents • Y messages" の形式からメッセージ数を抽出
      const match = messageCountText.match(/(\d+)\s+messages/);
      const messageCount = match ? parseInt(match[1]) : 0;
      
      console.log(`初期メッセージカウント: ${messageCount}`);
      return messageCount;
    } catch (error) {
      console.error('初期メッセージカウントの取得に失敗しました:', error.message);
      return 0;
    }
  }

  async sendMessageAndWaitForResponse(message) {
    try {
      console.log(`メッセージを送信中: "${message}"`);
      
      // 1. メッセージ入力フィールドを見つける
      const messageInput = await this.driver.findElement(By.css('textarea, input[type="text"]'));
      await messageInput.clear();
      await messageInput.sendKeys(message);
      console.log('メッセージを入力しました');
      
      // 2. 送信ボタンをクリック
      const sendButton = await this.driver.findElement(By.css('button[type="submit"]'));
      await sendButton.click();
      console.log('送信ボタンをクリックしました');
      
      // 3. レスポンスが始まるまで待機
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 4. エージェントのレスポンスが表示されるまで待機（最大60秒）
      const maxWaitTime = 60000;
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitTime) {
        try {
          // エージェントのメッセージが表示されているかチェック
          const agentMessages = await this.driver.findElements(By.css('[data-agent-id], .agent-message, .message-agent'));
          if (agentMessages.length > 0) {
            console.log(`${agentMessages.length}個のエージェントメッセージを検出しました`);
            break;
          }
        } catch (error) {
          // 要素が見つからない場合は続行
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // 5. 追加の待機時間（メッセージの完全な表示を待つ）
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      return true;
    } catch (error) {
      console.error('メッセージ送信に失敗しました:', error.message);
      return false;
    }
  }

  async getUpdatedMessageCount() {
    try {
      // 現在選択されているセッションのメッセージカウントを取得
      const sessionElement = await this.driver.findElement(By.css('button.bg-blue-950.border-blue-800'));
      const messageCountText = await sessionElement.findElement(By.css('p.text-xs.text-gray-400')).getText();
      
      // "X agents • Y messages" の形式からメッセージ数を抽出
      const match = messageCountText.match(/(\d+)\s+messages/);
      const messageCount = match ? parseInt(match[1]) : 0;
      
      console.log(`更新後のメッセージカウント: ${messageCount}`);
      return messageCount;
    } catch (error) {
      console.error('更新後のメッセージカウントの取得に失敗しました:', error.message);
      return 0;
    }
  }

  async checkMessageCountUpdate(initialCount, updatedCount) {
    const isUpdated = updatedCount > initialCount;
    const result = {
      test: 'Message Count Update',
      initialCount,
      updatedCount,
      isUpdated,
      status: isUpdated ? 'PASS' : 'FAIL',
      message: isUpdated 
        ? `メッセージカウントが正しく更新されました: ${initialCount} → ${updatedCount}`
        : `メッセージカウントが更新されませんでした: ${initialCount} → ${updatedCount}`
    };
    
    this.testResults.results.push(result);
    console.log(`[${result.status}] ${result.message}`);
    
    return isUpdated;
  }

  async testMultipleMessageUpdates() {
    try {
      console.log('複数メッセージの更新テストを開始...');
      
      const testMessages = [
        '最初のテストメッセージ',
        '2番目のテストメッセージ',
        '3番目のテストメッセージ'
      ];
      
      let previousCount = await this.getInitialMessageCount();
      let allPassed = true;
      
      for (let i = 0; i < testMessages.length; i++) {
        console.log(`\n--- テスト ${i + 1}/${testMessages.length} ---`);
        
        // メッセージを送信
        const sendSuccess = await this.sendMessageAndWaitForResponse(testMessages[i]);
        if (!sendSuccess) {
          console.log(`テスト ${i + 1} のメッセージ送信に失敗しました`);
          allPassed = false;
          continue;
        }
        
        // 更新後のカウントを取得
        const updatedCount = await this.getUpdatedMessageCount();
        
        // カウント更新をチェック
        const isUpdated = await this.checkMessageCountUpdate(previousCount, updatedCount);
        if (!isUpdated) {
          allPassed = false;
        }
        
        previousCount = updatedCount;
        
        // 次のテストの前に少し待機
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      return allPassed;
    } catch (error) {
      console.error('複数メッセージ更新テストでエラーが発生しました:', error.message);
      return false;
    }
  }

  async testSessionSwitch() {
    try {
      console.log('セッション切り替えテストを開始...');
      
      // 1. 新しいセッションを作成
      const createSuccess = await this.createNewSession();
      if (!createSuccess) {
        console.log('セッション切り替えテスト: 新しいセッションの作成に失敗しました');
        return false;
      }
      
      // 2. 初期メッセージカウントを取得
      const initialCount = await this.getInitialMessageCount();
      
      // 3. メッセージを送信
      const sendSuccess = await this.sendMessageAndWaitForResponse('セッション切り替えテストメッセージ');
      if (!sendSuccess) {
        console.log('セッション切り替えテスト: メッセージ送信に失敗しました');
        return false;
      }
      
      // 4. 更新後のカウントを取得
      const updatedCount = await this.getUpdatedMessageCount();
      
      // 5. カウント更新をチェック
      const isUpdated = await this.checkMessageCountUpdate(initialCount, updatedCount);
      
      return isUpdated;
    } catch (error) {
      console.error('セッション切り替えテストでエラーが発生しました:', error.message);
      return false;
    }
  }

  async saveResults() {
    try {
      // テスト結果のサマリーを作成
      const totalTests = this.testResults.results.length;
      const passedTests = this.testResults.results.filter(r => r.status === 'PASS').length;
      const failedTests = totalTests - passedTests;
      
      this.testResults.summary = {
        totalTests,
        passedTests,
        failedTests,
        successRate: totalTests > 0 ? (passedTests / totalTests * 100).toFixed(2) : 0
      };
      
      // 結果をファイルに保存
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `message-count-test-results-${timestamp}.json`;
      const filepath = path.join(__dirname, 'logs', filename);
      
      // logsディレクトリが存在しない場合は作成
      const logsDir = path.dirname(filepath);
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      
      fs.writeFileSync(filepath, JSON.stringify(this.testResults, null, 2));
      console.log(`テスト結果を保存しました: ${filepath}`);
      
      return filepath;
    } catch (error) {
      console.error('テスト結果の保存に失敗しました:', error.message);
      return null;
    }
  }

  async cleanup() {
    if (this.driver) {
      try {
        await this.driver.quit();
        console.log('Chromeドライバーを終了しました');
      } catch (error) {
        console.error('ドライバーの終了中にエラーが発生しました:', error.message);
      }
    }
  }

  async runTest() {
    try {
      console.log('=== メッセージカウント更新テスト実行開始 ===');
      
      // 1. セットアップ
      await this.setup();
      
      // 2. アプリケーションに移動
      const navigateSuccess = await this.navigateToApp();
      if (!navigateSuccess) {
        throw new Error('アプリケーションへの移動に失敗しました');
      }
      
      // 3. 新しいセッションを作成
      const createSuccess = await this.createNewSession();
      if (!createSuccess) {
        throw new Error('セッション作成に失敗しました');
      }
      
      // 4. 複数メッセージの更新テスト
      console.log('\n=== 複数メッセージ更新テスト ===');
      const multipleTestPassed = await this.testMultipleMessageUpdates();
      
      // 5. セッション切り替えテスト
      console.log('\n=== セッション切り替えテスト ===');
      const switchTestPassed = await this.testSessionSwitch();
      
      // 6. 結果を保存
      const resultsFile = await this.saveResults();
      
      // 7. 最終結果を表示
      console.log('\n=== テスト結果サマリー ===');
      console.log(`複数メッセージ更新テスト: ${multipleTestPassed ? '✅ 成功' : '❌ 失敗'}`);
      console.log(`セッション切り替えテスト: ${switchTestPassed ? '✅ 成功' : '❌ 失敗'}`);
      console.log(`総合結果: ${multipleTestPassed && switchTestPassed ? '✅ 全テスト成功' : '❌ 一部テスト失敗'}`);
      
      if (resultsFile) {
        console.log(`詳細結果: ${resultsFile}`);
      }
      
      return multipleTestPassed && switchTestPassed;
      
    } catch (error) {
      console.error('テスト実行中にエラーが発生しました:', error.message);
      return false;
    } finally {
      await this.cleanup();
    }
  }
}

// テスト実行関数
async function main() {
  const tester = new MessageCountUpdateTester();
  try {
    const success = await tester.runTest();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('テスト実行エラー:', error);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみテストを実行
if (require.main === module) {
  main();
}

module.exports = MessageCountUpdateTester; 