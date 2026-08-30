const assert = require("assert");
const { extractNewDoubaoLabelText, extractNewDoubaoReplyText } = require("../src/doubao-utils");

function testExtractNewDoubaoLabelTextAfterBaseline() {
  const before = "用户内容\n短视频版：旧标签 #热门小说";
  const after = `${before}\n豆包回复\n短视频版：新标签 #热门小说`;
  assert.strictEqual(extractNewDoubaoLabelText(after, before), "短视频版：新标签 #热门小说");
}

function testExistingShortVideoLinesDoNotCountAsNewReply() {
  const before = [
    "历史回复1",
    "短视频版：旧标签1 #热门小说",
    "历史回复2",
    "短视频版：旧标签2 #热门小说",
  ].join("\n");
  const afterWithoutReply = `${before}\n用户刚发送的正文`;
  const afterWithReply = `${afterWithoutReply}\n豆包新回复\n短视频版：新标签3 #热门小说`;

  assert.strictEqual(extractNewDoubaoLabelText(afterWithoutReply, before), "");
  assert.strictEqual(extractNewDoubaoLabelText(afterWithReply, before), "短视频版：新标签3 #热门小说");
}

function testExtractNewDoubaoLabelTextReturnsEmptyBeforeReply() {
  assert.strictEqual(extractNewDoubaoLabelText("用户内容\n生成中", "用户内容"), "");
}

function testExtractNewDoubaoReplyTextAcceptsAnyNewReply() {
  const before = "历史回复\n短视频版：旧标签 #热门小说";
  const after = `${before}\n用户刚发送的正文\n豆包新回复\n这是新的标题\n#新的话题`;
  assert.strictEqual(
    extractNewDoubaoReplyText(after, before, "用户刚发送的正文"),
    "豆包新回复\n这是新的标题\n#新的话题"
  );
}

function testExtractNewDoubaoReplyTextPrefersShortVideoLine() {
  const before = "历史回复\n短视频版：旧标签 #热门小说";
  const after = `${before}\n用户刚发送的正文\n豆包新回复\n短视频版：#新标签`;
  assert.strictEqual(extractNewDoubaoReplyText(after, before), "短视频版：#新标签");
}

function testExtractNewDoubaoReplyTextDoesNotCountSentContent() {
  const before = "历史回复";
  const after = `${before}\n用户刚发送的正文`;
  assert.strictEqual(extractNewDoubaoReplyText(after, before, "用户刚发送的正文"), "");
}

testExtractNewDoubaoLabelTextAfterBaseline();
testExistingShortVideoLinesDoNotCountAsNewReply();
testExtractNewDoubaoLabelTextReturnsEmptyBeforeReply();
testExtractNewDoubaoReplyTextAcceptsAnyNewReply();
testExtractNewDoubaoReplyTextPrefersShortVideoLine();
testExtractNewDoubaoReplyTextDoesNotCountSentContent();
console.log("doubao-utils tests passed");
