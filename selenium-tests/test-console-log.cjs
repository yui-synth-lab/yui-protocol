const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const path = require('path');

const outputPath = path.join(__dirname, 'logs', 'console-log-results.json');
const errorPath = path.join(__dirname, 'logs', 'console-log-error.json');

class ConsoleLogTester {
  constructor() {
    this.driver = null;
    this.consoleLogs = [];
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
      const originalLog = console.log;
      console.log = function(...args) {
        const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
        window.consoleLogs.push({
          level: 'log',
          message: message,
          timestamp: new Date().toISOString()
        });
        originalLog.apply(console, args);
      };
    `);
  }

  async navigateToApp() {
    await this.driver.get('http://localhost:3001');
    console.log('アプリケーションに移動しました');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  async startSession() {
    try {
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
        await titleInput[0].sendKeys('Selenium Test Session');
        console.log('セッション名を入力しました: Selenium Test Session');
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
    } catch (error) {
      console.error('セッション開始エラー:', error);
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

  async monitorLogs(duration = 60000) {
    console.log(`${duration}ms間コンソールログを監視します...`);
    const startTime = Date.now();
    const allLogs = [];
    
    while (Date.now() - startTime < duration) {
      const logs = await this.getConsoleLogs();
      if (logs.length > 0) {
        allLogs.push(...logs);
        console.log(`[${new Date().toISOString()}] ログ検出: ${logs.length}件`);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return allLogs;
  }

  async saveResults(logs) {
    const results = {
      timestamp: new Date().toISOString(),
      totalLogs: logs.length,
      logs: logs
    };
    
    // logsディレクトリが存在しない場合は作成
    const logsDir = path.dirname(outputPath);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
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
  const tester = new ConsoleLogTester();
  try {
    console.log('=== コンソールログテスト開始 ===');
    await tester.setup();
    await tester.navigateToApp();
    
    const sessionStarted = await tester.startSession();
    if (!sessionStarted) {
      console.log('セッション開始に失敗しました');
      return;
    }
    
    const logs = await tester.monitorLogs(60000); // 60秒間監視
    await tester.saveResults(logs);
    
    console.log('=== テスト結果 ===');
    console.log(`総ログ数: ${logs.length}`);
    
    // ログの分類
    const uiLogs = logs.filter(log => log.message.includes('[UI]'));
    const systemLogs = logs.filter(log => log.message.includes('[System]'));
    const errorLogs = logs.filter(log => log.message.includes('Error') || log.message.includes('error'));
    
    console.log(`UIログ: ${uiLogs.length}件`);
    console.log(`システムログ: ${systemLogs.length}件`);
    console.log(`エラーログ: ${errorLogs.length}件`);
    
  } catch (error) {
    console.error('テスト実行エラー:', error);
    const errorResult = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    };
    
    const logsDir = path.dirname(errorPath);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    fs.writeFileSync(errorPath, JSON.stringify(errorResult, null, 2));
  } finally {
    await tester.cleanup();
  }
}

main(); 