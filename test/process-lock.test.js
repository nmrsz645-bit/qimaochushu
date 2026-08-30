const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { acquireProcessLock } = require("../src/process-lock");

function testAcquireAndReleaseLock() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-lock-"));
  const lockFile = path.join(dir, "run.lock");
  const release = acquireProcessLock(lockFile, "test");
  assert.strictEqual(fs.existsSync(lockFile), true);
  release();
  assert.strictEqual(fs.existsSync(lockFile), false);
}

function testExistingLiveLockBlocksSecondAcquire() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-lock-"));
  const lockFile = path.join(dir, "run.lock");
  const release = acquireProcessLock(lockFile, "test");
  assert.throws(() => acquireProcessLock(lockFile, "test"), /already running/);
  release();
}

function testStaleLockIsReplaced() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-lock-"));
  const lockFile = path.join(dir, "run.lock");
  fs.writeFileSync(lockFile, JSON.stringify({ pid: 99999999 }), "utf8");
  const release = acquireProcessLock(lockFile, "test");
  assert.strictEqual(fs.existsSync(lockFile), true);
  release();
}

testAcquireAndReleaseLock();
testExistingLiveLockBlocksSecondAcquire();
testStaleLockIsReplaced();
console.log("process-lock tests passed");
