const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");
const { resolveAppRoot } = require("./desktop-paths");
const { loadConfig } = require("./runtime-config");
const { requireChromeExecutable } = require("./chrome-utils");
const rootDir = resolveAppRoot();
const config = loadConfig();
config.chromeExecutable = requireChromeExecutable(config.chromeExecutable);
const { mergeBooksById } = require("./platform-utils");
const { nowChinaText } = require("./time-utils");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readPlatformUrl() {
  return fs.readFileSync(config.platformLinkFile, "utf8").trim();
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
  console.log("已点击：全部书库");
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

async function extractBookIds(page) {
  return page.evaluate(() => {
    const normalize = (text) => (text || "").replace(/\s+/g, " ").trim();
    const headers = Array.from(document.querySelectorAll(".ant-table-thead th")).map((th) => normalize(th.innerText));
    const idIndex = headers.findIndex((header) => /书籍ID/.test(header));
    return Array.from(document.querySelectorAll(".ant-table-tbody tr"))
      .map((row) => {
        const cells = Array.from(row.querySelectorAll("td")).map((td) => normalize(td.innerText));
        const text = idIndex >= 0 ? cells[idIndex] : normalize(row.innerText);
        return (text.match(/\b\d{5,}\b/) || [])[0];
      })
      .filter(Boolean);
  });
}

async function extractBooks(page) {
  const bookIds = await extractBookIds(page);
  return bookIds.map((bookId) => ({ bookId }));
}

async function scanBooksAcrossPages(page, pageCount) {
  await clickAllLibrary(page);
  await clickQuery(page);
  await goToFirstPage(page);
  const pages = [];
  for (let index = 1; index <= pageCount; index += 1) {
    const books = await extractBooks(page);
    console.log(`扫描第 ${index}/${pageCount} 页，读取到 ${books.length} 本书。`);
    pages.push(books);
    if (index < pageCount) {
      const moved = await clickNextPage(page);
      if (!moved) throw new Error(`扫描未完成：第 ${index} 页后无法翻到下一页`);
    }
  }
  return mergeBooksById(pages);
}

async function main() {
  ensureDir(config.dataDir);
  const seenFile = path.join(config.dataDir, "seen_books.json");
  if (fs.existsSync(seenFile)) {
    fs.copyFileSync(seenFile, path.join(config.dataDir, `seen_books.backup-${Date.now()}.json`));
  }

  const context = await chromium.launchPersistentContext(config.chromeProfileDir, {
    executablePath: config.chromeExecutable,
    headless: false,
    viewport: null,
    args: ["--start-maximized", "--no-first-run"],
  });
  try {
    const page = context.pages()[0] || await context.newPage();
    await page.goto(readPlatformUrl(), { waitUntil: "domcontentloaded", timeout: 60000 });
    if (page.url().includes("/login")) {
      throw new Error("当前是登录页，请先运行“打开登录页面.bat”并完成登录。");
    }
    const books = await scanBooksAcrossPages(page, config.scanPageCount || 10);
    const bookIds = books.map((book) => book.bookId).sort();
    fs.writeFileSync(seenFile, JSON.stringify({ bookIds, updatedAt: nowChinaText() }, null, 2), "utf8");
    console.log(`重建基准完成：前 ${config.scanPageCount || 10} 页共 ${bookIds.length} 本书已视为完成。`);
  } finally {
    await context.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`重建基准失败：${error.stack || error.message}`);
  process.exitCode = 1;
});
