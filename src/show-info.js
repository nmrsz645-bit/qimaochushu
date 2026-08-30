const fs = require("fs");
const https = require("https");
const path = require("path");
const { spawn } = require("child_process");
const { chromium } = require("playwright-core");
const { resolveAppRoot } = require("./desktop-paths");
const { loadConfig } = require("./runtime-config");
const { requireChromeExecutable } = require("./chrome-utils");
const rootDir = resolveAppRoot();
const config = loadConfig();
config.chromeExecutable = requireChromeExecutable(config.chromeExecutable);
const { nowChinaText } = require("./time-utils");
const {
  getFirstSheetId,
  getTenantAccessToken,
  readFeishuCredentials,
  request,
  resolveSpreadsheetTokenFromWikiLink,
} = require("./feishu-utils");

function readText(file) {
  if (!fs.existsSync(file)) throw new Error(`文件不存在：${file}`);
  return fs.readFileSync(file, "utf8").trim();
}

function httpHead(url) {
  return new Promise((resolve) => {
    const target = new URL(url);
    const req = https.request(
      {
        hostname: target.hostname,
        path: `${target.pathname}${target.search}`,
        method: "GET",
        timeout: 15000,
      },
      (res) => {
        res.resume();
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 500, status: res.statusCode });
      }
    );
    req.on("error", (error) => resolve({ ok: false, error: error.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, error: "timeout" });
    });
    req.end();
  });
}

async function checkLogin(url, kind) {
  const context = await chromium.launchPersistentContext(config.chromeProfileDir, {
    executablePath: config.chromeExecutable,
    headless: false,
    viewport: null,
    args: ["--start-maximized", "--no-first-run"],
  });
  try {
    const page = context.pages()[0] || await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3000);
    const body = await page.locator("body").innerText().catch(() => "");
    if (kind === "platform") {
      return !page.url().includes("/login") && /xinyu|七猫开放平台/.test(body);
    }
    return false;
  } finally {
    await context.close().catch(() => {});
  }
}

async function checkWechat(webhookText) {
  const match = webhookText.match(/key=([a-zA-Z0-9_-]+)/);
  if (!match) return { ok: false, detail: "没有找到 key=" };
  const key = match[1];
  const testFile = path.join(config.outputDir, "info-check.txt");
  fs.mkdirSync(config.outputDir, { recursive: true });
  fs.writeFileSync(testFile, `查看信息 ${nowChinaText()}`, "utf8");
  const uploadUrl = `https://qyapi.weixin.qq.com/cgi-bin/webhook/upload_media?key=${key}&type=file`;
  const raw = await new Promise((resolve, reject) => {
    const child = spawn("curl.exe", ["-s", "-F", `media=@${testFile};filename=info-check.txt;type=text/plain`, uploadUrl], {
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(stderr || String(code)));
      else resolve(stdout);
    });
  });
  const result = JSON.parse(raw);
  return { ok: result.errcode === 0, detail: result.errmsg || JSON.stringify(result) };
}

async function main() {
  const platformUrl = readText(config.platformLinkFile);
  const credentials = readFeishuCredentials(config.feishuApiFile);
  const tenantAccessToken = await getTenantAccessToken(credentials);
  const tableLink = readText(config.feishuTableLinkFile);
  const spreadsheetToken = await resolveSpreadsheetTokenFromWikiLink(tableLink, tenantAccessToken);
  const sheetId = await getFirstSheetId(spreadsheetToken, tenantAccessToken);
  const sheetInfo = await request(
    "GET",
    `https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/${spreadsheetToken}/sheets/query`,
    tenantAccessToken
  );
  const sheet = sheetInfo.data.sheets.find((item) => item.sheet_id === sheetId) || sheetInfo.data.sheets[0];
  const nodeToken = tableLink.match(/\/wiki\/([^?]+)/)?.[1];
  const nodeInfo = await request(
    "GET",
    `https://open.feishu.cn/open-apis/wiki/v2/spaces/get_node?token=${nodeToken}`,
    tenantAccessToken
  );

  const platformReachable = await httpHead(platformUrl);
  const platformLoggedIn = await checkLogin(platformUrl, "platform");
  const wechat = await checkWechat(readText(config.wechatWebhookFile));

  console.log("========== 查看信息 ==========");
  console.log(`飞书 App ID：${credentials.appId}`);
  console.log(`飞书表格名称：${nodeInfo.data.node.title}`);
  console.log(`飞书 spreadsheet_token：${spreadsheetToken}`);
  console.log(`飞书 sheet_id：${sheetId}`);
  console.log(`飞书工作表名称：${sheet.title}`);
  console.log(`平台链接：${platformUrl}`);
  console.log(`平台链接是否正常：${platformReachable.ok ? "正常" : "异常"}${platformReachable.status ? ` HTTP ${platformReachable.status}` : platformReachable.error ? ` ${platformReachable.error}` : ""}`);
  console.log(`出书平台是否登录：${platformLoggedIn ? "已登录" : "未登录或登录失效"}`);
  console.log("话题来源：本地识别，不再使用豆包");
  console.log(`企业微信接口是否正常：${wechat.ok ? "正常" : "异常"} ${wechat.detail}`);
  console.log("============================");
}

main().catch((error) => {
  console.error(`查看信息失败：${error.stack || error.message}`);
  process.exitCode = 1;
});
