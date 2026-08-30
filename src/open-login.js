const fs = require("fs");
const { spawn } = require("child_process");
const { resolveAppRoot } = require("./desktop-paths");
const { loadConfig } = require("./runtime-config");
const { requireChromeExecutable } = require("./chrome-utils");
const rootDir = resolveAppRoot();
const config = loadConfig();
config.chromeExecutable = requireChromeExecutable(config.chromeExecutable);

function readPlatformUrl() {
  const value = fs.readFileSync(config.platformLinkFile, "utf8").trim();
  if (!value) throw new Error(`Platform link is empty: ${config.platformLinkFile}`);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Platform link is invalid: ${config.platformLinkFile}`);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`Platform link must start with http or https: ${config.platformLinkFile}`);
  }
  return url.toString();
}

function main() {
  const platformUrl = readPlatformUrl();
  fs.mkdirSync(config.chromeProfileDir, { recursive: true });
  const args = [
    `--user-data-dir=${config.chromeProfileDir}`,
    "--no-first-run",
    "--start-maximized",
    "--new-window",
    platformUrl,
  ];
  const child = spawn(config.chromeExecutable, args, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  console.log(`已读取平台链接：${platformUrl}`);
  console.log("已打开登录页面。请在弹出的 Chrome 中登录平台。");
}

main();
