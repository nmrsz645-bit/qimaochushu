const fs = require("fs");
const path = require("path");
const { nowChinaText } = require("./time-utils");

function createWatchLogger(logDir, clock = nowChinaText, fileName = "watch-hourly.log") {
  return (message) => {
    fs.mkdirSync(logDir, { recursive: true });
    const line = `[${clock()}] ${message}`;
    console.log(line);
    fs.appendFileSync(path.join(logDir, fileName), `${line}\n`, "utf8");
  };
}

function pipeStream(stream, prefix, log) {
  if (!stream) return;
  stream.on("data", (chunk) => {
    for (const line of String(chunk || "").split(/\r?\n/).filter(Boolean)) {
      log(`${prefix} ${line}`);
    }
  });
}

function pipeChildOutputToWatchLog(child, log) {
  pipeStream(child.stdout, "[run-once stdout]", log);
  pipeStream(child.stderr, "[run-once stderr]", log);
}

function getNextRunDelayMs(exitCode, intervalMs, retryDelayMs = 60 * 1000) {
  return Number(exitCode || 0) === 0 ? intervalMs : retryDelayMs;
}

function isRunStalled({ running, startedAt, runLogMtime, now = Date.now(), staleMs = 10 * 60 * 1000 }) {
  if (!running || !startedAt || now - startedAt < staleMs) return false;
  return !runLogMtime || now - runLogMtime > staleMs;
}

module.exports = { createWatchLogger, getNextRunDelayMs, isRunStalled, pipeChildOutputToWatchLog };
