const fs = require("fs");
const path = require("path");
const { chromeProfileDirName, mergeWithDefaults } = require("./config-utils");

const rootDir = path.resolve(__dirname, "..");
const releaseDir = path.resolve(rootDir, "..", "对外版", "automation");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(from, to) {
  ensureDir(path.dirname(to));
  fs.copyFileSync(from, to);
}

function copyTextFileIfExists(from, to) {
  if (!from || !fs.existsSync(from)) return;
  ensureDir(path.dirname(to));
  fs.writeFileSync(to, fs.readFileSync(from, "utf8"), "utf8");
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  ensureDir(to);
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(source, target);
    else if (entry.isFile()) copyFile(source, target);
  }
}

function copyDirFiltered(from, to, shouldCopyFile) {
  if (!fs.existsSync(from)) return;
  ensureDir(to);
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) copyDirFiltered(source, target, shouldCopyFile);
    else if (entry.isFile() && shouldCopyFile(entry.name, source)) copyFile(source, target);
  }
}

function shouldCopyRuntimeDataFile(name) {
  return false;
}

function emptyDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  ensureDir(dir);
}

function readCurrentConfig() {
  return mergeWithDefaults(JSON.parse(fs.readFileSync(path.join(rootDir, "config.json"), "utf8")), rootDir);
}

function buildExternalConfig(currentConfig = {}) {
  return {
    platformLinkFile: "config\\平台链接.txt",
    chromeProfileDir: chromeProfileDirName,
    chromeExecutable: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    templateDir: "充值模板",
    wechatWebhookFile: "config\\企业微信接口.txt",
    doubaoLinkFile: "config\\豆包链接.txt",
    feishuApiFile: "config\\飞书api.txt",
    feishuTableLinkFile: "config\\出书完成表格.txt",
    forbiddenWordsFile: "违禁词.txt",
    dataDir: "data",
    logDir: "logs",
    outputDir: "outputs",
    failedDir: "failed",
    dryRun: false,
    keepBrowserOpen: false,
    sendChapterAfterPromotion: true,
    sendNovelToWechat: true,
    sendDoubaoAfterWechat: false,
    writeFeishuLabelAfterDoubao: false,
    doubaoReplyWaitMs: 60000,
    defaultCreateCount: "1",
    duplicateBookTitleMode: "with-number",
    scanPageCount: 10,
    chapterOneGenerateClick: { x: 1665, y: 426 },
    queryIntervalMs: 3600000,
    singleBookTimeoutMs: 300000,
    failureRetryDelayMs: 3600000,
    retentionHours: 72,
    deepseekApiKeyFile: "config\\DeepSeek\u63a5\u53e3.txt",
    deepseekApiBaseUrl: currentConfig.deepseekApiBaseUrl || "https://ws-qbczn48xwolhpy29.cn-beijing.maas.aliyuncs.com/api/v1",
    deepseekModel: currentConfig.deepseekModel && currentConfig.deepseekModel !== "deepseek-v4-flash"
      ? currentConfig.deepseekModel
      : "deepseek-v4-flash-0731",
    deepseekTimeoutMs: 45000,
    latestChapterTextFile: "小说可移动\\小说内容.txt",
    feishuCompletionFallback: true,
    doubaoReplyTimeoutMs: 180000,
    doubaoReplyPollMs: 3000,
    maxFailureAttempts: 3,
  };
}

function buildStartManagerBat() {
  return [
    "@echo off",
    "chcp 65001 >nul",
    "cd /d \"%~dp0\"",
    "start \"\" \"%~dp0qimao-manager.exe\"",
    "",
  ].join("\r\n");
}

function buildNodeModeBat(_label, scriptName) {
  const logName = scriptName.replace(/\.js$/i, ".log");
  return [
    "@echo off",
    "chcp 65001 >nul",
    "cd /d \"%~dp0\"",
    "if not exist \"%~dp0logs\" mkdir \"%~dp0logs\"",
    "set \"QIMAO_APP_ROOT=%~dp0\"",
    "set \"ELECTRON_RUN_AS_NODE=1\"",
    "set \"QIMAO_LOG=%~dp0logs\\" + logName + "\"",
    "\"%~dp0qimao-manager.exe\" \"%~dp0resources\\app.asar\\src\\" + scriptName + "\" > \"%QIMAO_LOG%\" 2>&1",
    "set \"QIMAO_EXIT=%ERRORLEVEL%\"",
    "type \"%QIMAO_LOG%\"",
    "echo.",
    "echo Exit code: %QIMAO_EXIT%",
    "pause",
    "exit /b %QIMAO_EXIT%",
    "",
  ].join("\r\n");
}

function buildScriptBatMap() {
  return {
    "一键自检.bat": "self-check.js",
    "打开登录页面.bat": "open-login.js",
    "查看信息.bat": "show-info.js",
    "重建基准.bat": "rebuild-baseline.js",
    "运行一次.bat": "run-once.js",
    "一键出完今日书.bat": "run-today.js",
    "每小时运行.bat": "watch-hourly.js",
    "每小时监控.bat": "watch-hourly.js",
    "一键守护监控.bat": "watchdog.js",
    "一键防睡眠.bat": "prevent-sleep.js",
    "一键停止程序.bat": "stop-all.js",
  };
}

function writeBatFiles(targetDir) {
  const scripts = buildScriptBatMap();
  fs.writeFileSync(path.join(targetDir, "启动桌面管理器.bat"), buildStartManagerBat(), "utf8");
  for (const [name, script] of Object.entries(scripts)) {
    fs.writeFileSync(path.join(targetDir, name), buildNodeModeBat(name, script), "utf8");
  }
}

function writeReleaseReadme(targetDir) {
  const text = [
    "七猫出书管理器 - 对外版",
    "",
    "使用：",
    "1. 把整个 automation 文件夹复制到目标电脑任意位置。",
    "2. 目标电脑需要安装 Google Chrome。",
    "3. 双击 启动桌面管理器.bat 或 七猫出书管理器.exe。",
    "4. 点击 打开登录页面，登录出书平台。",
    "5. 点击 一键自检，确认企业微信、飞书、平台链接正常。",
    "6. 点击 重建基准，再开始 7*24 监控。",
    "",
    "说明：",
    "- 本对外版不需要目标电脑安装 Node.js。",
    "- config、data、logs、outputs、充值模板、小说可移动、七猫出书 都跟随本文件夹。",
    "- logs 已清空，后续日志默认只保留 72 小时。",
  ].join("\r\n");
  fs.writeFileSync(path.join(targetDir, "对外版使用说明.txt"), text, "utf8");
}

function copyRuntimeApp(targetDir) {
  const packedDir = path.join(rootDir, "release", "win-unpacked");
  const exe = path.join(packedDir, "七猫出书管理器.exe");
  if (!fs.existsSync(exe)) {
    throw new Error("没有找到桌面打包程序，请先运行 npm.cmd run pack-desktop");
  }
  copyDir(packedDir, targetDir);
}

function writeDesktopReadme(targetDir) {
  const text = [
    "七猫出书管理器 - Windows 桌面版",
    "",
    "使用方法：",
    "1. 目标电脑安装 Google Chrome。",
    "2. 双击 七猫出书管理器.exe 进入管理界面。",
    "3. 在软件内点击 打开登录页面，完成平台登录。",
    "4. 在软件内完成自检、重建基准和开始7*24监控。",
    "",
    "说明：",
    "- 不需要安装 Python 或 Node.js。",
    "- 软件后台任务不会打开命令提示符窗口。",
    "- 配置、数据、日志、模板和小说内容都跟随软件文件夹保存。",
  ].join("\r\n");
  fs.writeFileSync(path.join(targetDir, "使用说明.txt"), text, "utf8");
  fs.writeFileSync(path.join(targetDir, "对外版使用说明.txt"), text, "utf8");
}

function copyCurrentRuntimeData(targetDir, currentConfig) {
  copyDir(path.join(rootDir, "desktop"), path.join(targetDir, "desktop"));
  copyDir(path.join(rootDir, "src"), path.join(targetDir, "src"));
  copyDir(path.join(rootDir, "test"), path.join(targetDir, "test"));
  for (const name of ["package.json", "package-lock.json", "使用说明.txt"]) {
    const source = path.join(rootDir, name);
    if (fs.existsSync(source)) copyFile(source, path.join(targetDir, name));
  }

  copyDir(currentConfig.templateDir || path.join(rootDir, "充值模板"), path.join(targetDir, "充值模板"));
  emptyDir(path.join(targetDir, chromeProfileDirName));
  emptyDir(path.join(targetDir, "data"));
  emptyDir(path.join(targetDir, "logs"));
  emptyDir(path.join(targetDir, "outputs"));
  emptyDir(path.join(targetDir, "failed"));
  emptyDir(path.join(targetDir, "小说可移动"));

  const configDir = path.join(targetDir, "config");
  ensureDir(configDir);
  copyTextFileIfExists(currentConfig.deepseekApiKeyFile, path.join(configDir, "DeepSeek\u63a5\u53e3.txt"));
  copyTextFileIfExists(currentConfig.platformLinkFile, path.join(configDir, "平台链接.txt"));
  copyTextFileIfExists(currentConfig.wechatWebhookFile, path.join(configDir, "企业微信接口.txt"));
  copyTextFileIfExists(currentConfig.feishuApiFile, path.join(configDir, "飞书api.txt"));
  copyTextFileIfExists(currentConfig.feishuTableLinkFile, path.join(configDir, "出书完成表格.txt"));
  copyTextFileIfExists(currentConfig.doubaoLinkFile, path.join(configDir, "豆包链接.txt"));
  copyTextFileIfExists(currentConfig.forbiddenWordsFile, path.join(targetDir, "违禁词.txt"));
}

function main() {
  const currentConfig = readCurrentConfig();
  fs.rmSync(releaseDir, { recursive: true, force: true });
  ensureDir(releaseDir);
  copyRuntimeApp(releaseDir);
  copyCurrentRuntimeData(releaseDir, currentConfig);
  for (const name of ["desktop", "src", "test", "package.json", "package-lock.json", "启动桌面管理器.bat"]) {
    fs.rmSync(path.join(releaseDir, name), { recursive: true, force: true });
  }
  fs.writeFileSync(path.join(releaseDir, "config.json"), `${JSON.stringify(buildExternalConfig(currentConfig), null, 2)}\n`, "utf8");
  writeReleaseReadme(releaseDir);
  writeDesktopReadme(releaseDir);
  console.log(`对外版已生成：${releaseDir}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildExternalConfig,
  buildNodeModeBat,
  buildScriptBatMap,
  buildStartManagerBat,
  main,
  shouldCopyRuntimeDataFile,
};
