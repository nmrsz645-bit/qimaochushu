const path = require("path");
const { chromeProfileDirName } = require("./config-utils");

function resolveAppRoot() {
  return process.env.QIMAO_APP_ROOT || path.resolve(__dirname, "..");
}

function resolvePortablePaths(rootDir = resolveAppRoot()) {
  return {
    rootDir,
    configDir: path.join(rootDir, "config"),
    dataDir: path.join(rootDir, "data"),
    logsDir: path.join(rootDir, "logs"),
    outputsDir: path.join(rootDir, "outputs"),
    failedDir: path.join(rootDir, "failed"),
    templateDir: path.join(rootDir, "充值模板"),
    chromeProfileDir: path.join(rootDir, chromeProfileDirName),
    movableNovelDir: path.join(rootDir, "小说可移动"),
  };
}

module.exports = { resolveAppRoot, resolvePortablePaths };
