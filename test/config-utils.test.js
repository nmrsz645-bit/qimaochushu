const assert = require("assert");
const path = require("path");
const { applyDirectoryConfig, defaultConfig, getConfigInputFallbackFile, mergeWithDefaults, normalizeDuplicateBookTitleMode, normalizeScanPageCount, resolveConfigPaths, resolveExistingConfigFiles } = require("../src/config-utils");

function testDefaultConfigUsesRoot() {
  const config = defaultConfig("E:\\七猫出书");
  assert.strictEqual(config.platformLinkFile, "E:\\七猫出书\\平台链接.txt");
  assert.strictEqual(config.feishuTableLinkFile, "E:\\七猫出书\\出书完成表格\\新建文本文档.txt");
  assert.strictEqual(config.forbiddenWordsFile, "E:\\七猫出书\\违禁词.txt");
}

function testMergeKeepsExistingOverrides() {
  const config = mergeWithDefaults({ dryRun: true, defaultCreateCount: "2" }, "E:\\七猫出书");
  assert.strictEqual(config.dryRun, true);
  assert.strictEqual(config.defaultCreateCount, "2");
  assert.strictEqual(config.queryIntervalMs, 3600000);
  assert.strictEqual(config.singleBookTimeoutMs, 300000);
  assert.strictEqual(config.failureRetryDelayMs, 3600000);
  assert.strictEqual(config.deepseekModel, "deepseek-v4-flash-0731");
  assert.strictEqual(config.deepseekApiBaseUrl, "https://ws-qbczn48xwolhpy29.cn-beijing.maas.aliyuncs.com/api/v1");
  assert.strictEqual(config.deepseekTimeoutMs, 45000);
  assert.strictEqual(config.sendNovelToWechat, true);
}

function testMergeDisablesLegacyKeepBrowserOpen() {
  const config = mergeWithDefaults({ keepBrowserOpen: true }, "E:\\七猫出书");
  assert.strictEqual(config.keepBrowserOpen, false);
}

function testScanPageCountStaysWithinSafeRange() {
  assert.strictEqual(normalizeScanPageCount(1), 1);
  assert.strictEqual(normalizeScanPageCount("100"), 100);
  assert.strictEqual(normalizeScanPageCount(0), 10);
  assert.strictEqual(normalizeScanPageCount(101), 10);
  assert.strictEqual(mergeWithDefaults({ scanPageCount: 20 }, "E:\\七猫出书").scanPageCount, 20);
}

function testDuplicateBookTitleModeDefaultsToWithNumber() {
  assert.strictEqual(normalizeDuplicateBookTitleMode("without-number"), "without-number");
  assert.strictEqual(normalizeDuplicateBookTitleMode("anything-else"), "with-number");
  assert.strictEqual(mergeWithDefaults({}, "E:\\七猫出书").duplicateBookTitleMode, "with-number");
}

function testMigratesLegacyDeepSeekModelToDashScope() {
  const config = mergeWithDefaults({ deepseekModel: "deepseek-v4-flash" }, "E:\\七猫出书");
  assert.strictEqual(config.deepseekModel, "deepseek-v4-flash-0731");
}

function testMergeInfersForbiddenWordsBesideAbsolutePlatformLink() {
  const config = mergeWithDefaults({ platformLinkFile: "D:\\自动化\\平台链接.txt" }, "D:\\自动化\\automation");
  assert.strictEqual(config.forbiddenWordsFile, "D:\\自动化\\违禁词.txt");
}

function testConfigInputFallbackFilesStayInsidePortableRoot() {
  const root = "D:\\portable\\qimao";
  assert.strictEqual(getConfigInputFallbackFile(root, "forbiddenWords"), path.join(root, "违禁词.txt"));
  assert.strictEqual(getConfigInputFallbackFile(root, "platformLink"), path.join(root, "config", "平台链接.txt"));
  assert.strictEqual(getConfigInputFallbackFile(root, "unknown"), "");
}

function testApplyDirectoryConfigMapsSelectedFolders() {
  const config = applyDirectoryConfig(
    {},
    {
      configInputDir: "D:\\input",
      templateDir: "D:\\template",
      outputDir: "D:\\done",
      logDir: "D:\\logs",
      dataDir: "D:\\data",
      failedDir: "D:\\failed",
      novelDir: "D:\\novel",
    }
  );
  assert.strictEqual(config.platformLinkFile, path.join("D:\\input", "平台链接.txt"));
  assert.strictEqual(config.wechatWebhookFile, path.join("D:\\input", "企业微信接口.txt"));
  assert.strictEqual(config.feishuApiFile, path.join("D:\\input", "飞书api.txt"));
  assert.strictEqual(config.feishuTableLinkFile, path.join("D:\\input", "出书完成表格.txt"));
  assert.strictEqual(config.doubaoLinkFile, path.join("D:\\input", "豆包链接.txt"));
  assert.strictEqual(config.deepseekApiKeyFile, path.join("D:\\input", "DeepSeek接口.txt"));
  assert.strictEqual(config.templateDir, "D:\\template");
  assert.strictEqual(config.outputDir, "D:\\done");
  assert.strictEqual(config.logDir, "D:\\logs");
  assert.strictEqual(config.dataDir, "D:\\data");
  assert.strictEqual(config.failedDir, "D:\\failed");
  assert.strictEqual(config.latestChapterTextFile, path.join("D:\\novel", "小说内容.txt"));
}

function testResolveConfigPathsMakesPortablePathsAbsolute() {
  const root = "D:\\portable\\qimao";
  const config = resolveConfigPaths(
    {
      platformLinkFile: "config\\platform.txt",
      chromeProfileDir: "\u4e03\u732b\u51fa\u4e66",
      templateDir: "templates",
      dataDir: "data",
      logDir: "logs",
      outputDir: "outputs",
      failedDir: "failed",
      latestChapterTextFile: "novels\\latest.txt",
      forbiddenWordsFile: "违禁词.txt",
      deepseekApiKeyFile: "config\\DeepSeek接口.txt",
      chromeExecutable: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    },
    root
  );
  assert.strictEqual(config.platformLinkFile, path.join(root, "config\\platform.txt"));
  assert.strictEqual(config.chromeProfileDir, path.join(root, "\u4e03\u732b\u51fa\u4e66"));
  assert.strictEqual(config.templateDir, path.join(root, "templates"));
  assert.strictEqual(config.dataDir, path.join(root, "data"));
  assert.strictEqual(config.logDir, path.join(root, "logs"));
  assert.strictEqual(config.outputDir, path.join(root, "outputs"));
  assert.strictEqual(config.failedDir, path.join(root, "failed"));
  assert.strictEqual(config.latestChapterTextFile, path.join(root, "novels\\latest.txt"));
  assert.strictEqual(config.forbiddenWordsFile, path.join(root, "违禁词.txt"));
  assert.strictEqual(config.deepseekApiKeyFile, path.join(root, "config\\DeepSeek接口.txt"));
  assert.strictEqual(config.chromeExecutable, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe");
}

function testResolveExistingConfigFilesFallsBackToRootFiles() {
  const root = "D:\\portable\\qimao";
  const config = resolveExistingConfigFiles(
    {
      platformLinkFile: path.join(root, "config", "平台链接.txt"),
      wechatWebhookFile: path.join(root, "config", "企业微信接口.txt"),
      chromeProfileDir: "E:\\old\\automation\\七猫出书",
      templateDir: "E:\\old\\automation\\充值模板",
      dataDir: "E:\\old\\automation\\data",
    },
    root,
    (file) =>
      [
        path.join(root, "平台链接.txt"),
        path.join(root, "七猫出书"),
        path.join(root, "充值模板"),
        path.join(root, "data"),
      ].includes(file)
  );
  assert.strictEqual(config.platformLinkFile, path.join(root, "平台链接.txt"));
  assert.strictEqual(config.wechatWebhookFile, path.join(root, "config", "企业微信接口.txt"));
  assert.strictEqual(config.chromeProfileDir, path.join(root, "七猫出书"));
  assert.strictEqual(config.templateDir, path.join(root, "充值模板"));
  assert.strictEqual(config.dataDir, path.join(root, "data"));
}

function testResolveExistingConfigFilesKeepsExistingConfiguredDirectory() {
  const root = "D:\\portable\\qimao";
  const configuredTemplate = "E:\\source\\充值模板";
  const config = resolveExistingConfigFiles(
    {
      templateDir: configuredTemplate,
    },
    root,
    (file) => file === configuredTemplate || file === path.join(root, "充值模板")
  );
  assert.strictEqual(config.templateDir, configuredTemplate);
}

testDefaultConfigUsesRoot();
testMergeKeepsExistingOverrides();
testMergeDisablesLegacyKeepBrowserOpen();
testScanPageCountStaysWithinSafeRange();
testDuplicateBookTitleModeDefaultsToWithNumber();
testMigratesLegacyDeepSeekModelToDashScope();
testMergeInfersForbiddenWordsBesideAbsolutePlatformLink();
testConfigInputFallbackFilesStayInsidePortableRoot();
testResolveConfigPathsMakesPortablePathsAbsolute();
testResolveExistingConfigFilesFallsBackToRootFiles();
testResolveExistingConfigFilesKeepsExistingConfiguredDirectory();
testApplyDirectoryConfigMapsSelectedFolders();
console.log("config-utils tests passed");
