const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { chromium } = require("playwright-core");
const { resolveAppRoot } = require("./desktop-paths");
const { loadConfig } = require("./runtime-config");
const { requireChromeExecutable } = require("./chrome-utils");
const {
  clearFeishuReservedRowValues,
  formatFeishuLabel,
  isSheetRowEmpty,
  readFeishuBookNames,
  readFeishuReservedRowValues,
  reserveFeishuRow,
  writeFeishuReservedRowValues,
} = require("./feishu-utils");
const { chooseManualFeishuBookName, duplicateBookTitleKey, parseManualBookIds } = require("./platform-utils");
const { buildFailureBookState, formatFailureNotice, formatFailureSummary, recordFailureAttempt, readFailures } = require("./failure-utils");
const { cleanupOldFiles } = require("./cleanup-utils");
const { filterBooksAlreadyInFeishu, filterBooksByAddedDate, findBooksByTitle, mergeBooksById, selectDetectedBooks } = require("./platform-utils");
const { buildTopicLabel } = require("./deepseek-topic-utils");
const { normalizeOutputBookTitle } = require("./compliance-topic-utils");
const { acquireProcessLock } = require("./process-lock");
const { nowChinaText, nowStampText } = require("./time-utils");
const { shouldResetBrowserAfterError, withTimeout } = require("./timeout-utils");
const { sendWechatFile, sendWechatText, writeBookTextFile, writeMovableChapterTextFile } = require("./workflow-utils");

const rootDir = resolveAppRoot();
const config = loadConfig();
config.chromeExecutable = requireChromeExecutable(config.chromeExecutable);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function log(message) {
  ensureDir(config.logDir);
  const line = `[${nowChinaText()}] ${message}`;
  console.log(line);
  fs.appendFileSync(path.join(config.logDir, "run.log"), `${line}\n`, "utf8");
}

function stopDedicatedChrome() {
  if (process.platform !== "win32") return 0;
  const profilePath = path.resolve(config.chromeProfileDir).replace(/'/g, "''");
  const script = [
    `$profilePath = '${profilePath}'`,
    "Get-CimInstance Win32_Process -Filter \"Name = 'chrome.exe'\" |",
    "Where-Object { $_.CommandLine -and $_.CommandLine.Contains($profilePath) } |",
    "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $_.ProcessId }",
  ].join("\n");
  try {
    const output = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      encoding: "utf8",
      timeout: 10000,
      windowsHide: true,
    });
    return output.trim() ? output.trim().split(/\s+/).length : 0;
  } catch {
    return 0;
  }
}

async function closeDedicatedBrowser(context) {
  if (!context) return;
  await withTimeout(
    () => context.close(),
    8000,
    "browser context close timeout",
    () => log("浏览器正常关闭超时，开始强制收尾。")
  ).catch((error) => log(`浏览器收尾异常：${error.message}`));
  const stopped = stopDedicatedChrome();
  if (stopped) log(`已强制关闭七猫出书专用 Chrome：${stopped} 个进程。`);
}

async function openBrowserContext() {
  const context = await chromium.launchPersistentContext(config.chromeProfileDir, {
    executablePath: config.chromeExecutable,
    headless: false,
    viewport: null,
    args: ["--start-maximized", "--no-first-run"],
  });
  const page = context.pages()[0] || await context.newPage();
  await page.goto(readPlatformUrl(), { waitUntil: "domcontentloaded", timeout: 60000 });
  return { context, page };
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}

function getTodayRecordedTitleKeysFromLog(today) {
  const file = path.join(config.logDir, "run.log");
  const startedTitles = new Map();
  const titleKeys = new Set();
  let forcedRun = false;
  for (const line of String(fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "").split(/\r?\n/)) {
    if (!line.startsWith(`[${today} `)) continue;
    if (/启动一次试跑|Starting one run/.test(line)) forcedRun = false;
    if (/MANUAL_BOOK_IDS=|SINGLE_BOOK_ID=/.test(line)) forcedRun = true;
    const startedMatch = line.match(/Start book:\s*(\d+)\s*(.*)$/);
    if (startedMatch) {
      const titleKey = duplicateBookTitleKey({ bookName: startedMatch[2] });
      if (titleKey) startedTitles.set(startedMatch[1], titleKey);
      continue;
    }
    if (forcedRun || !/Recorded automatic book ID:|已记录自动书籍ID：/.test(line)) continue;
    const idMatch = line.match(/(\d+)\s*$/);
    const titleKey = idMatch ? startedTitles.get(idMatch[1]) : "";
    if (titleKey) titleKeys.add(titleKey);
  }
  return titleKeys;
}

function recordTodayDeduplicatedAutomaticBook(target) {
  const file = path.join(config.dataDir, "today_processed_titles.json");
  const today = todayText();
  const snapshot = readJson(file, {});
  const titleKeys = snapshot.date === today
    ? new Set(snapshot.originalTitleKeys || [])
    : getTodayRecordedTitleKeysFromLog(today);
  const titleKey = duplicateBookTitleKey(target);
  if (!titleKey) return;
  titleKeys.add(titleKey);
  writeJson(file, {
    date: today,
    originalTitleKeys: Array.from(titleKeys).sort(),
    updatedAt: nowChinaText(),
  });
}

function todayText() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function nextProducer() {
  const file = path.join(config.dataDir, "producer_state.json");
  const state = readJson(file, { next: 1 });
  const producer = Number(state.next) || 1;
  const next = producer >= 3 ? 1 : producer + 1;
  writeJson(file, { next, updatedAt: nowChinaText() });
  return String(producer);
}

async function notifyFailure(failure) {
  try {
    const webhookText = fs.readFileSync(config.wechatWebhookFile, "utf8");
    await sendWechatText(webhookText, formatFailureNotice(failure));
  } catch (error) {
    log(`企业微信异常通知发送失败：${error.message}`);
  }
}

async function notifyFailureSummary(failures) {
  if (!failures.length) return;
  try {
    const webhookText = fs.readFileSync(config.wechatWebhookFile, "utf8");
    await sendWechatText(webhookText, formatFailureSummary(failures));
    log(`企业微信异常汇总发送成功：${failures.length} 本`);
  } catch (error) {
    log(`企业微信异常汇总发送失败：${error.message}`);
  }
}

async function recordFailure(failure) {
  const result = recordFailureAttempt(path.join(config.dataDir, "failed_tasks.json"), failure, config.maxFailureAttempts || 3, {
    retryDelayMs: config.failureRetryDelayMs || 60 * 60 * 1000,
  });
  log(
    `已记录失败任务：${failure.bookId || "未知"} ${failure.stage || ""} 第${result.failure.attempts}次 ${failure.error || ""}`
  );
  return result;
}

async function clearReservedFeishuRow(feishuReservation) {
  if (!feishuReservation) return;
  try {
    const result = await clearFeishuReservedRowValues({
      apiFile: config.feishuApiFile,
      tableLinkFile: config.feishuTableLinkFile,
      row: feishuReservation.row,
    });
    log(`已清空失败占用飞书行：${result.sheetId}!A${result.row}:G${result.row}`);
  } catch (error) {
    log(`清空失败占用飞书行失败：${feishuReservation.sheetId}!A${feishuReservation.row}:G${feishuReservation.row} ${error.message}`);
  }
}

function removeCurrentTask() {
  fs.rmSync(path.join(config.dataDir, "current_task.json"), { force: true });
}

async function recoverReservedCurrentTask() {
  const file = path.join(config.dataDir, "current_task.json");
  const task = readJson(file, null);
  if (!task || !task.feishuRow) return;
  try {
    const result = await readFeishuReservedRowValues({
      apiFile: config.feishuApiFile,
      tableLinkFile: config.feishuTableLinkFile,
      row: task.feishuRow,
    });
    const row = result.values;
    const isPlaceholder = row.length === 7 && row.every((value) => String(value || "") === "1");
    if (isPlaceholder || isSheetRowEmpty(row)) {
      await clearReservedFeishuRow(task);
      log(`已恢复上次中断的飞书占位行：${result.sheetId}!A${task.feishuRow}:G${task.feishuRow}`);
    } else {
      log(`保留上次已写入的飞书行，不清空：${result.sheetId}!A${task.feishuRow}:G${task.feishuRow}`);
    }
  } catch (error) {
    log(`检查上次飞书占位行失败，保留原行：${error.message}`);
  } finally {
    removeCurrentTask();
  }
}

function readBlockedFailureBookIds() {
  const data = readFailures(path.join(config.dataDir, "failed_tasks.json"));
  return buildFailureBookState(data, config.maxFailureAttempts || 3);
}

function readPlatformUrl() {
  return fs.readFileSync(config.platformLinkFile, "utf8").trim();
}

function readTemplateNames() {
  if (!fs.existsSync(config.templateDir)) return [];
  return fs
    .readdirSync(config.templateDir)
    .filter((name) => name.toLowerCase().endsWith(".txt"))
    .map((name) => path.basename(name, ".txt"));
}

async function clickQuery(page) {
  const queryButton = page.locator('button[title="查询"], button:has-text("查 询"), button:has-text("查询")').first();
  await queryButton.waitFor({ state: "visible", timeout: 15000 });
  await queryButton.click();
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

async function clickAllLibrary(page) {
  const allLibrary = page.getByText("全部书库", { exact: true }).last();
  await allLibrary.waitFor({ state: "visible", timeout: 10000 });
  await allLibrary.click();
  await page.waitForTimeout(1200);
  log("已点击：全部书库");
}

async function goToFirstPage(page) {
  const first = page.locator(".ant-pagination-item-1").first();
  if (await first.isVisible({ timeout: 3000 }).catch(() => false)) {
    await first.click();
    await page.waitForTimeout(1200);
  }
}

async function clickNextPage(page) {
  const disabled = await page
    .locator(".ant-pagination-next")
    .first()
    .evaluate((el) => el.className.includes("ant-pagination-disabled"))
    .catch(() => true);
  if (disabled) return false;
  await page.locator(".ant-pagination-next").first().click();
  await page.waitForTimeout(1500);
  return true;
}

async function scanBooksAcrossPages(page, pageCount) {
  await clickAllLibrary(page);
  await clickQuery(page);
  await goToFirstPage(page);
  const pages = [];
  for (let index = 1; index <= pageCount; index += 1) {
    const books = await extractBooks(page);
    log(`扫描第 ${index}/${pageCount} 页，读取到 ${books.length} 本书。`);
    pages.push(books);
    if (index < pageCount) {
      const moved = await clickNextPage(page);
      if (!moved) throw new Error(`扫描未完成：第 ${index} 页后无法翻到下一页`);
    }
  }
  return mergeBooksById(pages);
}

async function extractBooks(page) {
  return page.evaluate(() => {
    const normalize = (text) => (text || "").replace(/\s+/g, " ").trim();
    const headers = Array.from(document.querySelectorAll(".ant-table-thead th")).map((th) => normalize(th.innerText));
    const addedTimeIndex = headers.findIndex((header) => /添加时间/.test(header));
    const idIndex = headers.findIndex((header) => /书籍ID/.test(header));
    const nameIndex = headers.findIndex((header) => /书籍基础信息|书名/.test(header));
    const originalNameIndex = headers.findIndex((header) => /原书名/.test(header));
    const rows = Array.from(document.querySelectorAll(".ant-table-tbody tr")).filter(
      (row) => !row.querySelector(".ant-empty") && normalize(row.innerText)
    );

    return rows
      .map((row, rowIndex) => {
        const cells = Array.from(row.querySelectorAll("td")).map((td) => normalize(td.innerText));
        const rowText = normalize(row.innerText);
        const idText = idIndex >= 0 ? cells[idIndex] : rowText;
        const idMatch = idText.match(/\b\d{5,}\b/) || rowText.match(/\b\d{5,}\b/);
        const bookId = idMatch ? idMatch[0] : "";
        return {
          rowIndex,
          addedTime: addedTimeIndex >= 0 ? cells[addedTimeIndex] : "",
          bookId,
          bookName: nameIndex >= 0 ? cells[nameIndex] : "",
          originalBookName: originalNameIndex >= 0 ? cells[originalNameIndex] : "",
          text: rowText.slice(0, 500),
          hasPromotionButton: Array.from(row.querySelectorAll("button, a")).some((el) => /推广/.test(normalize(el.innerText))),
        };
      })
      .filter((book) => book.bookId);
  });
}

async function clickPromoteForBook(page, bookId) {
  const platformUrl = new URL(readPlatformUrl());
  const chapterUrl = new URL("/backend/book-manage/book-content/chapter-detail", platformUrl.origin);
  chapterUrl.searchParams.set("book_id", bookId);
  for (const key of ["projectId", "appId", "accountId"]) {
    const value = platformUrl.searchParams.get(key);
    if (value) chapterUrl.searchParams.set(key, value);
  }
  log(`打开章节明细：${chapterUrl.toString()}`);
  await page.goto(chapterUrl.toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForLoadState("domcontentloaded", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(5000);
}

function buildPlatformUrl(pathname) {
  const platformUrl = new URL(readPlatformUrl());
  const target = new URL(pathname, platformUrl.origin);
  for (const key of ["projectId", "appId", "accountId"]) {
    const value = platformUrl.searchParams.get(key);
    if (value) target.searchParams.set(key, value);
  }
  return target.toString();
}

async function searchBookById(page, bookId) {
  await page.goto(readPlatformUrl(), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await clickAllLibrary(page);
  const bookIdInput = page.locator('input[placeholder="书籍ID"]').first();
  if (await bookIdInput.isVisible({ timeout: 15000 }).catch(() => false)) {
    await bookIdInput.fill(bookId);
    log(`已填写书籍ID搜索框：${bookId} (placeholder=书籍ID)`);
    await clickQuery(page);
    const books = await extractBooks(page);
    if (!books.some((book) => book.bookId === bookId)) throw new Error(`书籍ID 查询后没有找到：${bookId}`);
    return;
  }
  const result = await page.evaluate((id) => {
    const normalize = (text) => (text || "").replace(/\s+/g, " ").trim();
    const isVisible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const inputs = Array.from(document.querySelectorAll("input")).filter(isVisible);
    const describe = (input) => {
      const formItem = input.closest(".ant-form-item");
      const parent = input.closest(".ant-row, .ant-col, form, section, div");
      return normalize(
        [
          input.placeholder,
          input.getAttribute("aria-label"),
          input.title,
          formItem && formItem.innerText,
          parent && parent.innerText,
        ]
          .filter(Boolean)
          .join(" ")
      );
    };
    const candidates = inputs.map((input) => ({ input, text: describe(input) }));
    let match = candidates.find((item) => /书籍ID|书籍\s*ID|book\s*id/i.test(item.text));
    if (!match) {
      match = candidates.find((item) => /书籍/.test(item.text) && !/书名|名称/.test(item.text));
    }
    if (!match) {
      const labelNodes = Array.from(document.querySelectorAll("label, span, div")).filter((el) =>
        /书籍ID|书籍\s*ID/.test(normalize(el.innerText || el.textContent))
      );
      for (const label of labelNodes) {
        const rect = label.getBoundingClientRect();
        match = candidates.find((item) => {
          const inputRect = item.input.getBoundingClientRect();
          return Math.abs(inputRect.top - rect.top) < 80 && inputRect.left > rect.left;
        });
        if (match) break;
      }
    }
    if (!match) {
      return {
        ok: false,
        inputs: candidates.map((item, index) => ({
          index,
          placeholder: item.input.placeholder || "",
          text: item.text.slice(0, 160),
        })),
      };
    }
    const input = match.input;
    input.focus();
    input.select();
    input.value = id;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true, matched: match.text.slice(0, 160) };
  }, bookId);
  if (!result.ok) {
    log(`没有找到顶部书籍ID输入框，可见输入框=${JSON.stringify(result.inputs || [])}`);
    throw new Error("没有找到顶部“书籍ID”输入框");
  }
  log(`已填写书籍ID搜索框：${bookId} (${result.matched})`);
  await clickQuery(page);
  const books = await extractBooks(page);
  if (!books.some((book) => book.bookId === bookId)) throw new Error(`书籍ID 查询后没有找到：${bookId}`);
}

async function openPromotionLinkPage(page) {
  await page.goto(buildPlatformUrl("/backend/link-manage/promotion-link"), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.locator('input[placeholder="推广书籍ID"]').first().waitFor({ state: "visible", timeout: 20000 });
}

async function searchPromotionLinkByBookId(page, bookId) {
  await openPromotionLinkPage(page);
  await page.locator('input[placeholder="推广书籍ID"]').first().fill(bookId);
  await clickQuery(page);
  const clicked = await page.evaluate((targetBookId) => {
    const normalize = (text) => (text || "").replace(/\s+/g, " ").trim();
    const rows = Array.from(document.querySelectorAll(".ant-table-tbody tr")).filter((row) =>
      normalize(row.innerText).includes(targetBookId)
    );
    const row = rows[0];
    if (!row) return { ok: false, reason: "row-not-found", body: normalize(document.body.innerText).slice(0, 800) };
    const view = Array.from(row.querySelectorAll("button, a")).find((el) => normalize(el.innerText || el.textContent) === "查看");
    if (!view) return { ok: false, reason: "view-not-found", row: normalize(row.innerText) };
    view.click();
    return { ok: true, row: normalize(row.innerText) };
  }, bookId);
  if (!clicked.ok) throw new Error(`推广链接页没有找到可查看记录：${bookId} ${JSON.stringify(clicked)}`);
  await page.waitForTimeout(1500);
  log(`已打开推广链接查看：${bookId}`);
}

async function extractPromotionLaunchInfo(page) {
  const info = await page.evaluate(() => {
    const normalize = (text) => (text || "").replace(/\s+/g, " ").trim();
    const body = normalize(document.body.innerText);
    const launchPage = body.match(/启动页面\s+(\S+)/)?.[1] || "";
    const launchParams = body.match(/启动参数\s+(\S+)/)?.[1] || "";
    const fullLink = body.match(/推广链接\s+(\S+)/)?.[1] || "";
    return { launchPage, launchParams, fullLink, body: body.slice(0, 1200) };
  });
  if (!info.launchPage || !info.launchParams) {
    throw new Error(`没有识别到启动页面/启动参数：${JSON.stringify(info)}`);
  }
  return info;
}

async function clickChapterOneGenerate(page) {
  log(`进入章节页：${page.url()}`);
  const buttons = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button, a"))
      .map((el) => (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 120)
  );
  log(`章节页按钮/链接：${buttons.join(" | ")}`);

  const clicked = await page.evaluate(() => {
    const normalize = (text) => (text || "").replace(/\s+/g, " ").trim();
    const direct = document.querySelector('.chapter-detail-container button[label="生成推广链接"]');
    if (direct) {
      direct.click();
      return { ok: true, text: normalize(direct.innerText || direct.textContent), method: "chapter-detail-container" };
    }
    const isVisible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const buttons = Array.from(document.querySelectorAll("button, a")).filter(
      (el) => normalize(el.innerText || el.textContent).includes("生成推广链接") && isVisible(el)
    );
    if (!buttons.length) return { ok: false, visibleTexts: Array.from(document.querySelectorAll("button, a")).filter(isVisible).map((el) => normalize(el.innerText || el.textContent)).slice(0, 80) };
    buttons[0].click();
    return { ok: true, text: normalize(buttons[0].innerText || buttons[0].textContent) };
  });
  if (!clicked.ok) {
    log(`DOM 未点中“生成推广链接”，改用坐标点击；可见按钮=${(clicked.visibleTexts || []).join(" | ")}`);
    await page.mouse.click(config.chapterOneGenerateClick.x, config.chapterOneGenerateClick.y);
  }
  await page.waitForTimeout(1000);
}

async function fillInputByLabel(page, labelText, value) {
  const ok = await page.evaluate(({ labelText: label, value: inputValue }) => {
    const normalize = (text) => (text || "").replace(/\s+/g, " ").trim();
    const formItems = Array.from(document.querySelectorAll(".ant-modal .ant-form-item"));
    const box = formItems.find((el) => {
      const labelEl = el.querySelector(".ant-form-item-label");
      return labelEl && normalize(labelEl.innerText).includes(label);
    });
    const input = box && box.querySelector("input");
    if (!input) return false;
    input.focus();
    input.select();
    input.value = inputValue;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, { labelText, value });
  if (!ok) throw new Error(`没有找到输入框：${labelText}`);
}

async function selectTemplate(page, templateName) {
  const opened = await page.evaluate(() => {
    const normalize = (text) => (text || "").replace(/\s+/g, " ").trim();
    const formItems = Array.from(document.querySelectorAll(".ant-modal .ant-form-item"));
    const box = formItems.find((el) => {
      const labelEl = el.querySelector(".ant-form-item-label");
      return labelEl && normalize(labelEl.innerText).includes("充值模板");
    });
    const selector = box && box.querySelector(".ant-select-selector");
    if (!selector) return false;
    selector.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    selector.click();
    return true;
  });
  if (!opened) throw new Error("没有找到充值模板下拉框");
  await page.waitForTimeout(800);
  const option = page.locator(`.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option:has-text("${templateName}")`).first();
  await option.waitFor({ state: "visible", timeout: 10000 });
  await option.click();
}

async function fillPromotionDialog(page, bookId, templateName) {
  await fillInputByLabel(page, "创建数量", config.defaultCreateCount);
  await fillInputByLabel(page, "链接名称", bookId);
  await selectTemplate(page, templateName);
  const state = await page.evaluate(() => {
    const normalize = (text) => (text || "").replace(/\s+/g, " ").trim();
    const readInput = (label) => {
      const item = Array.from(document.querySelectorAll(".ant-modal .ant-form-item")).find((el) => {
        const labelEl = el.querySelector(".ant-form-item-label");
        return labelEl && normalize(labelEl.innerText).includes(label);
      });
      return item && item.querySelector("input") ? item.querySelector("input").value : "";
    };
    const templateItem = Array.from(document.querySelectorAll(".ant-modal .ant-form-item")).find((el) => {
      const labelEl = el.querySelector(".ant-form-item-label");
      return labelEl && normalize(labelEl.innerText).includes("充值模板");
    });
    return {
      createCount: readInput("创建数量"),
      linkName: readInput("链接名称"),
      template: templateItem ? normalize(templateItem.innerText).replace(/^充值模板/, "") : "",
    };
  });
  log(`弹窗已填写：创建数量=${state.createCount}，链接名称=${state.linkName}，充值模板=${state.template}`);

  if (config.dryRun) {
    log(`dryRun=true，已填弹窗但未点击确定。书籍ID=${bookId}，模板=${templateName}`);
    return;
  }

  const okButton = page.locator('.ant-modal button:has-text("确 定"), .ant-modal button:has-text("确定")').last();
  await okButton.waitFor({ state: "visible", timeout: 10000 });
  await okButton.click();
  await page.waitForTimeout(2000);
}

async function clickChapterViewContent(page, chapterNo) {
  const clicked = await page.evaluate((targetChapterNo) => {
    const normalize = (text) => (text || "").replace(/\s+/g, " ").trim();
    const isVisible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const rows = Array.from(document.querySelectorAll(".ant-table-tbody tr")).filter(isVisible);
    const row = rows.find((tr) => {
      const cells = Array.from(tr.querySelectorAll("td")).map((td) => normalize(td.innerText));
      return cells[0] === targetChapterNo;
    });
    const action = row && Array.from(row.querySelectorAll("button, a")).find((el) => normalize(el.innerText || el.textContent).includes("查看内容"));
    if (!action) return false;
    action.click();
    return true;
  }, String(chapterNo));
  if (!clicked) return false;
  await page.waitForURL(/content-detail/, { timeout: 30000 });
  await page.waitForLoadState("domcontentloaded", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return true;
}

async function returnToChapterList(page, chapterListUrl) {
  if (chapterListUrl) {
    await page.goto(chapterListUrl, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  } else {
    await page.goBack({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  }
  await page.waitForURL(/chapter-detail/, { timeout: 30000 }).catch(() => {});
  await page.waitForLoadState("domcontentloaded", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
}

async function extractChapterContent(page) {
  const copyButton = page.locator('button:has-text("复制本章内容")').first();
  await copyButton.waitFor({ state: "visible", timeout: 20000 });
  await copyButton.click().catch(() => {});
  await page.waitForTimeout(800);

  return page.evaluate(() => {
    const normalizeLine = (line) => (line || "").replace(/\s+/g, " ").trim();
    const bodyText = document.body.innerText || "";
    const bookMatch = bodyText.match(/书名[:：]\s*(.*?)\s*(?:\||章节序号[:：])/);
    const chapterMatch = bodyText.match(/章节序号[:：]\s*(\d+)/);
    const lines = bodyText.split(/\r?\n/).map(normalizeLine).filter(Boolean);
    const start = lines.findIndex((line) => /^第\d+章/.test(line));
    let end = lines.findIndex((line, index) => index > start && line.includes("返回目录"));
    if (end < 0) end = lines.findIndex((line, index) => index > start && line.includes("复制本章内容"));
    const contentLines = start >= 0 ? lines.slice(start, end > start ? end : undefined) : [];
    return {
      bookName: bookMatch ? bookMatch[1].trim() : "",
      chapterNo: chapterMatch ? chapterMatch[1] : "1",
      content: contentLines.join("\n\n"),
    };
  });
}

async function extractFirstFiveChapterContents(page) {
  const chapters = [];
  const chapterListUrl = page.url();
  for (const chapterNo of ["1", "2", "3", "4", "5"]) {
    const clicked = await clickChapterViewContent(page, chapterNo);
    if (!clicked) {
      log(`章节${chapterNo}没有找到“查看内容”，跳过。`);
      continue;
    }
    const chapter = await extractChapterContent(page);
    if (chapter.content) chapters.push({ ...chapter, chapterNo });
    await returnToChapterList(page, chapterListUrl);
  }
  if (!chapters.length) throw new Error("章节页没有找到第1-5章可复制内容");
  const bookName = chapters.find((chapter) => chapter.bookName).bookName || "";
  return {
    bookName,
    chapterNo: chapters.map((chapter) => chapter.chapterNo).join(","),
    content: chapters.map((chapter) => chapter.content).join("\n\n"),
  };
}

async function sendChapterToWechatAndBuildLabel(page, feishuReservation) {
  const chapter = await extractFirstFiveChapterContents(page);
  if (!chapter.bookName) throw new Error("Book name was not found; cannot create txt file");
  if (!chapter.content) throw new Error("Chapter content was not extracted");
  log(`已复制章节内容：${chapter.chapterNo}`);

  const filePath = writeBookTextFile(config.outputDir, chapter.bookName, chapter.content);
  log(`Saved chapter txt: ${filePath}`);
  if (config.latestChapterTextFile) {
    const movableFile = writeMovableChapterTextFile(config.latestChapterTextFile, chapter.bookName, chapter.content);
    log(`Saved movable chapter txt: ${movableFile}`);
  }

  if (config.sendNovelToWechat) {
    const webhookText = fs.readFileSync(config.wechatWebhookFile, "utf8");
    await sendWechatFile(webhookText, filePath);
    log(`Wechat file sent: ${path.basename(filePath)}`);
  } else {
    log("Wechat novel file sending is disabled");
  }

  const topicLabel = await buildTopicLabel(chapter.bookName, chapter.content, {
    apiKeyFile: config.deepseekApiKeyFile,
    baseUrl: config.deepseekApiBaseUrl,
    model: config.deepseekModel,
    timeoutMs: config.deepseekTimeoutMs,
    forbiddenWordsFile: config.forbiddenWordsFile,
    onFallback: log,
  });
  const label = formatFeishuLabel(chapter.bookName, topicLabel);
  log(`Built topics: ${label}`);
  if (feishuReservation) {
    const result = await writeFeishuReservedRowValues({
      apiFile: config.feishuApiFile,
      tableLinkFile: config.feishuTableLinkFile,
      row: feishuReservation.row,
      range: `E${feishuReservation.row}:E${feishuReservation.row}`,
      values: [[label]],
    });
    log(`Wrote Feishu label: ${result.sheetId}!E${result.row} ${label}`);
  }
  return { chapter, label };
}
async function writeFeishuCompletionRow(feishuReservation, chapter, label, promotionInfo, manualFeishuNames) {
  const producer = nextProducer();
  const safeBookName = normalizeOutputBookTitle(chapter.bookName);
  const feishuBookName = manualFeishuNames ? chooseManualFeishuBookName(safeBookName, manualFeishuNames) : safeBookName;
  const values = [[todayText(), feishuBookName, producer, "飞", label, promotionInfo.launchPage, promotionInfo.launchParams]];
  const result = await writeFeishuReservedRowValues({
    apiFile: config.feishuApiFile,
    tableLinkFile: config.feishuTableLinkFile,
    row: feishuReservation.row,
    range: `A${feishuReservation.row}:G${feishuReservation.row}`,
    values,
  });
  log(`已写入飞书完整行：${result.sheetId}!A${result.row}:G${result.row} 书名=${feishuBookName} 制作人=${producer}`);
}

async function processBook(context, page, target, templateName, seenSet, seenOriginalTitleKeys, seenFile, runFailures, manualFeishuNames, isManualBatch) {
  log(`Start book: ${target.bookId} ${target.bookName || ""}`);
  let feishuReservation = null;
  let stage = "reserve feishu row";
  let resetBrowser = false;
  let timedOut = false;
  const timeoutMs = config.singleBookTimeoutMs || 300000;
  try {
    if (!config.dryRun && config.sendChapterAfterPromotion) {
      feishuReservation = await reserveFeishuRow({
        apiFile: config.feishuApiFile,
        tableLinkFile: config.feishuTableLinkFile,
      });
      writeJson(path.join(config.dataDir, "current_task.json"), {
        bookId: target.bookId,
        bookName: target.bookName || "",
        feishuSheetId: feishuReservation.sheetId,
        feishuRow: feishuReservation.row,
        reservedAt: nowChinaText(),
      });
      log(`Reserved Feishu row: ${feishuReservation.sheetId}!A${feishuReservation.row}:G${feishuReservation.row}`);
    }

    stage = "search book id";
    await withTimeout(
      async () => {
        await searchBookById(page, target.bookId);
        stage = "generate promotion link";
        await clickPromoteForBook(page, target.bookId);
        await clickChapterOneGenerate(page);
        await fillPromotionDialog(page, target.bookId, templateName);
        let chapterResult = null;
        if (!config.dryRun && config.sendChapterAfterPromotion) {
          stage = "wechat/local-topics/feishu";
          chapterResult = await sendChapterToWechatAndBuildLabel(page, feishuReservation);
          stage = "promotion link / feishu completion row";
          await searchPromotionLinkByBookId(page, target.bookId);
          const promotionInfo = await extractPromotionLaunchInfo(page);
          await writeFeishuCompletionRow(feishuReservation, chapterResult.chapter, chapterResult.label, promotionInfo, manualFeishuNames);
        }
      },
      timeoutMs,
      `single book timeout after ${Math.round(timeoutMs / 1000)}s: ${target.bookId}`,
      async () => {
        timedOut = true;
        resetBrowser = true;
        log(`Single book timed out; closing dedicated Chrome: ${target.bookId}`);
        await closeDedicatedBrowser(context);
      }
    );

    if (!config.dryRun) {
      seenSet.add(target.bookId);
      if (!isManualBatch) recordTodayDeduplicatedAutomaticBook(target);
      if (!isManualBatch && config.duplicateBookTitleMode === "without-number") {
        const titleKey = duplicateBookTitleKey(target);
        if (titleKey) seenOriginalTitleKeys.add(titleKey);
      }
      writeJson(seenFile, {
        bookIds: Array.from(seenSet).sort(),
        originalTitleKeys: Array.from(seenOriginalTitleKeys).sort(),
        updatedAt: nowChinaText(),
      });
      log(`Recorded ${isManualBatch ? "manual" : "automatic"} book ID: ${target.bookId}`);
    } else {
      log("dryRun does not write seen_books.json.");
    }
  } catch (error) {
    resetBrowser = resetBrowser || shouldResetBrowserAfterError(error);
    const failure = {
      bookId: target.bookId,
      bookName: target.bookName || "",
      stage,
      error: error.stack || error.message,
      feishuRow: feishuReservation && feishuReservation.row,
    };
    const result = await recordFailure(failure);
    if (result.shouldNotify) runFailures.push(result.failure);
    await clearReservedFeishuRow(feishuReservation);
    if (!resetBrowser) await page.goto(readPlatformUrl(), { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
    if (timedOut) log(`Single book timeout was recorded; continuing: ${target.bookId}`);
  } finally {
    removeCurrentTask();
  }
  return { resetBrowser };
}
async function main() {
  ensureDir(config.dataDir);
  const cleanup = cleanupOldFiles(config);
  if (cleanup.removed.length) log(`已清理超过 ${cleanup.retentionHours} 小时的日志/临时文件：${cleanup.removed.length} 个`);
  const seenFile = path.join(config.dataDir, "seen_books.json");
  const seen = readJson(seenFile, { bookIds: [] });
  const seenSet = new Set(seen.bookIds || []);
  const seenOriginalTitleKeys = new Set(seen.originalTitleKeys || []);
  const templates = readTemplateNames();
  const templateName = templates[0];
  if (!templateName) throw new Error(`充值模板目录没有 txt 模板：${config.templateDir}`);

  log(`启动一次试跑。dryRun=${config.dryRun}，模板=${templateName}`);
  let context;
  let page;
  const releaseLock = acquireProcessLock(path.join(config.dataDir, "run-once.lock"), "run-once");
  try {
  await recoverReservedCurrentTask();
  ({ context, page } = await openBrowserContext());

  if (page.url().includes("/login")) {
    log("当前是登录页，请先在打开的 Chrome 中手动登录，然后重新运行 npm run run-once。");
    return;
  }

  const books = await scanBooksAcrossPages(page, config.scanPageCount || 10);
  log(`本次扫描 ${config.scanPageCount || 10} 页，共读取到 ${books.length} 个唯一书籍ID。`);
  const today = todayText();
  const todayBooks = filterBooksByAddedDate(books, today);
  const todayScanFile = path.join(config.dataDir, "today_scan.json");
  const previousTodayScan = readJson(todayScanFile, {});
  const todayBookIds = new Set(previousTodayScan.date === today ? previousTodayScan.bookIds || [] : []);
  const todayBooksById = new Map(
    (previousTodayScan.date === today ? previousTodayScan.books || [] : [])
      .filter((book) => book && book.bookId)
      .map((book) => [String(book.bookId), book])
  );
  for (const book of todayBooks) todayBookIds.add(book.bookId);
  for (const book of todayBooks) {
    todayBooksById.set(String(book.bookId), {
      bookId: String(book.bookId),
      bookName: String(book.bookName || ""),
      originalBookName: String(book.originalBookName || book.originalTitle || ""),
    });
  }
  writeJson(todayScanFile, {
    date: today,
    bookIds: Array.from(todayBookIds).sort(),
    books: Array.from(todayBooksById.values()).sort((left, right) => String(left.bookId).localeCompare(String(right.bookId))),
    lastScanBookIds: Array.from(new Set(todayBooks.map((book) => book.bookId))).sort(),
    updatedAt: nowChinaText(),
  });
  log(`今日添加书籍：本次 ${todayBooks.length} 本，累计 ${todayBookIds.size} 本（添加时间=${today}）。`);

  const singleBookQuery = String(process.env.SINGLE_BOOK_QUERY || process.env.SINGLE_BOOK_ID || "").trim();
  const manualBookIds = parseManualBookIds(process.env.MANUAL_BOOK_IDS || "");
  let singleBookId = "";
  if (singleBookQuery) {
    if (/^\d+$/.test(singleBookQuery)) {
      singleBookId = singleBookQuery;
    } else {
      const matches = findBooksByTitle(todayBooks, singleBookQuery);
      if (!matches.length) throw new Error(`今天新增书籍中未找到完整匹配书名：${singleBookQuery}`);
      if (matches.length > 1) throw new Error(`书名存在多个匹配，请改为输入书籍ID：${matches.map((book) => `${book.bookId} ${book.bookName}`).join("；")}`);
      singleBookId = matches[0].bookId;
    }
  }
  const processAllScanned = process.env.QIMAO_PROCESS_ALL_SCANNED === "1";
  const isManualBatch = manualBookIds.length > 0;
  const failureState = readBlockedFailureBookIds();
  const detectedBooks = isManualBatch
    ? manualBookIds.map((bookId) => books.find((book) => book.bookId === bookId) || { bookId, bookName: "" })
    : selectDetectedBooks({ books: todayBooks, seenSet, singleBookId, processAllScanned });
  if (singleBookId && seenSet.has(singleBookId)) {
    log(`指定书籍已完成，跳过：${singleBookId}`);
    return;
  }
  const unblockedBooks = isManualBatch ? detectedBooks : detectedBooks.filter((book) => !failureState.blockedBookIds.has(book.bookId));
  const retryableBooks = isManualBatch ? detectedBooks : unblockedBooks.filter((book) => !failureState.coolingDownBookIds.has(book.bookId));
  let newBooks = retryableBooks;
  let manualFeishuNames = null;
  if (isManualBatch && !config.dryRun) {
    manualFeishuNames = new Set(await readFeishuBookNames({ apiFile: config.feishuApiFile, tableLinkFile: config.feishuTableLinkFile }));
  } else if (!config.dryRun && config.feishuCompletionFallback !== false) {
    const feishuBookNames = await readFeishuBookNames({
      apiFile: config.feishuApiFile,
      tableLinkFile: config.feishuTableLinkFile,
    });
    const fallback = filterBooksAlreadyInFeishu(retryableBooks, feishuBookNames);
    for (const book of fallback.completed) {
      seenSet.add(book.bookId);
      if (config.duplicateBookTitleMode === "without-number") {
        const titleKey = duplicateBookTitleKey(book);
        if (titleKey) seenOriginalTitleKeys.add(titleKey);
      }
      log(`飞书B列已存在书名，视为已完成并跳过：${book.bookId} ${book.bookName || ""}`);
    }
    if (fallback.completed.length) {
      writeJson(seenFile, {
        bookIds: Array.from(seenSet).sort(),
        originalTitleKeys: Array.from(seenOriginalTitleKeys).sort(),
        updatedAt: nowChinaText(),
      });
    }
    newBooks = fallback.pending;
  }
  if (failureState.blockedBookIds.size) log(`失败满 ${config.maxFailureAttempts || 3} 次的书籍已跳过：${failureState.blockedBookIds.size} 本。`);
  if (failureState.coolingDownBookIds.size) log(`未到下一次重试时间的书籍本轮跳过：${failureState.coolingDownBookIds.size} 本。`);
  if (processAllScanned) log("一键出完今日书模式：本轮扫描到的书都会先检查飞书B列，书名已存在则跳过。");
  if (isManualBatch) log(`MANUAL_BOOK_IDS=${manualBookIds.join(",")}，强制重新处理 ${manualBookIds.length} 本书。`);
  if (singleBookId) log(`SINGLE_BOOK_ID=${singleBookId}，本轮只处理匹配的单本书。`);
  if (!newBooks.length) {
    log(singleBookId ? `指定书籍ID不是今日添加或已失败满 ${config.maxFailureAttempts || 3} 次，跳过：${singleBookId}` : "没有发现今日待处理书籍。");
    return;
  }

  log(`发现 ${newBooks.length} 本今日待处理书籍，本次会全部处理。`);
  const runFailures = [];
  for (const target of newBooks) {
    const titleKey = duplicateBookTitleKey(target);
    if (!isManualBatch && config.duplicateBookTitleMode === "without-number" && titleKey && seenOriginalTitleKeys.has(titleKey)) {
      log(`原书名已完成，跳过重复书籍：${target.bookId} ${target.bookName || ""}（原书名=${target.originalBookName || titleKey}）`);
      continue;
    }
    const result = await processBook(context, page, target, templateName, seenSet, seenOriginalTitleKeys, seenFile, runFailures, manualFeishuNames, isManualBatch);
    if (result && result.resetBrowser) {
      log("Browser context was reset before next book.");
      await closeDedicatedBrowser(context);
      ({ context, page } = await openBrowserContext());
    }
  }
  await notifyFailureSummary(runFailures);
  } catch (error) {
    if (context) {
      const pages = context.pages();
      const page = pages[pages.length - 1];
      if (page) {
        const debugDir = config.failedDir || path.join(config.logDir, "debug");
        ensureDir(debugDir);
        const stamp = nowStampText();
        await page.screenshot({ path: path.join(debugDir, `${stamp}.png`), fullPage: true }).catch(() => {});
        await fs.promises.writeFile(path.join(debugDir, `${stamp}.html`), await page.content().catch(() => ""), "utf8").catch(() => {});
        log(`已保存调试截图/HTML：${debugDir}`);
      }
    }
    throw error;
  } finally {
    await closeDedicatedBrowser(context);
    releaseLock();
  }
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  log(`运行失败：${error.stack || error.message}`);
  const failure = {
    stage: "整轮检测",
    error: error.stack || error.message,
  };
  recordFailure(failure)
    .then((result) => {
      if (result.shouldNotify) return notifyFailure(result.failure);
      return null;
    })
    .catch(() => {});
  process.exitCode = 1;
});
