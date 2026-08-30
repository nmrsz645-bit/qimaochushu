const fs = require("fs");
const path = require("path");
const { buildPortableConfig, mergeWithDefaults, writeConfig } = require("./config-utils");
const { resolveAppRoot } = require("./desktop-paths");

function getConfigPath(rootDir = resolveAppRoot()) {
  return path.join(rootDir, "config.json");
}

function loadConfigAtRoot(rootDir) {
  const configPath = getConfigPath(rootDir);
  if (!fs.existsSync(configPath)) {
    writeConfig(configPath, buildPortableConfig(rootDir));
  }

  const rawConfig = JSON.parse(fs.readFileSync(configPath, "utf8").replace(/^\uFEFF/, ""));
  return mergeWithDefaults(rawConfig, rootDir);
}

function loadConfig() {
  return loadConfigAtRoot(resolveAppRoot());
}

module.exports = { getConfigPath, loadConfig, loadConfigAtRoot };
