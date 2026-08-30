const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { cleanupOldFiles, isDisposableDataFile } = require("../src/cleanup-utils");

function touchOld(file, daysAgo) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "x", "utf8");
  const time = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  fs.utimesSync(file, time, time);
}

function touchOldHours(file, hoursAgo) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "x", "utf8");
  const time = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  fs.utimesSync(file, time, time);
}

function testDisposableDataFileRules() {
  assert.strictEqual(isDisposableDataFile("failed_tasks.interrupted-run-1.json"), true);
  assert.strictEqual(isDisposableDataFile("seen_books.before-single-full-1.json"), true);
  assert.strictEqual(isDisposableDataFile("single_full_run_target.json"), true);
  assert.strictEqual(isDisposableDataFile("seen_books.json"), false);
  assert.strictEqual(isDisposableDataFile("failed_tasks.json"), false);
}

function testCleanupKeepsRecentAndStateFiles() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-clean-"));
  const config = {
    logDir: path.join(root, "logs"),
    outputDir: path.join(root, "outputs"),
    dataDir: path.join(root, "data"),
    retentionDays: 3,
  };
  const oldLog = path.join(config.logDir, "old.log");
  const recentLog = path.join(config.logDir, "recent.log");
  const oldOutput = path.join(config.outputDir, "old.txt");
  const oldBackup = path.join(config.dataDir, "failed_tasks.interrupted-run-old.json");
  const state = path.join(config.dataDir, "seen_books.json");
  touchOld(oldLog, 4);
  touchOld(recentLog, 1);
  touchOld(oldOutput, 4);
  touchOld(oldBackup, 4);
  touchOld(state, 10);

  const result = cleanupOldFiles(config);

  assert.ok(result.removed.includes(oldLog));
  assert.ok(result.removed.includes(oldOutput));
  assert.ok(result.removed.includes(oldBackup));
  assert.strictEqual(fs.existsSync(oldLog), false);
  assert.strictEqual(fs.existsSync(oldOutput), false);
  assert.strictEqual(fs.existsSync(oldBackup), false);
  assert.strictEqual(fs.existsSync(recentLog), true);
  assert.strictEqual(fs.existsSync(state), true);
}

function testCleanupUsesRetentionHours() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-clean-hours-"));
  const config = {
    logDir: path.join(root, "logs"),
    outputDir: path.join(root, "outputs"),
    dataDir: path.join(root, "data"),
    retentionHours: 72,
  };
  const oldLog = path.join(config.logDir, "old.log");
  const recentLog = path.join(config.logDir, "recent.log");
  touchOldHours(oldLog, 73);
  touchOldHours(recentLog, 71);

  const result = cleanupOldFiles(config);

  assert.strictEqual(result.retentionHours, 72);
  assert.strictEqual(fs.existsSync(oldLog), false);
  assert.strictEqual(fs.existsSync(recentLog), true);
}

testDisposableDataFileRules();
testCleanupKeepsRecentAndStateFiles();
testCleanupUsesRetentionHours();
console.log("cleanup-utils tests passed");
