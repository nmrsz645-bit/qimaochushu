const { execFileSync } = require("child_process");
const path = require("path");
const { resolveAppRoot } = require("./desktop-paths");
const { loadConfig } = require("./runtime-config");

const rootDir = resolveAppRoot();
const config = loadConfig();
const monitorsOnly = process.env.QIMAO_STOP_MONITORS_ONLY === "1";
const keepWatchdog = process.env.QIMAO_KEEP_WATCHDOG === "1";
const packedProcessNames = Array.from(new Set(["qimao-manager.exe", path.basename(process.execPath)]));

function runPowerShell(script) {
  return execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function stopProcesses(name, commandLinePattern, excludePid) {
  const escapedPattern = commandLinePattern.replace(/'/g, "''");
  const script = `
$items = Get-CimInstance Win32_Process -Filter "name = '${name}'" |
  Where-Object { $_.CommandLine -like '*${escapedPattern}*' -and $_.ProcessId -ne ${excludePid} }
$items | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  [PSCustomObject]@{ Name = $_.Name; ProcessId = $_.ProcessId; CommandLine = $_.CommandLine }
} | ConvertTo-Json -Compress
`;
  const text = runPowerShell(script).trim();
  if (!text) return [];
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : [parsed];
}

function stopPackedProcesses(commandLinePattern) {
  return packedProcessNames.flatMap((name) => stopProcesses(name, commandLinePattern, process.pid));
}

function main() {
  const stoppedWatch = stopProcesses("node.exe", "watch-hourly.js", process.pid);
  const stoppedWatchdog = keepWatchdog ? [] : stopProcesses("node.exe", "watchdog.js", process.pid);
  const stoppedPackedWatch = stopPackedProcesses("watch-hourly.js");
  const stoppedPackedWatchdog = keepWatchdog ? [] : stopPackedProcesses("watchdog.js");
  const stoppedRunOnce = monitorsOnly ? [] : stopProcesses("node.exe", "run-once.js", process.pid);
  const stoppedPackedRunOnce = monitorsOnly ? [] : stopPackedProcesses("run-once.js");
  const stoppedNodeByDir = monitorsOnly ? [] : stopProcesses("node.exe", rootDir, process.pid);
  const stoppedChrome = monitorsOnly ? [] : stopProcesses("chrome.exe", config.chromeProfileDir, process.pid);
  const stoppedNode = [...stoppedNodeByDir, ...stoppedWatch, ...stoppedWatchdog, ...stoppedRunOnce, ...stoppedPackedWatch, ...stoppedPackedWatchdog, ...stoppedPackedRunOnce].filter(
    (item, index, list) => list.findIndex((other) => other.ProcessId === item.ProcessId) === index
  );

  console.log(`已停止自动化 Node 进程：${stoppedNode.length} 个`);
  console.log(`已停止专属 Chrome 进程：${stoppedChrome.length} 个`);
  if (!stoppedNode.length && !stoppedChrome.length) {
    console.log("当前没有发现正在运行的七猫自动化程序。");
  }
}

main();
