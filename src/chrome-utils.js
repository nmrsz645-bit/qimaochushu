const fs = require("fs");
const path = require("path");

function buildChromeCandidatePaths(env = process.env) {
  const candidates = [
    path.join(env.PROGRAMFILES || "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Google", "Chrome", "Application", "chrome.exe"),
  ];
  if (env.LOCALAPPDATA) {
    candidates.push(path.join(env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"));
  }
  return Array.from(new Set(candidates));
}

function findChromeExecutable(candidates = buildChromeCandidatePaths()) {
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || "";
}

function resolveChromeExecutable(configuredPath) {
  if (configuredPath && fs.existsSync(configuredPath)) return configuredPath;
  return findChromeExecutable();
}

function requireChromeExecutable(configuredPath) {
  const executable = resolveChromeExecutable(configuredPath);
  if (executable) return executable;
  throw new Error(
    [
      "Chrome was not found.",
      `Configured path: ${configuredPath || "(empty)"}`,
      "Install Google Chrome or edit config.json chromeExecutable.",
      `Tried: ${buildChromeCandidatePaths().join(" | ")}`,
    ].join(" ")
  );
}

module.exports = {
  buildChromeCandidatePaths,
  findChromeExecutable,
  requireChromeExecutable,
  resolveChromeExecutable,
};
