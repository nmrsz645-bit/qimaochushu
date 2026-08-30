function extractShortVideoLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^短视频版[:：]/.test(line));
}

function textLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractNewDoubaoLabelText(currentText, baselineText) {
  const baselineCount = extractShortVideoLines(baselineText).length;
  const current = extractShortVideoLines(currentText);
  return current.slice(baselineCount).pop() || "";
}

function extractNewDoubaoReplyText(currentText, baselineText, sentText = "") {
  const labelText = extractNewDoubaoLabelText(currentText, baselineText);
  if (labelText) return labelText;

  const baselineCount = textLines(baselineText).length;
  const sentLines = new Set(textLines(sentText));
  const newLines = textLines(currentText)
    .slice(baselineCount)
    .filter((line) => !sentLines.has(line))
    .filter((line) => !/^(生成中|正在生成|停止生成|重新生成|复制|分享)$/.test(line));
  return newLines.join("\n");
}

module.exports = { extractNewDoubaoLabelText, extractNewDoubaoReplyText, extractShortVideoLines };
