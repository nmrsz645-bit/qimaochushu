const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");
const { resolveAppRoot } = require("./desktop-paths");
const rootDir = resolveAppRoot();
const configPath = path.join(rootDir, "config.json");
const { loadConfig } = require("./runtime-config");
const { requireChromeExecutable } = require("./chrome-utils");
const { nowChinaText } = require("./time-utils");
const { sendWechatFile } = require("./workflow-utils");
const { writeLabelToFirstEmptyFeishuRow } = require("./feishu-utils");
const { readDeepSeekApiKey, requestDeepSeekTopicLabel } = require("./deepseek-topic-utils");

const config = loadConfig();

function line(ok, name, detail = "") {
  const mark = ok ? "通过" : "失败";
  console.log(`[${mark}] ${name}${detail ? `：${detail}` : ""}`);
}

function assertFile(file, name) {
  if (!fs.existsSync(file)) throw new Error(`${name}不存在：${file}`);
  return fs.readFileSync(file, "utf8").trim();
}

async function checkPageOpen(url, name) {
  const context = await chromium.launchPersistentContext(config.chromeProfileDir, {
    executablePath: config.chromeExecutable,
    headless: false,
    viewport: null,
    args: ["--start-maximized", "--no-first-run"],
  });
  try {
    const page = context.pages()[0] || await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    line(true, name, page.url());
  } finally {
    await context.close().catch(() => {});
  }
}

async function main() {
  const deepseekApiKey = readDeepSeekApiKey(config.deepseekApiKeyFile);
  if (!deepseekApiKey) throw new Error("DeepSeek API key file is missing or empty");
  await requestDeepSeekTopicLabel("自检", "林澈在婚宴揭穿骗局", {
    apiKey: deepseekApiKey,
    baseUrl: config.deepseekApiBaseUrl,
    model: config.deepseekModel,
    timeoutMs: config.deepseekTimeoutMs,
  });
  line(true, "阿里云 DeepSeek 接口", `${config.deepseekModel} ${config.deepseekApiBaseUrl}`);

  config.chromeExecutable = requireChromeExecutable(config.chromeExecutable);
  line(true, "配置解析", configPath);

  const platformUrl = assertFile(config.platformLinkFile, "平台链接");
  line(true, "平台链接文件", platformUrl);

  line(true, "Chrome 路径", config.chromeExecutable);

  fs.mkdirSync(config.chromeProfileDir, { recursive: true });
  line(true, "ChromeProfile", config.chromeProfileDir);

  const templates = fs.existsSync(config.templateDir)
    ? fs.readdirSync(config.templateDir).filter((name) => name.toLowerCase().endsWith(".txt"))
    : [];
  if (!templates.length) throw new Error(`充值模板目录没有 txt：${config.templateDir}`);
  line(true, "充值模板", templates.join(", "));

  const webhookText = assertFile(config.wechatWebhookFile, "企业微信接口");
  const testFile = path.join(config.outputDir, "self-check.txt");
  fs.mkdirSync(config.outputDir, { recursive: true });
  fs.writeFileSync(testFile, `自检 ${nowChinaText()}`, "utf8");
  await sendWechatFile(webhookText, testFile);
  line(true, "企业微信文件发送", path.basename(testFile));

  assertFile(config.feishuApiFile, "飞书 API");
  assertFile(config.feishuTableLinkFile, "飞书表格链接");
  await writeLabelToFirstEmptyFeishuRow({
    apiFile: config.feishuApiFile,
    tableLinkFile: config.feishuTableLinkFile,
    label: "自检",
    dryRun: true,
  });
  line(true, "飞书接口和表格读取", "可获取 token、sheet_id、E列");

  await checkPageOpen(platformUrl, "平台页面打开");
  line(true, "一键自检完成");
}

main().catch((error) => {
  console.error(`[失败] 一键自检：${error.message}`);
  console.error(`请检查配置文件是否存在：${path.join(rootDir, "config")}`);
  process.exitCode = 1;
});
