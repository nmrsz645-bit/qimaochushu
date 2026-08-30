const { execFileSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { resolveAppRoot } = require("./desktop-paths");
const { loadConfig } = require("./runtime-config");
const { acquireProcessLock } = require("./process-lock");
const { createWatchLogger } = require("./watch-hourly-utils");
const { isAutomationStale, newestLogMtimeMs } = require("./watchdog-utils");

const rootDir = resolveAppRoot();
const config = loadConfig();
const releaseLock = acquireProcessLock(path.join(config.dataDir, "watchdog.lock"), "watchdog");
const log = createWatchLogger(config.logDir, undefined, "watchdog.log");
const checkIntervalMs = Number(config.watchdogCheckIntervalMs || 60 * 1000);
const staleMs = Number(config.watchdogStaleMs || 10 * 60 * 1000);
const maxRestarts = Number(config.watchdogMaxRestarts || 3);
const packedProcessNames = Array.from(new Set(["qimao-manager.exe", path.basename(process.execPath)]));
let restartCount = 0;
let lastProgressMtime = 0;

function runPowerShell(script) {
  return execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function stopProcesses(name, commandLinePattern) {
  const escapedPattern = commandLinePattern.replace(/'/g, "''");
  const script = `
$items = Get-CimInstance Win32_Process -Filter "name = '${name}'" |
  Where-Object { $_.CommandLine -like '*${escapedPattern}*' -and $_.ProcessId -ne ${process.pid} }
$items | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  [PSCustomObject]@{ Name = $_.Name; ProcessId = $_.ProcessId }
} | ConvertTo-Json -Compress
`;
  const text = runPowerShell(script).trim();
  if (!text) return [];
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : [parsed];
}

function stopPackedProcesses(commandLinePattern) {
  return packedProcessNames.flatMap((name) => stopProcesses(name, commandLinePattern));
}

function startWatchHourly() {
  const child = spawn(process.execPath, [path.join(__dirname, "watch-hourly.js")], {
    cwd: rootDir,
    env: { ...process.env, QIMAO_APP_ROOT: rootDir },
    stdio: "ignore",
    detached: true,
    windowsHide: true,
  });
  child.unref();
  log(`守护进程已启动 7*24 监控。pid=${child.pid}`);
}

function restartAutomation(reason) {
  restartCount += 1;
  log(`守护进程检测到卡住：${reason}，准备重启。次数=${restartCount}/${maxRestarts}`);
  const stopped = [
    ...stopProcesses("node.exe", "watch-hourly.js"),
    ...stopProcesses("node.exe", "run-once.js"),
    ...stopPackedProcesses("watch-hourly.js"),
    ...stopPackedProcesses("run-once.js"),
    ...stopProcesses("chrome.exe", config.chromeProfileDir),
  ];
  for (const file of ["run-once.lock", "watch-hourly.lock"]) {
    fs.rmSync(path.join(config.dataDir, file), { force: true });
  }
  log(`守护进程已停止旧进程：${stopped.length} 个。`);
  startWatchHourly();
}

function checkOnce() {
  const currentTaskFile = path.join(config.dataDir, "current_task.json");
  const currentTaskExists = fs.existsSync(currentTaskFile);
  const newest = newestLogMtimeMs(config.logDir);
  if (newest > lastProgressMtime) {
    if (restartCount) log(`检测到实际出书进度，重启计数已重置：${restartCount} -> 0`);
    restartCount = 0;
    lastProgressMtime = newest;
  }
  if (!isAutomationStale({ currentTaskExists, newestLogMtime: newest, staleMs })) {
    log(`守护心跳。currentTask=${currentTaskExists ? "yes" : "no"} newestLogAgeMs=${newest ? Date.now() - newest : 0}`);
    return;
  }
  if (restartCount >= maxRestarts) {
    log(`守护进程连续重启达到 ${maxRestarts} 次，继续按间隔恢复。`);
    restartCount = 0;
  }
  restartAutomation(`日志超过 ${Math.round(staleMs / 60000)} 分钟未更新`);
}

function main() {
  log(`守护进程启动。checkIntervalMs=${checkIntervalMs} staleMs=${staleMs}`);
  startWatchHourly();
  checkOnce();
  setInterval(checkOnce, checkIntervalMs);
}

process.on("exit", releaseLock);
process.on("SIGINT", () => {
  log("收到 SIGINT，守护进程退出。");
  releaseLock();
  process.exit(0);
});
process.on("SIGTERM", () => {
  log("收到 SIGTERM，守护进程退出。");
  releaseLock();
  process.exit(0);
});

main();
