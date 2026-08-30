const path = require("path");
const { mergeWithDefaults } = require("./config-utils");
const { resolveAppRoot } = require("./desktop-paths");

function getConfigPath() {
  return path.join(resolveAppRoot(), "config.json");
}

function loadConfig() {
  const rootDir = resolveAppRoot();
  return mergeWithDefaults(require(getConfigPath()), rootDir);
}

module.exports = { getConfigPath, loadConfig };
