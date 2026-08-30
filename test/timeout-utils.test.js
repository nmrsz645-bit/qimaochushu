const assert = require("assert");
const { TimeoutError, shouldResetBrowserAfterError, withTimeout } = require("../src/timeout-utils");

async function testWithTimeoutRejectsAndRunsCallback() {
  let callbackRan = false;
  await assert.rejects(
    () =>
      withTimeout(
        () => new Promise((resolve) => setTimeout(resolve, 50)),
        5,
        "book timed out",
        () => {
          callbackRan = true;
        }
      ),
    TimeoutError
  );
  assert.strictEqual(callbackRan, true);
}

async function testWithTimeoutReturnsCompletedTask() {
  const result = await withTimeout(() => Promise.resolve("ok"), 50, "book timed out");
  assert.strictEqual(result, "ok");
}

async function testTaskRejectionAfterTimeoutDoesNotWinRace() {
  let rejectTask;
  await assert.rejects(
    () =>
      withTimeout(
        () => new Promise((_, reject) => {
          rejectTask = reject;
        }),
        5,
        "book timed out",
        () => rejectTask(new Error("closed"))
      ),
    TimeoutError
  );
}

async function testTaskResolutionAfterTimeoutDoesNotWinRace() {
  let resolveTask;
  await assert.rejects(
    () =>
      withTimeout(
        () => new Promise((resolve) => {
          resolveTask = resolve;
        }),
        5,
        "book timed out",
        () => resolveTask("late ok")
      ),
    TimeoutError
  );
}

function testShouldResetBrowserAfterError() {
  assert.strictEqual(shouldResetBrowserAfterError(new TimeoutError("timeout")), true);
  assert.strictEqual(shouldResetBrowserAfterError(new Error("Target page, context or browser has been closed")), true);
  assert.strictEqual(shouldResetBrowserAfterError(new Error("ordinary failure")), false);
}

(async () => {
  await testWithTimeoutRejectsAndRunsCallback();
  await testWithTimeoutReturnsCompletedTask();
  await testTaskRejectionAfterTimeoutDoesNotWinRace();
  await testTaskResolutionAfterTimeoutDoesNotWinRace();
  testShouldResetBrowserAfterError();
  console.log("timeout-utils tests passed");
})();
