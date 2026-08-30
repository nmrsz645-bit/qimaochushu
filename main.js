const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const {
  ensurePortableLayout,
  getAutomationStatus,
  getCommandBlockReason,
  getCommandSpec,
  isAutoWatchdogArg,
  readJsonSafe,
  tailText,
} = require("../src/desktop-service");
const { applyDirectoryConfig, mergeWithDefaults } = require("../src/config-utils");
const { isProcessRunning } = require("../src/process-lock");

const rootDir = app.isPackaged ? path.dirname(process.execPath) : path.resolve(__dirname, "..");
const scriptRootDir = app.isPackaged ? path.join(process.resourcesPath, "app.asar") : rootDir;
const startupArgs = ["--auto-watchdog"];
ensurePortableLayout(rootDir);
const running = new Map();

function getDeepSeekApiKeyFile() {
  const config = mergeWithDefaults(readJsonSafe(path.join(rootDir, "config.json"), {}), rootDir);
  return config.deepseekApiKeyFile;
}

function readTextFile(file) {
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch {
    return "";
  }
}

function writeTextFile(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${String(value || "").trim()}\n`, "utf8");
}

function getConfigInputFiles() {
  const config = mergeWithDefaults(readJsonSafe(path.join(rootDir, "config.json"), {}), rootDir);
  return {
    platformLink: config.platformLinkFile,
    wechatWebhook: config.wechatWebhookFile,
    feishuApi: config.feishuApiFile,
    feishuTableLink: config.feishuTableLinkFile,
    forbiddenWords: config.forbiddenWordsFile,
    deepseekApiKey: config.deepseekApiKeyFile,
  };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 980,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

function runCommand(name) {
  const blockReason = getCommandBlockReason(name, Array.from(running.keys()));
  if (blockReason) throw new Error(blockReason);
  const spec = getCommandSpec(rootDir, name, scriptRootDir);
  const child = spawn(spec.command, spec.args, { cwd: spec.cwd, env: spec.env, windowsHide: true });
  running.set(name, child);
  child.on("exit", () => running.delete(name));
  return { started: true, pid: child.pid };
}

function runCommandAndCollect(name, extraEnv = {}) {
  const blockReason = getCommandBlockReason(name, Array.from(running.keys()));
  if (blockReason) return Promise.reject(new Error(blockReason));
  const spec = getCommandSpec(rootDir, name, scriptRootDir);
  spec.env = { ...spec.env, ...extraEnv };
  return new Promise((resolve, reject) => {
    const child = spawn(spec.command, spec.args, { cwd: spec.cwd, env: spec.env, windowsHide: true });
    running.set(name, child);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      running.delete(name);
      resolve({ finished: true, code, ok: code === 0, output: [stdout.trim(), stderr.trim()].filter(Boolean).join("\n") });
    });
  });
}

function isActiveLockedProcess(file) {
  const lock = readJsonSafe(file, {});
  return isProcessRunning(Number(lock.pid || 0));
}

function waitForCurrentBookToFinish(timeoutMs = 6 * 60 * 1000) {
  const lockFile = path.join(rootDir, "data", "run-once.lock");
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (!isActiveLockedProcess(lockFile)) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(timer);
        reject(new Error("当前任务超过 6 分钟仍未结束，已恢复监控，请稍后再处理单本书。"));
      }
    }, 1000);
  });
}

async function runManualBooks(query) {
  const value = String(query || "").trim();
  if (!value) throw new Error("请输入书籍ID。");
  const dataDir = path.join(rootDir, "data");
  const watchWasRunning = isActiveLockedProcess(path.join(dataDir, "watch-hourly.lock"));
  try {
    if (watchWasRunning) {
      await runCommandAndCollect("stop-all", { QIMAO_STOP_MONITORS_ONLY: "1", QIMAO_KEEP_WATCHDOG: "1" });
      running.delete("watch-hourly");
      await waitForCurrentBookToFinish();
    }
    return await runCommandAndCollect("run-once", { MANUAL_BOOK_IDS: value });
  } finally {
    if (watchWasRunning) runCommand("watch-hourly");
  }
}

function getStartupEnabled() {
  return app.getLoginItemSettings({ path: process.execPath, args: startupArgs }).openAtLogin;
}

function setStartupEnabled(enabled) {
  app.setLoginItemSettings({
    openAtLogin: Boolean(enabled),
    path: process.execPath,
    args: startupArgs,
  });
  return { ok: true, enabled: getStartupEnabled() };
}

ipcMain.handle("status:get", () => ({
  ...getAutomationStatus(rootDir),
  running: Array.from(running.keys()),
  startupEnabled: getStartupEnabled(),
}));

ipcMain.handle("logs:get", () => ({
  run: tailText(path.join(rootDir, "logs", "run.log"), 300),
  watch: tailText(path.join(rootDir, "logs", "watch-hourly.log"), 300),
  watchdog: tailText(path.join(rootDir, "logs", "watchdog.log"), 300),
}));

ipcMain.handle("failures:get", () => readJsonSafe(path.join(rootDir, "data", "failed_tasks.json"), { failures: [] }).failures || []);
ipcMain.handle("config:get", () => readJsonSafe(path.join(rootDir, "config.json"), {}));
ipcMain.handle("config:save", (_event, config) => {
  fs.writeFileSync(path.join(rootDir, "config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return { ok: true };
});
ipcMain.handle("config-inputs:get", () => {
  const files = getConfigInputFiles();
  return Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readTextFile(file)]));
});
ipcMain.handle("config-inputs:save", (_event, values) => {
  const files = getConfigInputFiles();
  for (const [key, file] of Object.entries(files)) writeTextFile(file, values && values[key]);
  return { ok: true };
});
ipcMain.handle("deepseek-key:get", () => {
  try {
    return fs.readFileSync(getDeepSeekApiKeyFile(), "utf8").trim();
  } catch {
    return "";
  }
});
ipcMain.handle("deepseek-key:save", (_event, value) => {
  const keyFile = getDeepSeekApiKeyFile();
  fs.mkdirSync(path.dirname(keyFile), { recursive: true });
  fs.writeFileSync(keyFile, String(value || "").trim(), "utf8");
  return { ok: true };
});
ipcMain.handle("config:apply-directories", (_event, config, dirs) => applyDirectoryConfig(config, dirs));
ipcMain.handle("dialog:select-directory", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  return result.canceled ? "" : result.filePaths[0];
});
ipcMain.handle("command:run", (_event, name) => {
  if (name === "watch-hourly" || name === "watchdog" || name === "run-once") return runCommand(name);
  return runCommandAndCollect(name);
});
ipcMain.handle("books:process-batch", (_event, query) => runManualBooks(query));
ipcMain.handle("book:process-single", (_event, query) => runManualBooks(query));
ipcMain.handle("startup:set", (_event, enabled) => setStartupEnabled(enabled));
ipcMain.handle("folder:open", (_event, name) => {
  const folders = {
    logs: path.join(rootDir, "logs"),
    novel: path.join(rootDir, "小说可移动"),
    root: rootDir,
  };
  const folder = folders[name] || rootDir;
  fs.mkdirSync(folder, { recursive: true });
  shell.openPath(folder);
  return { ok: true };
});

app.whenReady().then(() => {
  createWindow();
  if (isAutoWatchdogArg(process.argv)) {
    setTimeout(() => {
      try {
        runCommand("watchdog");
      } catch {
        // Already running or blocked; the UI status will show the current state.
      }
    }, 1000);
  }
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
