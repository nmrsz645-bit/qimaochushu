const assert = require("assert");
const { nowChinaText, nowStampText } = require("../src/time-utils");

function testNowChinaTextUsesShanghaiTimezone() {
  const date = new Date("2026-06-28T18:42:24.000Z");
  assert.strictEqual(nowChinaText(date), "2026-06-29 02:42:24");
}

function testNowStampTextIsFilenameSafe() {
  const date = new Date("2026-06-28T18:42:24.000Z");
  assert.strictEqual(nowStampText(date), "20260629024224");
}

testNowChinaTextUsesShanghaiTimezone();
testNowStampTextIsFilenameSafe();
console.log("time-utils tests passed");
