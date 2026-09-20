const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  buildExternalConfig,
  buildNodeModeBat,
  buildScriptBatMap,
  buildStartManagerBat,
  shouldCopyRuntimeDataFile,
} = require("../src/make-external-release");

function testExternalConfigUsesRelativePaths() {
  const config = buildExternalConfig();
  assert.strictEqual(config.platformLinkFile, "config\\平台链接.txt");
  assert.strictEqual(config.wechatWebhookFile, "config\\企业微信接口.txt");
  assert.strictEqual(config.feishuApiFile, "config\\飞书api.txt");
  assert.strictEqual(config.feishuTableLinkFile, "config\\出书完成表格.txt");
  assert.strictEqual(config.templateDir, "充值模板");
  assert.strictEqual(config.chromeProfileDir, "\u4e03\u732b\u51fa\u4e66");
  assert.strictEqual(config.singleBookTimeoutMs, 300000);
  assert.strictEqual(config.failureRetryDelayMs, 3600000);
  assert.strictEqual(config.deepseekApiKeyFile, "config\\DeepSeek接口.txt");
  assert.strictEqual(config.deepseekModel, "deepseek-v4-flash-0731");
  assert.strictEqual(config.deepseekApiBaseUrl, "https://ws-qbczn48xwolhpy29.cn-beijing.maas.aliyuncs.com/api/v1");
  assert.strictEqual(config.deepseekTimeoutMs, 45000);
  assert.strictEqual(config.sendNovelToWechat, true);
  assert.strictEqual(config.failedDir, "failed");
  assert.strictEqual(config.latestChapterTextFile, "小说可移动\\小说内容.txt");
  assert.strictEqual(config.forbiddenWordsFile, "违禁词.txt");
}

function testExternalBatDoesNotRequireNpm() {
  const bat = buildNodeModeBat("运行一次", "run-once.js");
  assert(!/npm/i.test(bat));
  assert(bat.includes("qimao-manager.exe"));
  assert(bat.includes("chcp 65001"));
  assert(bat.includes("ELECTRON_RUN_AS_NODE=1"));
  assert(bat.includes("resources\\app.asar\\src\\run-once.js"));
  assert(bat.includes("logs"));
  assert(bat.includes("> \"%QIMAO_LOG%\" 2>&1"));
  assert(bat.includes("type \"%QIMAO_LOG%\""));
}

function testStartManagerBatRunsExeDirectly() {
  const bat = buildStartManagerBat();
  assert(!/npm/i.test(bat));
  assert(bat.includes("qimao-manager.exe"));
  assert(!bat.includes("ELECTRON_RUN_AS_NODE=1"));
}

function testExternalBatMapIncludesRunToday() {
  const scripts = buildScriptBatMap();
  assert.strictEqual(scripts["一键出完今日书.bat"], "run-today.js");
  assert.strictEqual(scripts["一键守护监控.bat"], "watchdog.js");
  assert.strictEqual(scripts["一键防睡眠.bat"], "prevent-sleep.js");
}

function testExternalDataCopySkipsVolatileFiles() {
  assert.strictEqual(shouldCopyRuntimeDataFile("seen_books.json"), false);
  assert.strictEqual(shouldCopyRuntimeDataFile("producer_state.json"), false);
  assert.strictEqual(shouldCopyRuntimeDataFile("failed_tasks.json"), false);
  assert.strictEqual(shouldCopyRuntimeDataFile("current_task.json"), false);
  assert.strictEqual(shouldCopyRuntimeDataFile("run-once.lock"), false);
}

function testGitIgnoreProtectsPortableUserData() {
  const text = fs.readFileSync(path.join(__dirname, "..", ".gitignore"), "utf8");
  for (const ignoredPath of ["config.json", "config/", "data/", "logs/", "failed/", "outputs/", "七猫出书/", "ChromeProfile/", "充值模板/", "小说可移动/", "违禁词.txt", "node_modules/", "release/"]) {
    assert.ok(text.split(/\r?\n/).includes(ignoredPath), `missing gitignore rule: ${ignoredPath}`);
  }
}

testExternalConfigUsesRelativePaths();
testExternalBatDoesNotRequireNpm();
testStartManagerBatRunsExeDirectly();
testExternalBatMapIncludesRunToday();
testExternalDataCopySkipsVolatileFiles();
testGitIgnoreProtectsPortableUserData();
console.log("make-external-release tests passed");
