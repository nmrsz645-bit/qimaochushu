const assert = require("assert");
const path = require("path");
const {
  buildChromeCandidatePaths,
  findChromeExecutable,
  resolveChromeExecutable,
} = require("../src/chrome-utils");

function testBuildChromeCandidatePathsIncludesCommonLocations() {
  const candidates = buildChromeCandidatePaths({
    PROGRAMFILES: "C:\\Program Files",
    "PROGRAMFILES(X86)": "C:\\Program Files (x86)",
    LOCALAPPDATA: "C:\\Users\\User\\AppData\\Local",
  });
  assert(candidates.includes("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"));
  assert(candidates.includes("C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"));
  assert(candidates.includes("C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe"));
}

function testFindChromeExecutableUsesExistingCandidate() {
  const existing = path.join(process.cwd(), "package.json");
  assert.strictEqual(findChromeExecutable([path.join(process.cwd(), "missing.exe"), existing]), existing);
}

function testResolveChromeExecutableKeepsExistingPath() {
  const existing = path.join(process.cwd(), "package.json");
  assert.strictEqual(resolveChromeExecutable(existing), existing);
}

testBuildChromeCandidatePathsIncludesCommonLocations();
testFindChromeExecutableUsesExistingCandidate();
testResolveChromeExecutableKeepsExistingPath();
console.log("chrome-utils tests passed");
