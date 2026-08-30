const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { loadConfigAtRoot } = require("../src/runtime-config");

function testFirstRunCreatesPortableConfig() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-runtime-config-"));
  const configPath = path.join(rootDir, "config.json");

  const config = loadConfigAtRoot(rootDir);

  assert.ok(fs.existsSync(configPath));
  assert.strictEqual(config.dataDir, path.join(rootDir, "data"));
  assert.strictEqual(config.logDir, path.join(rootDir, "logs"));
  assert.strictEqual(config.chromeProfileDir, path.join(rootDir, "七猫出书"));
  assert.strictEqual(JSON.parse(fs.readFileSync(configPath, "utf8")).dataDir, path.join(rootDir, "data"));
}

testFirstRunCreatesPortableConfig();
console.log("runtime-config tests passed");
