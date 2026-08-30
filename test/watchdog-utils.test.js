const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { isAutomationStale, newestLogMtimeMs } = require("../src/watchdog-utils");

function testNewestLogMtimeUsesRunLogOnly() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-watchdog-log-"));
  const runLog = path.join(dir, "run.log");
  const watchLog = path.join(dir, "watch-hourly.log");
  fs.writeFileSync(runLog, "run", "utf8");
  fs.writeFileSync(watchLog, "watch", "utf8");
  const oldTime = new Date("2026-07-04T00:00:00Z");
  const newTime = new Date("2026-07-04T00:01:00Z");
  fs.utimesSync(runLog, oldTime, oldTime);
  fs.utimesSync(watchLog, newTime, newTime);
  assert.strictEqual(newestLogMtimeMs(dir), oldTime.getTime());
}

function testIsAutomationStaleRequiresCurrentTaskAndOldLogs() {
  const now = new Date("2026-07-04T01:00:00Z").getTime();
  assert.strictEqual(isAutomationStale({ currentTaskExists: false, newestLogMtime: now - 3600000, now, staleMs: 600000 }), false);
  assert.strictEqual(isAutomationStale({ currentTaskExists: true, newestLogMtime: now - 60000, now, staleMs: 600000 }), false);
  assert.strictEqual(isAutomationStale({ currentTaskExists: true, newestLogMtime: now - 700000, now, staleMs: 600000 }), true);
}

testNewestLogMtimeUsesRunLogOnly();
testIsAutomationStaleRequiresCurrentTaskAndOldLogs();
console.log("watchdog-utils tests passed");
