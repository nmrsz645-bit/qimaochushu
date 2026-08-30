const { execFile, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { resolveAppRoot } = require("./desktop-paths");
const { loadConfig } = require("./runtime-config");
const { acquireProcessLock } = require("./process-lock");
const { createWatchLogger, getNextRunDelayMs, isRunStalled, pipeChildOutputToWatchLog } = require("./watch-hourly-utils");
const rootDir = resolveAppRoot();
const config = loadConfig();

const releaseLock = acquireProcessLock(path.join(config.dataDir, "watch-hourly.lock"), "watch-hourly");
const log = createWatchLogger(config.logDir);
let running = false;
let lastRunStartedAt = "";
let lastRunStartedMs = 0;
let activeChild = null;
let stoppingChild = false;
let nextTimer = null;

function runOnce() {
  if (running) {
    log(`上一次还没结束，本轮跳过。lastRunStartedAt=${lastRunStartedAt}`);
    scheduleNextRun(config.queryIntervalMs);
    return;
  }
  running = true;
  lastRunStartedAt = new Date().toISOString();
  lastRunStartedMs = Date.now();
  log(`启动 run-once。pid=pending root=${rootDir}`);
  const child = spawn(process.execPath, [path.join(__dirname, "run-once.js")], {
    stdio: ["ignore", "pipe", "pipe"],
    cwd: rootDir,
    env: { ...process.env, QIMAO_APP_ROOT: rootDir },
  });
  activeChild = child;
  log(`run-once 已启动。pid=${child.pid}`);
  pipeChildOutputToWatchLog(child, log);
  child.on("exit", (code) => {
    const wasStopping = stoppingChild;
    log(`run-once exited with code ${code}`);
    running = false;
    activeChild = null;
    stoppingChild = false;
    const delayMs = getNextRunDelayMs(wasStopping ? 1 : code, config.queryIntervalMs);
    log(`下一次检测将在 ${Math.round(delayMs / 1000)} 秒后启动。`);
    scheduleNextRun(delayMs);
  });
  child.on("error", (error) => {
    log(`run-once 启动失败：${error.message}`);
    running = false;
    scheduleNextRun(60 * 1000);
  });
}

function stopStalledChild() {
  if (!activeChild || !activeChild.pid || stoppingChild) return;
  stoppingChild = true;
  log(`run-once 超过 ${Math.round((config.watchdogStaleMs || 10 * 60 * 1000) / 60000)} 分钟无进展，结束后重试。pid=${activeChild.pid}`);
  execFile("taskkill.exe", ["/pid", String(activeChild.pid), "/t", "/f"], () => {});
}

function scheduleNextRun(delayMs) {
  if (nextTimer) clearTimeout(nextTimer);
  nextTimer = setTimeout(runOnce, delayMs);
}

log(`监控启动。intervalMs=${config.queryIntervalMs}`);
runOnce();
setInterval(() => {
  log(`监控心跳。running=${running ? "yes" : "no"}${running ? ` lastRunStartedAt=${lastRunStartedAt}` : ""}`);
}, 60000);
setInterval(() => {
  const staleMs = Number(config.watchdogStaleMs || 10 * 60 * 1000);
  const runLog = path.join(config.logDir, "run.log");
  const runLogMtime = fs.existsSync(runLog) ? fs.statSync(runLog).mtimeMs : 0;
  if (isRunStalled({ running, startedAt: lastRunStartedMs, runLogMtime, staleMs })) stopStalledChild();
}, 60000);
process.on("exit", releaseLock);
process.on("SIGINT", () => {
  log("收到 SIGINT，监控退出。");
  releaseLock();
  process.exit(0);
});
process.on("SIGTERM", () => {
  log("收到 SIGTERM，监控退出。");
  releaseLock();
  process.exit(0);
});
