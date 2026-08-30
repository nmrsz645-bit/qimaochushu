const fs = require("fs");
const https = require("https");
const path = require("path");
const { spawn } = require("child_process");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function safeFileName(name) {
  const cleaned = String(name || "")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) throw new Error("书名为空，不能生成 txt 文件名");
  return cleaned;
}

function isChapterTitleLine(line) {
  const text = String(line || "").replace(/\s+/g, " ").trim();
  if (!text) return false;
  const match = text.match(/^第\s*([0-9０-９一二三四五六七八九十百千万两〇零]+)\s*[章节回卷部](.*)$/);
  if (!match) return false;
  const rest = String(match[2] || "").trim();
  if (!rest) return true;
  if (rest.length > 24) return false;
  return !/[，。！？；：、“”‘’]/.test(rest);
}

function cleanNovelTextContent(content) {
  return String(content || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !isChapterTitleLine(line))
    .join("\n");
}

function writeBookTextFile(outputDir, bookName, content) {
  ensureDir(outputDir);
  const file = path.join(outputDir, `${safeFileName(bookName)}.txt`);
  fs.writeFileSync(file, cleanNovelTextContent(content), "utf8");
  return file;
}

function writeLatestChapterTextFile(file, content) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, cleanNovelTextContent(content), "utf8");
  return file;
}

function writeMovableChapterTextFile(configuredFile, bookName, content) {
  const dir = path.extname(configuredFile || "") ? path.dirname(configuredFile) : configuredFile;
  return writeBookTextFile(dir, bookName, content);
}

function extractWechatKey(webhookText) {
  const match = String(webhookText || "").match(/key=([a-zA-Z0-9_-]+)/);
  if (!match) throw new Error("企业微信接口里没有找到 key=");
  return match[1];
}

function buildWechatFileBody(mediaId) {
  if (!mediaId) throw new Error("企业微信 media_id 为空");
  return JSON.stringify({ msgtype: "file", file: { media_id: mediaId } });
}

function buildWechatTextBody(content) {
  return JSON.stringify({ msgtype: "text", text: { content: String(content || "") } });
}

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = https.request(
      {
        hostname: target.hostname,
        path: `${target.pathname}${target.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => resolve(data));
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function uploadWechatFile(key, filePath) {
  const uploadUrl = `https://qyapi.weixin.qq.com/cgi-bin/webhook/upload_media?key=${key}&type=file`;
  return new Promise((resolve, reject) => {
    const child = spawn(
      "curl.exe",
      ["-s", "-F", `media=@${filePath};filename=${path.basename(filePath)};type=text/plain`, uploadUrl],
      { windowsHide: true }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`企业微信文件上传命令失败：${stderr || code}`));
        return;
      }
      resolve(stdout);
    });
  });
}

async function sendWechatFile(webhookText, filePath) {
  const key = extractWechatKey(webhookText);
  const uploadRaw = await uploadWechatFile(key, filePath);
  const upload = JSON.parse(uploadRaw);
  if (upload.errcode !== 0) throw new Error(`企业微信上传失败：${uploadRaw}`);

  const sendUrl = `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${key}`;
  const sendRaw = await postJson(sendUrl, buildWechatFileBody(upload.media_id));
  const send = JSON.parse(sendRaw);
  if (send.errcode !== 0) throw new Error(`企业微信发送失败：${sendRaw}`);
  return { upload, send };
}

async function sendWechatText(webhookText, content) {
  const key = extractWechatKey(webhookText);
  const sendUrl = `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${key}`;
  const sendRaw = await postJson(sendUrl, buildWechatTextBody(content));
  const send = JSON.parse(sendRaw);
  if (send.errcode !== 0) throw new Error(`企业微信文本发送失败：${sendRaw}`);
  return send;
}

module.exports = {
  buildWechatFileBody,
  buildWechatTextBody,
  cleanNovelTextContent,
  extractWechatKey,
  safeFileName,
  sendWechatFile,
  sendWechatText,
  writeBookTextFile,
  writeLatestChapterTextFile,
  writeMovableChapterTextFile,
};
