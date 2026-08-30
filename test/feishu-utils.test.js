const assert = require("assert");
const {
  buildReservationValues,
  buildClearReservationValues,
  candidateReservationRow,
  extractBookNamesFromSheetValues,
  extractWikiNodeToken,
  extractSpreadsheetToken,
  formatFeishuLabel,
  isSheetRowEmpty,
  normalizeDoubaoLabel,
  resolveSpreadsheetTokenFromWikiLink,
} = require("../src/feishu-utils");

function testExtractWikiNodeToken() {
  assert.strictEqual(
    extractWikiNodeToken("https://my.feishu.cn/wiki/L07EwDJoGi0pHBkJzZLcxNClnRb?from=from_copylink"),
    "L07EwDJoGi0pHBkJzZLcxNClnRb"
  );
}

async function testExtractsAndResolvesDirectSheetsLink() {
  const link = "https://ucnmxg4xjvz6.feishu.cn/sheets/TolysKokyhLltctpfGtcFlXxnAd?from=from_copylink";
  assert.strictEqual(extractSpreadsheetToken(link), "TolysKokyhLltctpfGtcFlXxnAd");
  assert.strictEqual(await resolveSpreadsheetTokenFromWikiLink(link, "unused-token"), "TolysKokyhLltctpfGtcFlXxnAd");
}

function testNormalizeDoubaoLabelRemovesPrefix() {
  const reply = [
    "短视频版：#宴礼 #慕见雪 #叶柯",
    "长文案版：#宴礼 #慕见雪 #叶柯 #情感",
  ].join("\n");
  assert.strictEqual(normalizeDoubaoLabel(reply), "#宴礼 #慕见雪 #叶柯 #热门小说");
}

function testNormalizeDoubaoLabelDoesNotDuplicateHotTopic() {
  assert.strictEqual(
    normalizeDoubaoLabel("短视频版：#宴礼 #慕见雪 #热门小说"),
    "#宴礼 #慕见雪 #热门小说"
  );
}

function testNormalizeDoubaoLabelUsesLatestReply() {
  const pageText = [
    "短视频版：#旧标签 #热门小说",
    "长文案版：#旧标签 #热门小说",
    "短视频版：#新标签",
    "长文案版：#新标签 #情感",
  ].join("\n");
  assert.strictEqual(normalizeDoubaoLabel(pageText), "#新标签 #热门小说");
}

function testNormalizeDoubaoLabelFallsBackToLastReplyLine() {
  const reply = ["豆包新回复", "这是一个标题", "#人物 #剧情"].join("\n");
  assert.strictEqual(normalizeDoubaoLabel(reply), "#人物 #剧情 #热门小说");
}

function testFormatFeishuLabelWrapsBookName() {
  assert.strictEqual(
    formatFeishuLabel("旧人旧事都如风", "#宴礼 #热门小说"),
    "《旧人旧事都如风》#宴礼 #热门小说"
  );
}

function testFormatFeishuLabelDoesNotDuplicateBookBrackets() {
  assert.strictEqual(
    formatFeishuLabel("《旧人旧事都如风》", "#宴礼 #热门小说"),
    "《旧人旧事都如风》#宴礼 #热门小说"
  );
}

function testFormatFeishuLabelReplacesSmallThreeInBookName() {
  assert.strictEqual(
    formatFeishuLabel("\u5c0f\u4e09\u79bb\u573a\u540e", "#\u5267\u60c5\u53cd\u8f6c #\u70ed\u95e8\u5c0f\u8bf4"),
    "\u300a\u524d\u4efb\u79bb\u573a\u540e\u300b#\u5267\u60c5\u53cd\u8f6c #\u70ed\u95e8\u5c0f\u8bf4"
  );
}

function testFormatFeishuLabelDropsExtraTagsToStayWithinLimit() {
  const label = formatFeishuLabel("短书名", "#人物甲 #人物乙 #剧情反转 #热门小说", 18);
  assert.strictEqual(label, "《短书名》#人物甲 #热门小说");
  assert(label.length <= 18);
}

function testFormatFeishuLabelKeepsOnlyBookNameWhenMandatoryTextIsTooLong() {
  const bookName = "书".repeat(49);
  assert.strictEqual(formatFeishuLabel(bookName, "#人物甲 #热门小说"), `《${bookName}》`);
}

function testCandidateReservationRowLeavesOneBlankRow() {
  const values = [
    ["日期", "书名", "制作人"],
    ["2026-06-29", "书1"],
    [],
    ["2026-06-29", "书2"],
  ];
  assert.strictEqual(candidateReservationRow(values), 6);
}

function testSheetRowEmptyTreatsMissingCellsAsEmpty() {
  assert.strictEqual(isSheetRowEmpty([]), true);
  assert.strictEqual(isSheetRowEmpty(["", null, undefined, ""]), true);
  assert.strictEqual(isSheetRowEmpty(["", "1"]), false);
}

function testBuildReservationValuesFillsAtoGWithOne() {
  assert.deepStrictEqual(buildReservationValues(), [["1", "1", "1", "1", "1", "1", "1"]]);
}

function testBuildClearReservationValuesClearsAtoG() {
  assert.deepStrictEqual(buildClearReservationValues(), [["", "", "", "", "", "", ""]]);
}

function testExtractBookNamesFromSheetValuesUsesBookNameHeader() {
  const values = [
    ["负责人", "标签", "日期"],
    ["制作人", "活动页", "程序链接"],
    ["日期", "制作人", "书名", "标签"],
    ["2026-06-29", "1", "第一本书", "#标签"],
    ["2026-06-29", "2", "第二本书", "#标签"],
  ];
  assert.deepStrictEqual(extractBookNamesFromSheetValues(values), ["第一本书", "第二本书"]);
}

function testExtractBookNamesFromSheetValuesFallsBackToColumnB() {
  const values = [
    ["日期", "备注"],
    ["2026-06-29", "第一本书"],
  ];
  assert.deepStrictEqual(extractBookNamesFromSheetValues(values), ["备注", "第一本书"]);
}

async function main() {
  testExtractWikiNodeToken();
  await testExtractsAndResolvesDirectSheetsLink();
  testNormalizeDoubaoLabelRemovesPrefix();
  testNormalizeDoubaoLabelDoesNotDuplicateHotTopic();
  testNormalizeDoubaoLabelUsesLatestReply();
  testNormalizeDoubaoLabelFallsBackToLastReplyLine();
testFormatFeishuLabelWrapsBookName();
testFormatFeishuLabelDoesNotDuplicateBookBrackets();
testFormatFeishuLabelReplacesSmallThreeInBookName();
testFormatFeishuLabelDropsExtraTagsToStayWithinLimit();
  testFormatFeishuLabelKeepsOnlyBookNameWhenMandatoryTextIsTooLong();
  testCandidateReservationRowLeavesOneBlankRow();
  testSheetRowEmptyTreatsMissingCellsAsEmpty();
  testBuildReservationValuesFillsAtoGWithOne();
  testBuildClearReservationValuesClearsAtoG();
  testExtractBookNamesFromSheetValuesUsesBookNameHeader();
  testExtractBookNamesFromSheetValuesFallsBackToColumnB();
  console.log("feishu-utils tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
