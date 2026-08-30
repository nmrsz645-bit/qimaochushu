const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  buildWechatFileBody,
  buildWechatTextBody,
  cleanNovelTextContent,
  extractWechatKey,
  safeFileName,
  writeBookTextFile,
  writeLatestChapterTextFile,
  writeMovableChapterTextFile,
} = require("../src/workflow-utils");

function testSafeFileNameKeepsBookNameText() {
  assert.strictEqual(safeFileName("生日当天，老婆丢了我爸寄来的特产"), "生日当天，老婆丢了我爸寄来的特产");
  assert.strictEqual(safeFileName("书名: A/B?C*"), "书名 ABC");
}

function testWriteBookTextFileUsesBookName() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-"));
  const file = writeBookTextFile(dir, "生日当天，老婆丢了我爸寄来的特产", "正文");
  assert.strictEqual(path.basename(file), "生日当天，老婆丢了我爸寄来的特产.txt");
  assert.strictEqual(fs.readFileSync(file, "utf8"), "正文");
}

function testCleanNovelTextContentRemovesChapterTitleLinesAndBlankLines() {
  const input = [
    "",
    "第1章",
    "正文第一行",
    "第2章 重生归来",
    "正文第二行",
    "第三章 旧梦",
    "",
    "第21章 新局",
    "第3章的时候，她已经离开了。",
    "正文第三行",
  ].join("\n");
  assert.strictEqual(
    cleanNovelTextContent(input),
    ["正文第一行", "正文第二行", "第3章的时候，她已经离开了。", "正文第三行"].join("\n")
  );
}

function testWriteBookTextFileCleansNovelContent() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-clean-"));
  const file = writeBookTextFile(dir, "清理测试", "第1章 标题\n\n正文\n第二章 标题\n");
  assert.strictEqual(fs.readFileSync(file, "utf8"), "正文");
}

function testWriteLatestChapterTextFileUsesFixedPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-latest-"));
  const file = path.join(dir, "小说内容.txt");
  const result = writeLatestChapterTextFile(file, "固定正文");
  assert.strictEqual(result, file);
  assert.strictEqual(fs.readFileSync(file, "utf8"), "固定正文");
}

function testWriteMovableChapterTextFileUsesBookNameInConfiguredDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-movable-"));
  const configuredFile = path.join(dir, "小说内容.txt");
  const result = writeMovableChapterTextFile(configuredFile, "不要覆盖我", "独立正文");
  assert.strictEqual(path.basename(result), "不要覆盖我.txt");
  assert.strictEqual(path.dirname(result), dir);
  assert.strictEqual(fs.readFileSync(result, "utf8"), "独立正文");
  assert.strictEqual(fs.existsSync(configuredFile), false);
}

function testWechatFormats() {
  assert.strictEqual(extractWechatKey("https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc_DEF-123"), "abc_DEF-123");
  assert.strictEqual(
    buildWechatFileBody("media123"),
    JSON.stringify({ msgtype: "file", file: { media_id: "media123" } })
  );
  assert.strictEqual(
    buildWechatTextBody("hello"),
    JSON.stringify({ msgtype: "text", text: { content: "hello" } })
  );
}

testSafeFileNameKeepsBookNameText();
testWriteBookTextFileUsesBookName();
testCleanNovelTextContentRemovesChapterTitleLinesAndBlankLines();
testWriteBookTextFileCleansNovelContent();
testWriteLatestChapterTextFileUsesFixedPath();
testWriteMovableChapterTextFileUsesBookNameInConfiguredDir();
testWechatFormats();
console.log("workflow-utils tests passed");
