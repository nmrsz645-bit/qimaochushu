const assert = require("assert");
const { spawnSync } = require("child_process");
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

function testSelfCheckInitializesConfigBeforeReportingMissingCredentials() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-self-check-"));
  const result = spawnSync(process.execPath, [path.join(__dirname, "..", "src", "self-check.js")], {
    cwd: rootDir,
    encoding: "utf8",
    env: { ...process.env, QIMAO_APP_ROOT: rootDir },
  });

  assert.notStrictEqual(result.status, 0);
  assert.ok(fs.existsSync(path.join(rootDir, "config.json")));
  assert.match(result.stderr, /DeepSeek API key file is missing or empty/);
}

testFirstRunCreatesPortableConfig();
testSelfCheckInitializesConfigBeforeReportingMissingCredentials();
console.log("runtime-config tests passed");
