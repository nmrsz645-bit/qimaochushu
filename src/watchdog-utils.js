const fs = require("fs");
const path = require("path");

function fileMtimeMs(file) {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

function newestLogMtimeMs(logDir) {
  return fileMtimeMs(path.join(logDir, "run.log"));
}

function isAutomationStale({ currentTaskExists, newestLogMtime, now = Date.now(), staleMs = 10 * 60 * 1000 }) {
  if (!currentTaskExists) return false;
  if (!newestLogMtime) return false;
  return now - newestLogMtime > staleMs;
}

module.exports = { isAutomationStale, newestLogMtimeMs };
