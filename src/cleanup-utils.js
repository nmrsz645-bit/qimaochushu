const fs = require("fs");
const path = require("path");

function isDisposableDataFile(name) {
  return (
    /^failed_tasks\..+\.json$/.test(name) ||
    /^seen_books\.before-.+\.json$/.test(name) ||
    name === "single_full_run_target.json"
  );
}

function walkFiles(dir) {
  if (!dir || !fs.existsSync(dir)) return [];
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      result.push(fullPath);
    }
  }
  return result;
}

function removeEmptyDirs(dir) {
  if (!dir || !fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) removeEmptyDirs(path.join(dir, entry.name));
  }
  if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}

function isOlderThan(file, cutoffMs) {
  return fs.statSync(file).mtimeMs < cutoffMs;
}

function cleanupOldFiles(config) {
  const retentionHours = Number(config.retentionHours || (config.retentionDays || 3) * 24);
  const cutoffMs = Date.now() - retentionHours * 60 * 60 * 1000;
  const removed = [];

  for (const dir of [config.logDir, config.outputDir, config.failedDir]) {
    for (const file of walkFiles(dir)) {
      if (isOlderThan(file, cutoffMs)) {
        fs.rmSync(file, { force: true });
        removed.push(file);
      }
    }
    removeEmptyDirs(dir);
  }

  for (const file of walkFiles(config.dataDir)) {
    if (isDisposableDataFile(path.basename(file)) && isOlderThan(file, cutoffMs)) {
      fs.rmSync(file, { force: true });
      removed.push(file);
    }
  }

  return { removed, retentionHours };
}

module.exports = { cleanupOldFiles, isDisposableDataFile, walkFiles };
