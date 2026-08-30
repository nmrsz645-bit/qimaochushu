const { spawn } = require("child_process");
const path = require("path");
const { resolveAppRoot } = require("./desktop-paths");

const rootDir = resolveAppRoot();

function runScript(scriptName, extraEnv = {}, detached = false) {
  const child = spawn(process.execPath, [path.join(__dirname, scriptName)], {
    cwd: rootDir,
    env: { ...process.env, QIMAO_APP_ROOT: rootDir, ...extraEnv },
    stdio: detached ? "ignore" : "inherit",
    detached,
    windowsHide: true,
  });
  if (detached) child.unref();
  return child;
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => resolve(code || 0));
  });
}

async function main() {
  const code = await waitForExit(runScript("run-once.js", { QIMAO_PROCESS_ALL_SCANNED: "1" }));
  console.log(`一键出完今日书结束，退出码：${code}`);
  console.log("自动启动守护 7*24 监控。");
  runScript("watchdog.js", {}, true);
  process.exitCode = code;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
