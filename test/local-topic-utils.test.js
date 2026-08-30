const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { buildLocalTopicLabel, extractLocalTopics } = require("../src/local-topic-utils");

function testExtractsFiveRichTopicsFromContent() {
  const content = [
    "\u7b2c\u4e00\u7ae0",
    "\u6211\u91cd\u751f\u56de\u5230\u9000\u5a5a\u5f53\u5929\uff0c\u53d1\u73b0\u524d\u592b\u65e9\u5c31\u548c\u767d\u6708\u5149\u8054\u624b\u9a97\u6211\u3002",
    "\u8c6a\u95e8\u5a46\u5a46\u903c\u6211\u79bb\u5a5a\uff0c\u6240\u6709\u4eba\u90fd\u7b49\u7740\u770b\u6211\u88ab\u6253\u8138\u3002",
    "\u8fd9\u4e00\u6b21\u6211\u4e0d\u518d\u5fcd\u8ba9\uff0c\u76f4\u63a5\u53cd\u51fb\uff0c\u8ba9\u80cc\u53db\u6211\u7684\u4eba\u5168\u90e8\u540e\u6094\u3002",
    "\u7537\u4e3b\u53d1\u73b0\u771f\u76f8\u540e\u8ffd\u59bb\u706b\u846c\u573a\uff0c\u53ef\u6211\u53ea\u60f3\u590d\u4ec7\u3002",
  ].join("\n");

  const topics = extractLocalTopics("\u9000\u5a5a\u5f53\u5929\u6211\u91cd\u751f\u4e86", content, 5);

  assert.strictEqual(topics.length, 5);
  assert.strictEqual(new Set(topics).size, 5);
  assert(topics.includes("\u91cd\u751f"));
  assert(topics.includes("\u9000\u5a5a"));
  assert(topics.includes("\u767d\u6708\u5149"));
  assert(!topics.some((topic) => /\u590d\u4ec7|\u706b\u846c\u573a|\u9a97\u5c40/.test(topic)));
}

function testExtractsShortVideoStyleTopics() {
  const content = [
    "\u6211\u4e0d\u518d\u5fcd\u4e86\uff0c\u5a5a\u5185\u80cc\u53db\u7684\u8001\u516c\u548c\u5c0f\u4e09\u7ec8\u4e8e\u7ffb\u8f66\u3002",
    "\u5a46\u5a46\u5e26\u7740\u5168\u5bb6\u903c\u6211\u51c0\u8eab\u51fa\u6237\uff0c\u53ef\u6211\u5df2\u7ecf\u627e\u5230\u771f\u76f8\u3002",
    "\u90a3\u4e2a\u504f\u6267\u75af\u6279\u7537\u4e3b\u4e00\u8fb9\u62c9\u626f\u4e00\u8fb9\u8ffd\u59bb\uff0c\u6700\u540e\u88ab\u6211\u8650\u6e23\u6253\u8138\u3002",
  ].join("\n");

  const topics = extractLocalTopics("\u79bb\u5a5a\u540e\u75af\u6279\u7537\u4e3b\u540e\u6094\u4e86", content, 5);

  assert.strictEqual(topics.length, 5);
  assert(!topics.some((topic) => /\u5c0f\u4e09|\u51fa\u8f68|\u5a5a\u5185\u80cc\u53db/.test(topic)));
}

function testBuildsFeishuLabelWithFiveTopicsPlusHotNovel() {
  const label = buildLocalTopicLabel(
    "\u9000\u5a5a\u5f53\u5929\u6211\u91cd\u751f\u4e86",
    "\u6211\u91cd\u751f\u540e\u590d\u4ec7\u6253\u8138\uff0c\u8c6a\u95e8\u524d\u592b\u8ffd\u59bb\u706b\u846c\u573a\uff0c\u767d\u6708\u5149\u5f7b\u5e95\u7ffb\u8f66\u3002"
  );

  assert(label.startsWith("#"));
  assert(label.endsWith("#\u70ed\u95e8\u5c0f\u8bf4"));
  assert.strictEqual(label.match(/#/g).length, 6);
}

function testBuildLocalTopicLabelFiltersForbiddenWordsFromFileByContainment() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qimao-forbidden-"));
  const forbiddenWordsFile = path.join(dir, "违禁词.txt");
  fs.writeFileSync(forbiddenWordsFile, "#出轨\n婚内背叛\n", "utf8");

  const label = buildLocalTopicLabel(
    "老公出轨后我重生了",
    "婚内背叛的老公和小三终于翻车，我重生后复仇打脸，豪门前夫追妻火葬场。",
    { forbiddenWordsFile }
  );

  assert(!label.includes("出轨"));
  assert(!label.includes("婚内背叛"));
  assert(!label.includes("小三"));
  assert(label.endsWith("#\u70ed\u95e8\u5c0f\u8bf4"));
  assert.strictEqual(label.match(/#/g).length, 6);
}

testExtractsFiveRichTopicsFromContent();
testExtractsShortVideoStyleTopics();
testBuildsFeishuLabelWithFiveTopicsPlusHotNovel();
testBuildLocalTopicLabelFiltersForbiddenWordsFromFileByContainment();
console.log("local-topic-utils tests passed");
