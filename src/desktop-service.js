const fs = require("fs");
const path = require("path");
const { buildPortableConfig, writeConfig } = require("./config-utils");
const { resolvePortablePaths } = require("./desktop-paths");
const { duplicateBookTitleKey } = require("./platform-utils");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function ensurePortableLayout(rootDir) {
  const paths = resolvePortablePaths(rootDir);
  for (const dir of [
    paths.configDir,
    paths.dataDir,
    paths.logsDir,
    paths.outputsDir,
    paths.failedDir,
    paths.templateDir,
    paths.chromeProfileDir,
    paths.movableNovelDir,
  ]) {
    ensureDir(dir);
  }
  const configPath = path.join(rootDir, "config.json");
  if (!fs.existsSync(configPath)) {
    writeConfig(configPath, buildPortableConfig(rootDir));
  }
}

function readJsonSafe(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
}

function tailText(file, maxLines = 200) {
  try {
    return fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.length)
      .slice(-maxLines)
      .join("\n");
  } catch {
    return "";
  }
}

function getCommandSpec(rootDir, commandName, scriptRootDir = rootDir) {
  const scripts = {
    "run-once": "run-once.js",
    "run-today": "run-today.js",
    "watch-hourly": "watch-hourly.js",
    watchdog: "watchdog.js",
    "prevent-sleep": "prevent-sleep.js",
    "self-check": "self-check.js",
    "rebuild-baseline": "rebuild-baseline.js",
    "open-login": "open-login.js",
    "stop-all": "stop-all.js",
    "show-info": "show-info.js",
  };
  const script = scripts[commandName];
  if (!script) throw new Error(`未知命令：${commandName}`);
  return {
    command: process.execPath,
    args: [path.join(scriptRootDir, "src", script)],
    cwd: rootDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: process.versions.electron ? "1" : process.env.ELECTRON_RUN_AS_NODE,
      QIMAO_APP_ROOT: rootDir,
    },
  };
}

const chromeCommands = new Set(["run-once", "run-today", "watch-hourly", "self-check", "rebuild-baseline", "open-login", "show-info"]);

function getCommandBlockReason(commandName, runningNames) {
  if (!chromeCommands.has(commandName)) return "";
  const runningChromeCommand = (runningNames || []).find((name) => chromeCommands.has(name));
  if (!runningChromeCommand) return "";
  return "已有任务正在使用专属 Chrome，请先停止或等待完成。";
}

function isAutoWatchdogArg(argv) {
  return (argv || []).includes("--auto-watchdog");
}

function todayChinaText() {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function countTodayNewBooks(runLog, todayText) {
  const date = todayText.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const addedPattern = new RegExp(`^\\[${date} [^\\]]+\\].*今日添加书籍[:：]\\s*(\\d+)\\s+本`, "gm");
  const addedMatches = Array.from(runLog.matchAll(addedPattern));
  if (addedMatches.length) return addedMatches.reduce((sum, match) => sum + Number(match[1] || 0), 0);
  let count = 0;
  const pattern = new RegExp(`^\\[${date} [^\\]]+\\].*发现\\s+(\\d+)\\s+本新书`, "gm");
  for (const match of runLog.matchAll(pattern)) count += Number(match[1] || 0);
  return count;
}

function getLastPendingBookCount(runLog) {
  const matches = Array.from(runLog.matchAll(/发现\s+(\d+)\s+本(?:今日待处理书籍|新书)/g));
  return matches.length ? Number(matches[matches.length - 1][1] || 0) : 0;
}

function getTodayScanBookIds(dataDir, todayText) {
  const snapshot = readJsonSafe(path.join(dataDir, "today_scan.json"), {});
  if (snapshot.date !== todayText) return new Set();
  return new Set(snapshot.bookIds || []);
}

function getTodayScanBooks(dataDir, todayText) {
  const snapshot = readJsonSafe(path.join(dataDir, "today_scan.json"), {});
  if (snapshot.date !== todayText) return [];
  const byId = new Map();
  for (const book of snapshot.books || []) {
    if (book && book.bookId) byId.set(String(book.bookId), book);
  }
  // Older snapshots only recorded IDs. Keep their counts usable until the next scan upgrades the snapshot.
  for (const bookId of snapshot.bookIds || []) {
    if (!byId.has(String(bookId))) byId.set(String(bookId), { bookId: String(bookId), bookName: "" });
  }
  return Array.from(byId.values());
}

function getTodayNewBookCount(dataDir, todayText) {
  return getTodayScanBookIds(dataDir, todayText).size;
}

function statisticKey(book, duplicateBookTitleMode) {
  if (duplicateBookTitleMode === "without-number") {
    return duplicateBookTitleKey(book) || String(book && book.bookId || "");
  }
  return String(book && book.bookId || "");
}

function getTodayAutomaticBookIds(runLog, todayText) {
  const datePrefix = `[${todayText} `;
  let forcedRun = false;
  const started = new Set();
  const completed = new Set();
  for (const line of String(runLog || "").split(/\r?\n/)) {
    if (!line.startsWith(datePrefix)) continue;
    if (/启动一次试跑|Starting one run/.test(line)) forcedRun = false;
    if (/MANUAL_BOOK_IDS=|SINGLE_BOOK_ID=/.test(line)) forcedRun = true;
    const startedMatch = line.match(/Start book:\s*(\d+)/);
    if (startedMatch && !forcedRun) started.add(startedMatch[1]);
    const completedMatch = line.match(/Recorded automatic book ID:|已记录自动书籍ID：/);
    if (completedMatch) {
      const idMatch = line.match(/(\d+)\s*$/);
      if (idMatch) completed.add(idMatch[1]);
    }
  }
  return { started, completed };
}

function getTodayDeduplicatedProcessedBookCount(dataDir, runLog, todayText) {
  const snapshot = readJsonSafe(path.join(dataDir, "today_processed_titles.json"), {});
  if (snapshot.date === todayText && Array.isArray(snapshot.originalTitleKeys)) {
    return new Set(snapshot.originalTitleKeys).size;
  }

  const datePrefix = `[${todayText} `;
  const startedTitles = new Map();
  const completedTitles = new Set();
  let forcedRun = false;
  for (const line of String(runLog || "").split(/\r?\n/)) {
    if (!line.startsWith(datePrefix)) continue;
    if (/启动一次试跑|Starting one run/.test(line)) forcedRun = false;
    if (/MANUAL_BOOK_IDS=|SINGLE_BOOK_ID=/.test(line)) forcedRun = true;
    const startedMatch = line.match(/Start book:\s*(\d+)\s*(.*)$/);
    if (startedMatch) {
      const titleKey = duplicateBookTitleKey({ bookName: startedMatch[2] });
      if (titleKey) startedTitles.set(startedMatch[1], titleKey);
      continue;
    }
    if (forcedRun || !/Recorded automatic book ID:|已记录自动书籍ID：/.test(line)) continue;
    const idMatch = line.match(/(\d+)\s*$/);
    const titleKey = idMatch ? startedTitles.get(idMatch[1]) : "";
    if (titleKey) completedTitles.add(titleKey);
  }
  return completedTitles.size;
}

function getTodayAutomaticProcessedKeys(dataDir, runLog, todayText, duplicateBookTitleMode) {
  if (duplicateBookTitleMode === "without-number") {
    const snapshot = readJsonSafe(path.join(dataDir, "today_processed_titles.json"), {});
    if (snapshot.date === todayText && Array.isArray(snapshot.originalTitleKeys)) {
      return new Set(snapshot.originalTitleKeys.filter(Boolean));
    }
  }

  const datePrefix = `[${todayText} `;
  const startedBooks = new Map();
  const completedKeys = new Set();
  let forcedRun = false;
  for (const line of String(runLog || "").split(/\r?\n/)) {
    if (!line.startsWith(datePrefix)) continue;
    if (/启动一次试跑|Starting one run/.test(line)) forcedRun = false;
    if (/MANUAL_BOOK_IDS=|SINGLE_BOOK_ID=/.test(line)) forcedRun = true;
    const startedMatch = line.match(/Start book:\s*(\d+)\s*(.*)$/);
    if (startedMatch) {
      startedBooks.set(startedMatch[1], { bookId: startedMatch[1], bookName: startedMatch[2] });
      continue;
    }
    if (forcedRun || !/Recorded automatic book ID:|已记录自动书籍ID：/.test(line)) continue;
    const idMatch = line.match(/(\d+)\s*$/);
    const book = idMatch ? startedBooks.get(idMatch[1]) : null;
    if (book) completedKeys.add(statisticKey(book, duplicateBookTitleMode));
  }
  return completedKeys;
}

function getTerminalFailureBookIds(failures, maxAttempts = 3) {
  return new Set(
    (failures || [])
      .filter((failure) => failure && failure.bookId && Number(failure.attempts || 0) >= maxAttempts)
      .map((failure) => String(failure.bookId))
  );
}

function getTodayBookStatistics(dataDir, runLog, failures, todayText, duplicateBookTitleMode, maxFailureAttempts = 3) {
  const groups = new Map();
  for (const book of getTodayScanBooks(dataDir, todayText)) {
    const key = statisticKey(book, duplicateBookTitleMode);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(book);
  }

  const completedKeys = getTodayAutomaticProcessedKeys(dataDir, runLog, todayText, duplicateBookTitleMode);
  const terminalFailureIds = getTerminalFailureBookIds(failures, maxFailureAttempts);
  let completed = 0;
  let terminalFailed = 0;
  let pending = 0;
  for (const [key, books] of groups) {
    if (completedKeys.has(key)) {
      completed += 1;
    } else if (books.every((book) => terminalFailureIds.has(String(book.bookId)))) {
      terminalFailed += 1;
    } else {
      // This includes books cooling down before their next retry.
      pending += 1;
    }
  }
  return { total: groups.size, completed, pending, terminalFailed };
}

function countTodayProcessedBooks(runLog, todayText) {
  const datePrefix = `[${todayText} `;
  let forcedRun = false;
  const automatic = new Set();
  const manual = new Set();
  for (const line of String(runLog || "").split(/\r?\n/)) {
    if (!line.startsWith(datePrefix)) continue;
    if (/启动一次试跑|Starting one run/.test(line)) forcedRun = false;
    if (/MANUAL_BOOK_IDS=|SINGLE_BOOK_ID=/.test(line)) forcedRun = true;
    const idMatch = line.match(/(\d+)\s*$/);
    if (!idMatch) continue;
    if (/Recorded manual book ID:|已记录手动书籍ID：/.test(line)) {
      manual.add(idMatch[1]);
    } else if (/Recorded automatic book ID:|已记录自动书籍ID：/.test(line)) {
      automatic.add(idMatch[1]);
    } else if (/Recorded book ID:|已记录书籍ID：/.test(line)) {
      (forcedRun ? manual : automatic).add(idMatch[1]);
    }
  }
  return { automatic: automatic.size, manual: manual.size };
}

function getTodayDiscoveredBookIds(dataDir, runLog, todayText) {
  const ids = getTodayScanBookIds(dataDir, todayText);
  const automatic = getTodayAutomaticBookIds(runLog, todayText);
  for (const id of automatic.started) ids.add(id);
  for (const id of automatic.completed) ids.add(id);
  return ids;
}

function getAutomationStatus(rootDir, todayText = todayChinaText()) {
  const dataDir = path.join(rootDir, "data");
  const logsDir = path.join(rootDir, "logs");
  const seen = readJsonSafe(path.join(dataDir, "seen_books.json"), { bookIds: [] });
  const failed = readJsonSafe(path.join(dataDir, "failed_tasks.json"), { failures: [] });
  const config = readJsonSafe(path.join(rootDir, "config.json"), {});
  const runLog = tailText(path.join(logsDir, "run.log"), 20000);
  const scanMatch = Array.from(runLog.matchAll(/共读取到\s+(\d+)\s+个唯一书籍ID/g)).pop();
  const processed = countTodayProcessedBooks(runLog, todayText);
  const duplicateBookTitleMode = config.duplicateBookTitleMode === "without-number" ? "without-number" : "with-number";
  const maxFailureAttempts = Number(config.maxFailureAttempts || 3);
  const todayStatistics = getTodayBookStatistics(dataDir, runLog, failed.failures, todayText, duplicateBookTitleMode, maxFailureAttempts);
  return {
    seenCount: (seen.bookIds || []).length,
    failureCount: getTerminalFailureBookIds(failed.failures, maxFailureAttempts).size,
    lastScanBookCount: scanMatch ? Number(scanMatch[1]) : 0,
    lastNewBookCount: getLastPendingBookCount(runLog),
    todayNewBookCount: todayStatistics.total,
    todayPendingBookCount: todayStatistics.pending,
    todayProcessedBookCount: todayStatistics.total ? todayStatistics.completed : processed.automatic,
    todayDeduplicatedProcessedBookCount: todayStatistics.total
      ? todayStatistics.completed
      : getTodayDeduplicatedProcessedBookCount(dataDir, runLog, todayText),
    todayTerminalFailureBookCount: todayStatistics.terminalFailed,
    todayManualProcessedBookCount: processed.manual,
  };
}

module.exports = {
  countTodayNewBooks,
  countTodayProcessedBooks,
  ensurePortableLayout,
  getAutomationStatus,
  getTodayAutomaticBookIds,
  getTodayDeduplicatedProcessedBookCount,
  getTodayBookStatistics,
  getTodayDiscoveredBookIds,
  getTodayNewBookCount,
  getTodayScanBookIds,
  getCommandBlockReason,
  getCommandSpec,
  isAutoWatchdogArg,
  readJsonSafe,
  tailText,
  todayChinaText,
};
