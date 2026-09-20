const fs = require("fs");
const path = require("path");
const chromeProfileDirName = "\u4e03\u732b\u51fa\u4e66";
const DEFAULT_DASHSCOPE_BASE_URL = "https://ws-qbczn48xwolhpy29.cn-beijing.maas.aliyuncs.com/api/v1";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash-0731";
const DEFAULT_SCAN_PAGE_COUNT = 10;
const MAX_SCAN_PAGE_COUNT = 100;
const DEFAULT_DUPLICATE_BOOK_TITLE_MODE = "with-number";

function normalizeScanPageCount(value) {
  const pageCount = Math.floor(Number(value));
  if (!Number.isFinite(pageCount) || pageCount < 1 || pageCount > MAX_SCAN_PAGE_COUNT) {
    return DEFAULT_SCAN_PAGE_COUNT;
  }
  return pageCount;
}

function normalizeDuplicateBookTitleMode(value) {
  return value === "without-number" ? "without-number" : DEFAULT_DUPLICATE_BOOK_TITLE_MODE;
}

function defaultConfig(rootDir = "E:\\七猫出书") {
  return {
    platformLinkFile: path.join(rootDir, "平台链接.txt"),
    chromeProfileDir: path.join(rootDir, chromeProfileDirName),
    chromeExecutable: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    templateDir: path.join(rootDir, "充值模板"),
    wechatWebhookFile: path.join(rootDir, "企业微信", "新建文本文档.txt"),
    doubaoLinkFile: path.join(rootDir, "豆包", "新建文本文档.txt"),
    feishuApiFile: path.join(rootDir, "飞书api", "新建文本文档.txt"),
    feishuTableLinkFile: path.join(rootDir, "出书完成表格", "新建文本文档.txt"),
    forbiddenWordsFile: path.join(rootDir, "违禁词.txt"),
    dataDir: path.join(rootDir, "automation", "data"),
    logDir: path.join(rootDir, "automation", "logs"),
    outputDir: path.join(rootDir, "automation", "outputs"),
    failedDir: path.join(rootDir, "automation", "failed"),
    dryRun: false,
    // The monitoring browser is never intended to be a persistent user window.
    // Ignore legacy configurations that kept it open after each scan.
    keepBrowserOpen: false,
    sendChapterAfterPromotion: true,
    sendNovelToWechat: true,
    sendDoubaoAfterWechat: false,
    writeFeishuLabelAfterDoubao: false,
    doubaoReplyWaitMs: 60000,
    defaultCreateCount: "1",
    duplicateBookTitleMode: DEFAULT_DUPLICATE_BOOK_TITLE_MODE,
    scanPageCount: DEFAULT_SCAN_PAGE_COUNT,
    chapterOneGenerateClick: { x: 1665, y: 426 },
    queryIntervalMs: 3600000,
    singleBookTimeoutMs: 300000,
    failureRetryDelayMs: 3600000,
    retentionHours: 72,
    deepseekApiKeyFile: path.join(rootDir, "config", "DeepSeek\u63a5\u53e3.txt"),
    deepseekApiBaseUrl: DEFAULT_DASHSCOPE_BASE_URL,
    deepseekModel: DEFAULT_DEEPSEEK_MODEL,
    deepseekTimeoutMs: 45000,
  };
}

function getConfigInputFallbackFile(rootDir, key) {
  const files = {
    platformLink: path.join(rootDir, "config", "平台链接.txt"),
    wechatWebhook: path.join(rootDir, "config", "企业微信接口.txt"),
    feishuApi: path.join(rootDir, "config", "飞书api.txt"),
    feishuTableLink: path.join(rootDir, "config", "出书完成表格.txt"),
    deepseekApiKey: path.join(rootDir, "config", "DeepSeek接口.txt"),
    forbiddenWords: path.join(rootDir, "违禁词.txt"),
  };
  return files[key] || "";
}

function mergeWithDefaults(config, rootDir = "E:\\七猫出书") {
  const rawConfig = config || {};
  const merged = { ...defaultConfig(rootDir), ...rawConfig, keepBrowserOpen: false };
  merged.scanPageCount = normalizeScanPageCount(rawConfig.scanPageCount);
  merged.duplicateBookTitleMode = normalizeDuplicateBookTitleMode(rawConfig.duplicateBookTitleMode);
  if (!rawConfig.deepseekApiBaseUrl) merged.deepseekApiBaseUrl = DEFAULT_DASHSCOPE_BASE_URL;
  if (!rawConfig.deepseekModel || rawConfig.deepseekModel === "deepseek-v4-flash") {
    merged.deepseekModel = DEFAULT_DEEPSEEK_MODEL;
  }
  if (!rawConfig.forbiddenWordsFile && rawConfig.platformLinkFile && path.isAbsolute(rawConfig.platformLinkFile)) {
    merged.forbiddenWordsFile = path.join(path.dirname(rawConfig.platformLinkFile), "违禁词.txt");
  }
  return resolveExistingConfigFiles(resolveConfigPaths(merged, rootDir), rootDir);
}

function resolveConfigPaths(config, rootDir) {
  const next = { ...(config || {}) };
  const pathKeys = [
    "deepseekApiKeyFile",
    "platformLinkFile",
    "chromeProfileDir",
    "templateDir",
    "wechatWebhookFile",
    "doubaoLinkFile",
    "feishuApiFile",
    "feishuTableLinkFile",
    "forbiddenWordsFile",
    "dataDir",
    "logDir",
    "outputDir",
    "failedDir",
    "latestChapterTextFile",
  ];
  for (const key of pathKeys) {
    if (next[key] && !path.isAbsolute(next[key])) {
      next[key] = path.join(rootDir, next[key]);
    }
  }
  return next;
}

function resolveExistingConfigFiles(config, rootDir, exists = fs.existsSync) {
  const next = { ...(config || {}) };
  const fallbackNames = {
    platformLinkFile: "平台链接.txt",
    wechatWebhookFile: "企业微信接口.txt",
    feishuApiFile: "飞书api.txt",
    feishuTableLinkFile: "出书完成表格.txt",
    doubaoLinkFile: "豆包链接.txt",
  };
  for (const [key, name] of Object.entries(fallbackNames)) {
    const configured = next[key];
    if (configured && !exists(configured)) {
      const configFallback = path.join(rootDir, "config", name);
      const rootFallback = path.join(rootDir, name);
      if (exists(configFallback)) next[key] = configFallback;
      else if (exists(rootFallback)) next[key] = rootFallback;
    }
  }
  if (next.deepseekApiKeyFile && !exists(next.deepseekApiKeyFile)) {
    const deepseekFallback = path.join(rootDir, "config", "DeepSeek\u63a5\u53e3.txt");
    if (exists(deepseekFallback)) next.deepseekApiKeyFile = deepseekFallback;
  }
  const fallbackDirs = {
    chromeProfileDir: chromeProfileDirName,
    templateDir: "充值模板",
    dataDir: "data",
    logDir: "logs",
    outputDir: "outputs",
    failedDir: "failed",
  };
  for (const [key, name] of Object.entries(fallbackDirs)) {
    const configured = next[key];
    if (configured && exists(configured)) continue;
    const fallback = path.join(rootDir, name);
    if (exists(fallback)) next[key] = fallback;
  }
  const movableText = path.join(rootDir, "小说可移动", "小说内容.txt");
  if (exists(path.dirname(movableText))) next.latestChapterTextFile = movableText;
  const forbiddenWords = path.join(rootDir, "违禁词.txt");
  if (exists(forbiddenWords)) next.forbiddenWordsFile = forbiddenWords;
  return next;
}

function buildPortableConfig(rootDir) {
  return {
    deepseekApiKeyFile: path.join(rootDir, "config", "DeepSeek\u63a5\u53e3.txt"),
    deepseekApiBaseUrl: DEFAULT_DASHSCOPE_BASE_URL,
    deepseekModel: DEFAULT_DEEPSEEK_MODEL,
    deepseekTimeoutMs: 45000,
    ...defaultConfig(rootDir),
    platformLinkFile: path.join(rootDir, "config", "平台链接.txt"),
    doubaoLinkFile: path.join(rootDir, "config", "豆包链接.txt"),
    wechatWebhookFile: path.join(rootDir, "config", "企业微信接口.txt"),
    feishuApiFile: path.join(rootDir, "config", "飞书api.txt"),
    feishuTableLinkFile: path.join(rootDir, "config", "出书完成表格.txt"),
    forbiddenWordsFile: path.join(rootDir, "违禁词.txt"),
    chromeProfileDir: path.join(rootDir, chromeProfileDirName),
    templateDir: path.join(rootDir, "充值模板"),
    dataDir: path.join(rootDir, "data"),
    logDir: path.join(rootDir, "logs"),
    outputDir: path.join(rootDir, "outputs"),
    failedDir: path.join(rootDir, "failed"),
    latestChapterTextFile: path.join(rootDir, "小说可移动", "小说内容.txt"),
  };
}

function applyDirectoryConfig(config, dirs) {
  const next = { ...(config || {}) };
  if (dirs.configInputDir) {
    next.deepseekApiKeyFile = path.join(dirs.configInputDir, "DeepSeek\u63a5\u53e3.txt");
    next.platformLinkFile = path.join(dirs.configInputDir, "\u5e73\u53f0\u94fe\u63a5.txt");
    next.wechatWebhookFile = path.join(dirs.configInputDir, "\u4f01\u4e1a\u5fae\u4fe1\u63a5\u53e3.txt");
    next.feishuApiFile = path.join(dirs.configInputDir, "\u98de\u4e66api.txt");
    next.feishuTableLinkFile = path.join(dirs.configInputDir, "\u51fa\u4e66\u5b8c\u6210\u8868\u683c.txt");
    next.doubaoLinkFile = path.join(dirs.configInputDir, "\u8c46\u5305\u94fe\u63a5.txt");
  }
  for (const key of ["templateDir", "outputDir", "logDir", "dataDir", "failedDir"]) {
    if (dirs[key]) next[key] = dirs[key];
  }
  if (dirs.novelDir) next.latestChapterTextFile = path.join(dirs.novelDir, "\u5c0f\u8bf4\u5185\u5bb9.txt");
  return next;
}

function writeConfig(configPath, config) {
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

module.exports = {
  applyDirectoryConfig,
  buildPortableConfig,
  chromeProfileDirName,
  DEFAULT_DASHSCOPE_BASE_URL,
  DEFAULT_DEEPSEEK_MODEL,
  DEFAULT_DUPLICATE_BOOK_TITLE_MODE,
  DEFAULT_SCAN_PAGE_COUNT,
  MAX_SCAN_PAGE_COUNT,
  defaultConfig,
  getConfigInputFallbackFile,
  mergeWithDefaults,
  normalizeScanPageCount,
  normalizeDuplicateBookTitleMode,
  resolveExistingConfigFiles,
  resolveConfigPaths,
  writeConfig,
};
