const fs = require("fs");
const path = require("path");

function isProcessRunning(pid) {
  if (!pid) return false;
  if (pid === process.pid) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireProcessLock(lockFile, label) {
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  try {
    const fd = fs.openSync(lockFile, "wx");
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, label, startedAt: new Date().toISOString() }));
    fs.closeSync(fd);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    let pid = 0;
    try {
      pid = Number(JSON.parse(fs.readFileSync(lockFile, "utf8")).pid || 0);
    } catch {
      pid = 0;
    }
    if (isProcessRunning(pid)) {
      const message = `${label || "process"} is already running, pid=${pid}`;
      const lockError = new Error(message);
      lockError.code = "LOCKED";
      throw lockError;
    }
    fs.rmSync(lockFile, { force: true });
    return acquireProcessLock(lockFile, label);
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    fs.rmSync(lockFile, { force: true });
  };
}

module.exports = { acquireProcessLock, isProcessRunning };
