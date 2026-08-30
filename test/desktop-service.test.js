const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { buildPortableConfig } = require("../src/config-utils");
const { resolvePortablePaths } = require("../src/desktop-paths");
const { ensurePortableLayout, getAutomationStatus, getCommandBlockReason, getCommandSpec, getTodayBookStatistics, getTodayDeduplicatedProcessedBookCount, getTodayNewBookCount, isAutoWatchdogArg, tailText } = require("../src/desktop-service");
const chromeProfileName = "\u4e03\u732b\u51fa\u4e66";

function testPortableConfigUsesSoftwareFolder() {
  const root = "D:\\七猫出书管理器";
  const config = buildPortableConfig(root);
  assert.strictEqual(config.platformLinkFile, path.join(root, "config", "平台链接.txt"));
  assert.strictEqual(config.doubaoLinkFile, path.join(root, "config", "豆包链接.txt"));
  assert.strictEqual(config.wechatWebhookFile, path.join(root, "config", "企业微信接口.txt"));
  assert.strictEqual(config.feishuApiFile, path.join(root, "config", "飞书api.txt"));
  assert.strictEqual(config.feishuTableLinkFile, path.join(root, "config", "出书完成表格.txt"));
  assert.strictEqual(config.chromeProfileDir, path.join(root, chromeProfileName));
  assert.strictEqual(config.templateDir, path.join(root, "充值模板"));
  assert.strictEqual(config.latestChapterTextFile, path.join(root, "小说可移动", "小说内容.txt"));
}

function testResolvePortablePathsReturnsKnownFolders() {
  const root = "D:\\七猫出书管理器";
  const paths = resolvePortablePaths(root);
  assert.strictEqual(paths.rootDir, root);
  assert.strictEqual(paths.configDir, path.join(root, "config"));
  assert.strictEqual(paths.dataDir, path.join(root, "data"));
  assert.strictEqual(paths.logsDir, path.join(root, "logs"));
  assert.strictEqual(paths.outputsDir, path.join(root, "outputs"));
}

function testTailTextReturnsLastLines() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-desktop-"));
  const file = path.join(dir, "run.log");
  fs.writeFileSync(file, "1\n2\n3\n4\n", "utf8");
  assert.strictEqual(tailText(file, 2), "3\n4");
}

function testGetCommandSpecUsesCurrentNodeForScripts() {
  const root = "D:\\七猫出书管理器";
  const spec = getCommandSpec(root, "self-check");
  assert.strictEqual(spec.command, process.execPath);
  assert.deepStrictEqual(spec.args, [path.join(root, "src", "self-check.js")]);
  assert.strictEqual(spec.cwd, root);
  assert.strictEqual(spec.env.QIMAO_APP_ROOT, root);
}

function testGetCommandSpecSupportsSeparateScriptRoot() {
  const root = "D:\\七猫出书管理器";
  const scriptRoot = "D:\\七猫出书管理器\\resources\\app.asar";
  const spec = getCommandSpec(root, "run-once", scriptRoot);
  assert.deepStrictEqual(spec.args, [path.join(scriptRoot, "src", "run-once.js")]);
  assert.strictEqual(spec.cwd, root);
  assert.strictEqual(spec.env.QIMAO_APP_ROOT, root);
}

function testGetCommandSpecSupportsRunToday() {
  const root = "D:\\七猫出书管理器";
  const spec = getCommandSpec(root, "run-today");
  assert.deepStrictEqual(spec.args, [path.join(root, "src", "run-today.js")]);
}

function testGetCommandSpecSupportsWatchdogAndPreventSleep() {
  const root = "D:\\七猫出书管理器";
  assert.deepStrictEqual(getCommandSpec(root, "watchdog").args, [path.join(root, "src", "watchdog.js")]);
  assert.deepStrictEqual(getCommandSpec(root, "prevent-sleep").args, [path.join(root, "src", "prevent-sleep.js")]);
}

function testAutoWatchdogArgDetection() {
  assert.strictEqual(isAutoWatchdogArg(["qimao-manager.exe", "--auto-watchdog"]), true);
  assert.strictEqual(isAutoWatchdogArg(["qimao-manager.exe"]), false);
}

function testGetAutomationStatusCountsData() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-status-"));
  fs.mkdirSync(path.join(dir, "data"), { recursive: true });
  fs.mkdirSync(path.join(dir, "logs"), { recursive: true });
  fs.writeFileSync(path.join(dir, "data", "seen_books.json"), JSON.stringify({ bookIds: ["1", "2"] }), "utf8");
  fs.writeFileSync(path.join(dir, "data", "failed_tasks.json"), JSON.stringify({ failures: [{ bookId: "3", attempts: 3 }] }), "utf8");
  fs.writeFileSync(
    path.join(dir, "logs", "run.log"),
    "[2026-07-02 01:00:00] 本次扫描 10 页，共读取到 500 个唯一书籍ID。\n",
    "utf8"
  );
  const status = getAutomationStatus(dir);
  assert.strictEqual(status.seenCount, 2);
  assert.strictEqual(status.failureCount, 1);
  assert.strictEqual(status.lastScanBookCount, 500);
}

function testGetAutomationStatusCountsTodayNewAndProcessedBooks() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-today-"));
  fs.mkdirSync(path.join(dir, "data"), { recursive: true });
  fs.mkdirSync(path.join(dir, "logs"), { recursive: true });
  fs.writeFileSync(path.join(dir, "data", "seen_books.json"), JSON.stringify({ bookIds: [] }), "utf8");
  fs.writeFileSync(path.join(dir, "data", "failed_tasks.json"), JSON.stringify({ failures: [] }), "utf8");
  fs.writeFileSync(
    path.join(dir, "logs", "run.log"),
    [
      "[2026-07-01 23:00:00] 发现 99 本新书，本次会全部处理。",
      "[2026-07-02 08:00:00] 发现 3 本新书，本次会全部处理。",
      "[2026-07-02 08:01:00] 已记录书籍ID：700001",
      "[2026-07-02 09:00:00] 发现 2 本新书，本次会全部处理。",
      "[2026-07-02 09:01:00] 已记录书籍ID：700002",
      "[2026-07-01 23:01:00] 已记录书籍ID：699999",
    ].join("\n"),
    "utf8"
  );
  const status = getAutomationStatus(dir, "2026-07-02");
  assert.strictEqual(status.todayNewBookCount, 0);
  assert.strictEqual(status.todayProcessedBookCount, 2);
  assert.strictEqual(status.todayManualProcessedBookCount, 0);
}

function testGetAutomationStatusCountsCurrentEnglishProcessedLog() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-current-log-"));
  fs.mkdirSync(path.join(dir, "data"), { recursive: true });
  fs.mkdirSync(path.join(dir, "logs"), { recursive: true });
  fs.writeFileSync(path.join(dir, "data", "seen_books.json"), JSON.stringify({ bookIds: [] }), "utf8");
  fs.writeFileSync(path.join(dir, "data", "failed_tasks.json"), JSON.stringify({ failures: [] }), "utf8");
  fs.writeFileSync(
    path.join(dir, "logs", "run.log"),
    [
      "[2026-07-03 08:00:00] 本次扫描 10 页，共读取到 500 个唯一书籍ID。",
      "[2026-07-03 08:01:00] 发现 3 本新书，本次会全部处理。",
      "[2026-07-03 08:02:00] Recorded book ID: 700001",
    ].join("\n"),
    "utf8"
  );
  const status = getAutomationStatus(dir, "2026-07-03");
  assert.strictEqual(status.lastScanBookCount, 500);
  assert.strictEqual(status.lastNewBookCount, 3);
  assert.strictEqual(status.todayNewBookCount, 0);
  assert.strictEqual(status.todayProcessedBookCount, 1);
  assert.strictEqual(status.todayManualProcessedBookCount, 0);
}

function testGetAutomationStatusCountsTodayAddedAndPendingLogs() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-today-added-"));
  fs.mkdirSync(path.join(dir, "data"), { recursive: true });
  fs.mkdirSync(path.join(dir, "logs"), { recursive: true });
  fs.writeFileSync(path.join(dir, "data", "seen_books.json"), JSON.stringify({ bookIds: [] }), "utf8");
  fs.writeFileSync(path.join(dir, "data", "failed_tasks.json"), JSON.stringify({ failures: [] }), "utf8");
  fs.writeFileSync(
    path.join(dir, "logs", "run.log"),
    [
      "[2026-07-03 08:00:00] 今日添加书籍：7 本（添加时间=2026-07-03）。",
      "[2026-07-03 08:01:00] 发现 5 本今日待处理书籍，本次会全部处理。",
      "[2026-07-03 08:02:00] Recorded book ID: 700001",
    ].join("\n"),
    "utf8"
  );
  const status = getAutomationStatus(dir, "2026-07-03");
  assert.strictEqual(status.todayNewBookCount, 0);
  assert.strictEqual(status.lastNewBookCount, 5);
  assert.strictEqual(status.todayProcessedBookCount, 1);
  assert.strictEqual(status.todayManualProcessedBookCount, 0);
}

function testGetAutomationStatusCountsLargeCurrentRunLog() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-large-log-"));
  fs.mkdirSync(path.join(dir, "data"), { recursive: true });
  fs.mkdirSync(path.join(dir, "logs"), { recursive: true });
  fs.writeFileSync(path.join(dir, "data", "seen_books.json"), JSON.stringify({ bookIds: [] }), "utf8");
  fs.writeFileSync(path.join(dir, "data", "failed_tasks.json"), JSON.stringify({ failures: [] }), "utf8");
  const processedLines = Array.from({ length: 600 }, (_, index) => {
    return `[2026-07-03 09:00:00] Recorded book ID: ${700000 + index}`;
  });
  fs.writeFileSync(
    path.join(dir, "logs", "run.log"),
    [
      "[2026-07-03 08:00:00] 本次扫描 10 页，共读取到 500 个唯一书籍ID。",
      "[2026-07-03 08:01:00] 发现 269 本新书，本次会全部处理。",
      ...processedLines,
    ].join("\n"),
    "utf8"
  );
  const status = getAutomationStatus(dir, "2026-07-03");
  assert.strictEqual(status.lastScanBookCount, 500);
  assert.strictEqual(status.lastNewBookCount, 269);
  assert.strictEqual(status.todayNewBookCount, 0);
  assert.strictEqual(status.todayProcessedBookCount, 600);
  assert.strictEqual(status.todayManualProcessedBookCount, 0);
}

function testGetAutomationStatusSeparatesManualProcessedBooks() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-manual-status-"));
  fs.mkdirSync(path.join(dir, "data"), { recursive: true });
  fs.mkdirSync(path.join(dir, "logs"), { recursive: true });
  fs.writeFileSync(path.join(dir, "data", "seen_books.json"), JSON.stringify({ bookIds: [] }), "utf8");
  fs.writeFileSync(path.join(dir, "data", "failed_tasks.json"), JSON.stringify({ failures: [] }), "utf8");
  fs.writeFileSync(
    path.join(dir, "logs", "run.log"),
    [
      "[2026-07-03 08:00:00] Starting one run.",
      "[2026-07-03 08:01:00] Recorded automatic book ID: 700001",
      "[2026-07-03 08:02:00] Starting one run.",
      "[2026-07-03 08:03:00] MANUAL_BOOK_IDS=700002,700003",
      "[2026-07-03 08:04:00] Recorded book ID: 700002",
      "[2026-07-03 08:05:00] Recorded manual book ID: 700003",
    ].join("\n"),
    "utf8"
  );
  const status = getAutomationStatus(dir, "2026-07-03");
  assert.strictEqual(status.todayProcessedBookCount, 1);
  assert.strictEqual(status.todayManualProcessedBookCount, 2);
}

function testEnsurePortableLayoutCreatesConfigAndFolders() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-layout-"));
  ensurePortableLayout(dir);
  assert.strictEqual(fs.existsSync(path.join(dir, "config.json")), true);
  assert.strictEqual(fs.existsSync(path.join(dir, "config")), true);
  assert.strictEqual(fs.existsSync(path.join(dir, "data")), true);
  assert.strictEqual(fs.existsSync(path.join(dir, "logs")), true);
  assert.strictEqual(fs.existsSync(path.join(dir, "outputs")), true);
  assert.strictEqual(fs.existsSync(path.join(dir, "failed")), true);
  assert.strictEqual(fs.existsSync(path.join(dir, "小说可移动")), true);
  assert.strictEqual(fs.existsSync(path.join(dir, "充值模板")), true);
  assert.strictEqual(fs.existsSync(path.join(dir, chromeProfileName)), true);
  const config = JSON.parse(fs.readFileSync(path.join(dir, "config.json"), "utf8"));
  assert.strictEqual(config.platformLinkFile, path.join(dir, "config", "平台链接.txt"));
}

function testChromeCommandsAreBlockedWhileAnotherChromeCommandRuns() {
  assert.strictEqual(getCommandBlockReason("self-check", ["watch-hourly"]), "已有任务正在使用专属 Chrome，请先停止或等待完成。");
  assert.strictEqual(getCommandBlockReason("run-today", ["watch-hourly"]), "已有任务正在使用专属 Chrome，请先停止或等待完成。");
  assert.strictEqual(getCommandBlockReason("open-login", ["run-once"]), "已有任务正在使用专属 Chrome，请先停止或等待完成。");
  assert.strictEqual(getCommandBlockReason("stop-all", ["watch-hourly"]), "");
}

testPortableConfigUsesSoftwareFolder();
testResolvePortablePathsReturnsKnownFolders();
testTailTextReturnsLastLines();
testGetCommandSpecUsesCurrentNodeForScripts();
testGetCommandSpecSupportsSeparateScriptRoot();
testGetCommandSpecSupportsRunToday();
testGetCommandSpecSupportsWatchdogAndPreventSleep();
testAutoWatchdogArgDetection();
testGetAutomationStatusCountsData();
testGetAutomationStatusCountsTodayNewAndProcessedBooks();
testGetAutomationStatusCountsCurrentEnglishProcessedLog();
testGetAutomationStatusCountsTodayAddedAndPendingLogs();
testGetAutomationStatusCountsLargeCurrentRunLog();
testGetAutomationStatusSeparatesManualProcessedBooks();
function testTodayNewBookCountUsesLatestCompleteScan() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-today-scan-"));
  fs.writeFileSync(path.join(dir, "today_scan.json"), JSON.stringify({ date: "2026-07-03", bookIds: ["1", "1", "2"] }), "utf8");
  assert.strictEqual(getTodayNewBookCount(dir, "2026-07-03"), 2);
  assert.strictEqual(getTodayNewBookCount(dir, "2026-07-04"), 0);
}
testTodayNewBookCountUsesLatestCompleteScan();
function testTodayDeduplicatedProcessedBookCountUsesOriginalTitleShape() {
  const runLog = [
    "[2026-08-11 08:00:00] Start book: 1 15同名书",
    "[2026-08-11 08:01:00] Recorded automatic book ID: 1",
    "[2026-08-11 08:02:00] Start book: 2 8同名书",
    "[2026-08-11 08:03:00] Recorded automatic book ID: 2",
  ].join("\n");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-today-dedup-"));
  assert.strictEqual(getTodayDeduplicatedProcessedBookCount(dir, runLog, "2026-08-11"), 1);
}
testTodayDeduplicatedProcessedBookCountUsesOriginalTitleShape();
function testTodayPendingBookCountExcludesCompletedBooks() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-today-pending-"));
  fs.mkdirSync(path.join(dir, "data"), { recursive: true });
  fs.mkdirSync(path.join(dir, "logs"), { recursive: true });
  fs.writeFileSync(path.join(dir, "data", "today_scan.json"), JSON.stringify({ date: "2026-07-03", bookIds: ["1", "2", "3"], books: [
    { bookId: "1", bookName: "15同名书", originalBookName: "同名书" },
    { bookId: "2", bookName: "8同名书", originalBookName: "同名书" },
    { bookId: "3", bookName: "待处理书" },
  ] }), "utf8");
  fs.writeFileSync(path.join(dir, "data", "seen_books.json"), JSON.stringify({ bookIds: ["1"] }), "utf8");
  fs.writeFileSync(path.join(dir, "data", "failed_tasks.json"), JSON.stringify({ failures: [] }), "utf8");
  const status = getAutomationStatus(dir, "2026-07-03");
  fs.writeFileSync(path.join(dir, "data", "today_processed_titles.json"), JSON.stringify({ date: "2026-07-03", originalTitleKeys: ["同名书"] }), "utf8");
  fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify({ duplicateBookTitleMode: "without-number" }), "utf8");
  const updatedStatus = getAutomationStatus(dir, "2026-07-03");
  assert.strictEqual(updatedStatus.todayNewBookCount, 2);
  assert.strictEqual(updatedStatus.todayProcessedBookCount, 1);
  assert.strictEqual(updatedStatus.todayPendingBookCount, 1);
}
testTodayPendingBookCountExcludesCompletedBooks();
function testTodayBookStatisticsCountsTerminalFailuresSeparately() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-real-today-"));
  fs.mkdirSync(path.join(dir, "data"), { recursive: true });
  fs.writeFileSync(path.join(dir, "data", "today_scan.json"), JSON.stringify({ date: "2026-08-11", books: [
    { bookId: "1", bookName: "15同名书", originalBookName: "同名书" },
    { bookId: "2", bookName: "8同名书", originalBookName: "同名书" },
    { bookId: "3", bookName: "已完成书" },
    { bookId: "4", bookName: "彻底失败书" },
    { bookId: "5", bookName: "等待重试书" },
  ] }), "utf8");
  fs.writeFileSync(path.join(dir, "data", "today_processed_titles.json"), JSON.stringify({ date: "2026-08-11", originalTitleKeys: ["同名书", "已完成书"] }), "utf8");
  const result = getTodayBookStatistics(path.join(dir, "data"), "", [
    { bookId: "4", attempts: 3 },
    { bookId: "5", attempts: 1, nextRetryAt: "2026-08-11 09:00:00" },
  ], "2026-08-11", "without-number", 3);
  assert.deepStrictEqual(result, { total: 4, completed: 2, pending: 1, terminalFailed: 1 });
}
testTodayBookStatisticsCountsTerminalFailuresSeparately();
testEnsurePortableLayoutCreatesConfigAndFolders();
testChromeCommandsAreBlockedWhileAnotherChromeCommandRuns();
console.log("desktop-service tests passed");
