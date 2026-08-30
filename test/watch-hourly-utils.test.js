const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { EventEmitter } = require("events");

const { createWatchLogger, getNextRunDelayMs, isRunStalled, pipeChildOutputToWatchLog } = require("../src/watch-hourly-utils");

function testCreateWatchLoggerWritesTimestampedLines() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-watch-log-"));
  const log = createWatchLogger(dir, () => "2026-07-04 01:02:03");
  log("监控启动");
  const text = fs.readFileSync(path.join(dir, "watch-hourly.log"), "utf8");
  assert.strictEqual(text, "[2026-07-04 01:02:03] 监控启动\n");
}

function testCreateWatchLoggerCanWriteCustomFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-watch-custom-log-"));
  const log = createWatchLogger(dir, () => "2026-07-04 01:02:03", "watchdog.log");
  log("守护启动");
  assert.strictEqual(fs.existsSync(path.join(dir, "watch-hourly.log")), false);
  assert.strictEqual(fs.readFileSync(path.join(dir, "watchdog.log"), "utf8"), "[2026-07-04 01:02:03] 守护启动\n");
}

function testPipeChildOutputToWatchLog() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-watch-pipe-"));
  const log = createWatchLogger(dir, () => "2026-07-04 01:02:03");
  const child = {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
  };
  pipeChildOutputToWatchLog(child, log);
  child.stdout.emit("data", Buffer.from("stdout line\n"));
  child.stderr.emit("data", Buffer.from("stderr line\n"));
  const text = fs.readFileSync(path.join(dir, "watch-hourly.log"), "utf8");
  assert(text.includes("[run-once stdout] stdout line"));
  assert(text.includes("[run-once stderr] stderr line"));
}

function testGetNextRunDelayRetriesFailedRunsSoon() {
  assert.strictEqual(getNextRunDelayMs(0, 3600000, 60000), 3600000);
  assert.strictEqual(getNextRunDelayMs(1, 3600000, 60000), 60000);
}

function testIsRunStalledRequiresAnOldRunAndOldProgress() {
  const now = 1000000;
  assert.strictEqual(isRunStalled({ running: true, startedAt: now - 300000, runLogMtime: now - 300000, now, staleMs: 600000 }), false);
  assert.strictEqual(isRunStalled({ running: true, startedAt: now - 700000, runLogMtime: now - 700000, now, staleMs: 600000 }), true);
  assert.strictEqual(isRunStalled({ running: false, startedAt: now - 700000, runLogMtime: now - 700000, now, staleMs: 600000 }), false);
}

testCreateWatchLoggerWritesTimestampedLines();
testCreateWatchLoggerCanWriteCustomFile();
testPipeChildOutputToWatchLog();
testGetNextRunDelayRetriesFailedRunsSoon();
testIsRunStalledRequiresAnOldRunAndOldProgress();
console.log("watch-hourly-utils tests passed");
