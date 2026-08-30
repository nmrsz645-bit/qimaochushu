const fs = require("fs");
const https = require("https");
const { normalizeOutputBookTitle } = require("./compliance-topic-utils");

function request(method, url, token, bodyObject) {
  return new Promise((resolve, reject) => {
    const body = bodyObject ? JSON.stringify(bodyObject) : "";
    const target = new URL(url);
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body) {
      headers["Content-Type"] = "application/json; charset=utf-8";
      headers["Content-Length"] = Buffer.byteLength(body);
    }
    const req = https.request(
      {
        hostname: target.hostname,
        path: `${target.pathname}${target.search}`,
        method,
        headers,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => resolve(JSON.parse(data)));
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function readFeishuCredentials(file) {
  const text = fs.readFileSync(file, "utf8");
  const appId = text.match(/App ID：\s*(\S+)/)?.[1];
  const appSecret = text.match(/App Secret：\s*(\S+)/)?.[1];
  if (!appId || !appSecret) throw new Error("飞书api文件里没有找到 App ID / App Secret");
  return { appId, appSecret };
}

async function getTenantAccessToken({ appId, appSecret }) {
  const result = await request("POST", "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", null, {
    app_id: appId,
    app_secret: appSecret,
  });
  if (result.code !== 0) throw new Error(`获取飞书 tenant_access_token 失败：${JSON.stringify(result)}`);
  return result.tenant_access_token;
}

function extractWikiNodeToken(link) {
  const token = String(link || "").match(/\/wiki\/([^?]+)/)?.[1];
  if (!token) throw new Error("飞书表格链接只支持 /wiki/ 或 /sheets/ 格式");
  return token;
}

function extractSpreadsheetToken(link) {
  return String(link || "").match(/\/sheets\/([^?/#]+)/)?.[1] || "";
}

async function resolveSpreadsheetTokenFromWikiLink(link, tenantAccessToken) {
  const directToken = extractSpreadsheetToken(link);
  if (directToken) return directToken;
  const nodeToken = extractWikiNodeToken(link);
  const result = await request(
    "GET",
    `https://open.feishu.cn/open-apis/wiki/v2/spaces/get_node?token=${nodeToken}`,
    tenantAccessToken
  );
  if (result.code !== 0) throw new Error(`解析飞书 wiki 链接失败：${JSON.stringify(result)}`);
  if (result.data.node.obj_type !== "sheet") throw new Error(`飞书链接不是电子表格：${result.data.node.obj_type}`);
  return result.data.node.obj_token;
}

async function getFirstSheetId(spreadsheetToken, tenantAccessToken) {
  const sheets = await getSheetMetas(spreadsheetToken, tenantAccessToken);
  const sheet = sheets.find((item) => !item.hidden) || sheets[0];
  if (!sheet) throw new Error("飞书表格里没有工作表");
  return sheet.sheet_id;
}

async function getSheetMetas(spreadsheetToken, tenantAccessToken) {
  const result = await request(
    "GET",
    `https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/${spreadsheetToken}/sheets/query`,
    tenantAccessToken
  );
  if (result.code !== 0) throw new Error(`读取飞书工作表失败：${JSON.stringify(result)}`);
  return result.data.sheets || [];
}

async function readSheetValues(spreadsheetToken, range, tenantAccessToken) {
  const result = await request(
    "GET",
    `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${encodeURIComponent(range)}`,
    tenantAccessToken
  );
  if (result.code !== 0) throw new Error(`读取飞书单元格失败：${JSON.stringify(result)}`);
  return result.data.valueRange.values || [];
}

async function writeSheetValues(spreadsheetToken, range, values, tenantAccessToken) {
  const result = await request(
    "PUT",
    `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values`,
    tenantAccessToken,
    { valueRange: { range, values } }
  );
  if (result.code !== 0) throw new Error(`写入飞书单元格失败：${JSON.stringify(result)}`);
  return result.data;
}

function normalizeDoubaoLabel(text) {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const shortLine = lines.filter((line) => /^短视频版[:：]/.test(line)).pop();
  let label = shortLine ? shortLine.replace(/^短视频版[:：]\s*/, "").trim() : lines[lines.length - 1] || "";
  if (!label) throw new Error("豆包回复为空，不能生成飞书标签");
  if (!/#热门小说\s*$/.test(label)) label = `${label} #热门小说`;
  return label;
}

function formatFeishuLabel(bookName, label, maxLength = 55) {
  const cleanBookName = normalizeOutputBookTitle(bookName).replace(/[《》]/g, "").trim();
  if (!cleanBookName) throw new Error("书名为空，不能写入飞书标签");
  const cleanLabel = String(label || "").trim();
  if (!cleanLabel) throw new Error("标签为空，不能写入飞书");
  const wrappedBookName = `《${cleanBookName}》`;
  const hotTopic = "#热门小说";
  const limit = Number.isFinite(Number(maxLength)) ? Number(maxLength) : 55;
  if (`${wrappedBookName}${hotTopic}`.length > limit) return wrappedBookName;

  const tags = cleanLabel.split(/\s+/).filter((tag) => tag.startsWith("#"));
  const selected = [];
  for (const tag of tags) {
    if (tag === hotTopic || selected.includes(tag)) continue;
    const next = `${wrappedBookName}${[...selected, tag, hotTopic].join(" ")}`;
    if (next.length <= limit) selected.push(tag);
  }
  return `${wrappedBookName}${[...selected, hotTopic].join(" ")}`;
}

function isSheetRowEmpty(row) {
  return !row || row.every((cell) => cell === undefined || cell === null || String(cell).trim() === "");
}

function lastDataRow(values) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (!isSheetRowEmpty(values[index])) return index + 1;
  }
  return 1;
}

function candidateReservationRow(values) {
  return lastDataRow(values) + 2;
}

function buildReservationValues() {
  return [["1", "1", "1", "1", "1", "1", "1"]];
}

function buildClearReservationValues() {
  return [["", "", "", "", "", "", ""]];
}

function extractBookNamesFromSheetValues(values) {
  const rows = values || [];
  let headerRowIndex = -1;
  let bookNameColumnIndex = 1;
  const scanRows = rows.slice(0, 20);
  for (let rowIndex = 0; rowIndex < scanRows.length; rowIndex += 1) {
    const row = scanRows[rowIndex] || [];
    const columnIndex = row.findIndex((cell) => /^书名$|书名|作品名|小说名/.test(String(cell || "").trim()));
    if (columnIndex >= 0) {
      headerRowIndex = rowIndex;
      bookNameColumnIndex = columnIndex;
      break;
    }
  }
  const startRowIndex = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
  return rows
    .slice(startRowIndex)
    .map((row) => String(((row || [])[bookNameColumnIndex]) || "").trim())
    .filter(Boolean);
}

async function resolveFirstSheet(options) {
  const credentials = readFeishuCredentials(options.apiFile);
  const tenantAccessToken = await getTenantAccessToken(credentials);
  const spreadsheetToken = await resolveSpreadsheetTokenFromWikiLink(fs.readFileSync(options.tableLinkFile, "utf8").trim(), tenantAccessToken);
  const sheetId = await getFirstSheetId(spreadsheetToken, tenantAccessToken);
  return { tenantAccessToken, spreadsheetToken, sheetId };
}

async function reserveFeishuRow(options) {
  const { tenantAccessToken, spreadsheetToken, sheetId } = await resolveFirstSheet(options);
  const values = await readSheetValues(spreadsheetToken, `${sheetId}!A:G`, tenantAccessToken);
  const row = candidateReservationRow(values);
  const candidate = await readSheetValues(spreadsheetToken, `${sheetId}!A${row}:G${row}`, tenantAccessToken);
  if (!isSheetRowEmpty(candidate[0] || [])) {
    throw new Error(`飞书候选行不是空行：${sheetId}!A${row}:G${row}`);
  }

  await writeSheetValues(spreadsheetToken, `${sheetId}!A${row}:G${row}`, buildReservationValues(), tenantAccessToken);
  const verify = await readSheetValues(spreadsheetToken, `${sheetId}!A${row}:G${row}`, tenantAccessToken);
  const expected = buildReservationValues()[0];
  const actual = verify[0] || [];
  const ok = expected.every((value, index) => String(actual[index] || "") === value);
  if (!ok) throw new Error(`飞书占行读回失败：${sheetId}!A${row}:G${row}`);
  return { tenantAccessToken, spreadsheetToken, sheetId, row };
}

async function writeFeishuReservedRowValues(options) {
  const { tenantAccessToken, spreadsheetToken, sheetId } = await resolveFirstSheet(options);
  await writeSheetValues(spreadsheetToken, `${sheetId}!${options.range}`, options.values, tenantAccessToken);
  return { spreadsheetToken, sheetId, row: options.row };
}

async function clearFeishuReservedRowValues(options) {
  const { tenantAccessToken, spreadsheetToken, sheetId } = await resolveFirstSheet(options);
  await writeSheetValues(spreadsheetToken, `${sheetId}!A${options.row}:G${options.row}`, buildClearReservationValues(), tenantAccessToken);
  return { spreadsheetToken, sheetId, row: options.row };
}

async function readFeishuReservedRowValues(options) {
  const { tenantAccessToken, spreadsheetToken, sheetId } = await resolveFirstSheet(options);
  const values = await readSheetValues(spreadsheetToken, `${sheetId}!A${options.row}:G${options.row}`, tenantAccessToken);
  return { spreadsheetToken, sheetId, row: options.row, values: values[0] || [] };
}

async function readFeishuBookNames(options) {
  const credentials = readFeishuCredentials(options.apiFile);
  const tenantAccessToken = await getTenantAccessToken(credentials);
  const spreadsheetToken = await resolveSpreadsheetTokenFromWikiLink(fs.readFileSync(options.tableLinkFile, "utf8").trim(), tenantAccessToken);
  const sheets = (await getSheetMetas(spreadsheetToken, tenantAccessToken)).filter((sheet) => !sheet.hidden);
  const names = [];
  for (const sheet of sheets) {
    const values = await readSheetValues(spreadsheetToken, `${sheet.sheet_id}!A:Z`, tenantAccessToken);
    names.push(...extractBookNamesFromSheetValues(values));
  }
  return Array.from(new Set(names));
}

async function writeLabelToFirstEmptyFeishuRow(options) {
  const credentials = readFeishuCredentials(options.apiFile);
  const tenantAccessToken = await getTenantAccessToken(credentials);
  const spreadsheetToken = await resolveSpreadsheetTokenFromWikiLink(fs.readFileSync(options.tableLinkFile, "utf8").trim(), tenantAccessToken);
  const sheetId = await getFirstSheetId(spreadsheetToken, tenantAccessToken);
  const columnValues = await readSheetValues(spreadsheetToken, `${sheetId}!E:E`, tenantAccessToken);
  const row = columnValues.length + 1;
  if (!options.dryRun) {
    await writeSheetValues(spreadsheetToken, `${sheetId}!E${row}:E${row}`, [[options.label]], tenantAccessToken);
  }
  return { spreadsheetToken, sheetId, row, dryRun: Boolean(options.dryRun) };
}

module.exports = {
  buildClearReservationValues,
  buildReservationValues,
  candidateReservationRow,
  extractWikiNodeToken,
  extractSpreadsheetToken,
  extractBookNamesFromSheetValues,
  formatFeishuLabel,
  getFirstSheetId,
  getSheetMetas,
  getTenantAccessToken,
  isSheetRowEmpty,
  normalizeDoubaoLabel,
  readFeishuBookNames,
  readFeishuCredentials,
  reserveFeishuRow,
  request,
  resolveSpreadsheetTokenFromWikiLink,
  clearFeishuReservedRowValues,
  readFeishuReservedRowValues,
  writeFeishuReservedRowValues,
  writeLabelToFirstEmptyFeishuRow,
};
