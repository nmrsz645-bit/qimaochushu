const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  appendFailure,
  buildFailureBookState,
  failureKey,
  formatFailureNotice,
  formatFailureSummary,
  recordFailureAttempt,
  readFailures,
} = require("../src/failure-utils");

function testAppendFailureCreatesQueue() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-fail-"));
  const file = path.join(dir, "failed_tasks.json");
  appendFailure(file, { bookId: "700001", bookName: "测试书", stage: "豆包", error: "验证码" });
  const data = readFailures(file);
  assert.strictEqual(data.failures.length, 1);
  assert.strictEqual(data.failures[0].bookId, "700001");
}

function testFormatFailureNotice() {
  const text = formatFailureNotice({ bookId: "700001", bookName: "测试书", stage: "豆包", error: "验证码", attempts: 3 });
  assert.ok(text.startsWith("七："));
  assert.ok(text.includes("700001"));
  assert.ok(text.includes("测试书"));
  assert.ok(text.includes("验证码"));
  assert.ok(text.includes("3"));
}

function testFormatFailureSummary() {
  const text = formatFailureSummary([
    { bookId: "700001", bookName: "测试书1", stage: "搜索", error: "错误1\nstack" },
    { bookId: "700002", bookName: "测试书2", stage: "豆包", error: "错误2" },
  ]);
  assert.ok(text.startsWith("七："));
  assert.ok(text.includes("本轮失败：2 本"));
  assert.ok(text.includes("700001"));
  assert.ok(text.includes("错误1"));
  assert.ok(!text.includes("stack"));
}

function testRecordFailureAttemptNotifiesOnThirdFailureOnly() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-fail-retry-"));
  const file = path.join(dir, "failed_tasks.json");
  const failure = { bookId: "700001", bookName: "测试书", stage: "豆包", error: "验证码" };
  assert.strictEqual(recordFailureAttempt(file, failure, 3).shouldNotify, false);
  assert.strictEqual(recordFailureAttempt(file, failure, 3).shouldNotify, false);
  const third = recordFailureAttempt(file, failure, 3);
  assert.strictEqual(third.shouldNotify, true);
  assert.strictEqual(third.failure.attempts, 3);
  assert.strictEqual(recordFailureAttempt(file, failure, 3).shouldNotify, false);
  const data = readFailures(file);
  assert.strictEqual(data.failures.length, 1);
  assert.strictEqual(data.failures[0].attempts, 4);
  assert.ok(data.failures[0].notifiedAt);
}

function testFailureKeyUsesBookIdWhenPresent() {
  assert.strictEqual(failureKey({ bookId: "700001", stage: "豆包" }), "book:700001");
  assert.strictEqual(failureKey({ stage: "整轮检测" }), "stage:整轮检测");
}

function testRecordFailureAttemptSchedulesNextHourlyRetry() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-fail-retry-at-"));
  const file = path.join(dir, "failed_tasks.json");
  const result = recordFailureAttempt(
    file,
    { bookId: "700001", bookName: "test", stage: "chapter", error: "timeout" },
    3,
    { now: new Date("2026-07-03T08:00:00+08:00"), retryDelayMs: 60 * 60 * 1000 }
  );
  assert.strictEqual(result.failure.nextRetryAt, "2026-07-03 09:00:00");
}

function testBuildFailureBookStateSeparatesCoolingDownAndBlockedBooks() {
  const data = {
    failures: [
      { bookId: "700001", attempts: 1, nextRetryAt: "2026-07-03 09:00:00" },
      { bookId: "700002", attempts: 2, nextRetryAt: "2026-07-03 07:00:00" },
      { bookId: "700003", attempts: 3, nextRetryAt: "2026-07-03 09:00:00" },
    ],
  };
  const state = buildFailureBookState(data, 3, new Date("2026-07-03T08:00:00+08:00"));
  assert.strictEqual(state.coolingDownBookIds.has("700001"), true);
  assert.strictEqual(state.coolingDownBookIds.has("700002"), false);
  assert.strictEqual(state.blockedBookIds.has("700003"), true);
}

testAppendFailureCreatesQueue();
testFormatFailureNotice();
testFormatFailureSummary();
testRecordFailureAttemptNotifiesOnThirdFailureOnly();
testFailureKeyUsesBookIdWhenPresent();
testRecordFailureAttemptSchedulesNextHourlyRetry();
testBuildFailureBookStateSeparatesCoolingDownAndBlockedBooks();
console.log("failure-utils tests passed");
