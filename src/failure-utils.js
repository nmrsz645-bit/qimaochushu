const fs = require("fs");
const path = require("path");
const { nowChinaText } = require("./time-utils");

function readFailures(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return { failures: [] };
  }
}

function parseChinaText(text) {
  const match = String(text || "").match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  return new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}+08:00`);
}

function addMsAsChinaText(date, ms) {
  return nowChinaText(new Date(date.getTime() + ms));
}

function appendFailure(file, failure) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const data = readFailures(file);
  data.failures.push({
    failedAt: nowChinaText(),
    ...failure,
  });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  return data;
}

function failureKey(failure) {
  if (failure.bookId) return `book:${failure.bookId}`;
  return `stage:${failure.stage || "未知"}`;
}

function recordFailureAttempt(file, failure, maxAttempts = 3, options = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const data = readFailures(file);
  const key = failureKey(failure);
  const nowDate = options.now || new Date();
  const now = nowChinaText(nowDate);
  const retryDelayMs = options.retryDelayMs == null ? 60 * 60 * 1000 : options.retryDelayMs;
  let item = (data.failures || []).find((entry) => entry.key === key);
  if (!item) {
    item = {
      key,
      firstFailedAt: now,
      attempts: 0,
    };
    data.failures.push(item);
  }
  Object.assign(item, failure, {
    key,
    attempts: Number(item.attempts || 0) + 1,
    lastFailedAt: now,
  });
  if (item.bookId && item.attempts < maxAttempts) {
    item.nextRetryAt = addMsAsChinaText(nowDate, retryDelayMs);
  } else {
    delete item.nextRetryAt;
  }
  const shouldNotify = item.attempts >= maxAttempts && !item.notifiedAt;
  if (shouldNotify) item.notifiedAt = now;
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  return { data, failure: item, shouldNotify };
}

function buildFailureBookState(data, maxAttempts = 3, now = new Date()) {
  const blockedBookIds = new Set();
  const coolingDownBookIds = new Set();
  for (const failure of (data && data.failures) || []) {
    if (!failure.bookId) continue;
    const bookId = String(failure.bookId);
    if (Number(failure.attempts || 0) >= maxAttempts) {
      blockedBookIds.add(bookId);
      continue;
    }
    const retryAt = parseChinaText(failure.nextRetryAt);
    if (retryAt && retryAt.getTime() > now.getTime()) coolingDownBookIds.add(bookId);
  }
  return { blockedBookIds, coolingDownBookIds };
}

function formatFailureNotice(failure) {
  return [
    "七：【七猫出书自动化异常】",
    `书籍ID：${failure.bookId || "未知"}`,
    `书名：${failure.bookName || "未知"}`,
    `阶段：${failure.stage || "未知"}`,
    `失败次数：${failure.attempts || 1}`,
    `原因：${failure.error || "未知错误"}`,
  ].join("\n");
}

function formatFailureSummary(failures, limit = 10) {
  const list = failures.slice(0, limit);
  const lines = [
    "七：【七猫出书自动化异常汇总】",
    `本轮失败：${failures.length} 本`,
    ...list.map((failure, index) => {
      const reason = String(failure.error || "未知错误").split("\n")[0].slice(0, 120);
      return `${index + 1}. ${failure.bookId || "未知"} ${failure.bookName || ""}｜${failure.stage || "未知"}｜${reason}`;
    }),
  ];
  if (failures.length > limit) lines.push(`其余 ${failures.length - limit} 本已写入 failed_tasks.json`);
  return lines.join("\n");
}

module.exports = {
  appendFailure,
  buildFailureBookState,
  failureKey,
  formatFailureNotice,
  formatFailureSummary,
  recordFailureAttempt,
  readFailures,
};
