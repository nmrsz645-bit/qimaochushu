const fs = require("fs");
const { isCompliantTopic, sanitizeTopics } = require("./compliance-topic-utils");

const HOT_TOPIC = "\u70ed\u95e8\u5c0f\u8bf4";

const RICH_KEYWORDS = [
  "\u8ffd\u59bb\u706b\u846c\u573a",
  "\u75af\u6279\u7537\u4e3b",
  "\u6e05\u9192\u5973\u4e3b",
  "\u6076\u6bd2\u5973\u914d",
  "\u6781\u9650\u62c9\u626f",
  "\u5a5a\u5185\u80cc\u53db",
  "\u5a46\u5ab3\u77db\u76fe",
  "\u9752\u6885\u7af9\u9a6c",
  "\u771f\u5047\u5343\u91d1",
  "\u5148\u5a5a\u540e\u7231",
  "\u7834\u955c\u91cd\u5706",
  "\u5e26\u7403\u8dd1",
  "\u767d\u6708\u5149",
  "\u91cd\u751f",
  "\u590d\u4ec7",
  "\u9000\u5a5a",
  "\u51fa\u8f68",
  "\u8c6a\u95e8",
  "\u66ff\u8eab",
  "\u8ffd\u59bb",
  "\u5a46\u5ab3",
  "\u6253\u8138",
  "\u8bfb\u5fc3",
  "\u56e2\u5ba0",
  "\u6821\u56ed",
  "\u804c\u573a",
  "\u5a5a\u59fb",
  "\u79bb\u5a5a",
  "\u60ac\u7591",
  "\u8650\u604b",
  "\u751c\u5ba0",
  "\u6697\u604b",
  "\u5bb6\u66b4",
  "\u80cc\u53db",
  "\u53cd\u8f6c",
  "\u95ea\u5a5a",
  "\u5951\u7ea6",
  "\u603b\u88c1",
  "\u840c\u5b9d",
  "\u7a7f\u8d8a",
  "\u53e4\u8a00",
  "\u5bab\u6597",
  "\u5b85\u6597",
  "\u7384\u5b66",
  "\u7cfb\u7edf",
  "\u672b\u4e16",
  "\u6743\u8c0b",
  "\u9006\u88ad",
  "\u9a6c\u7532",
  "\u8650\u6e23",
  "\u7ffb\u8f66",
  "\u723d\u6587",
];

const DERIVED_RULES = [
  { pattern: /\u75af\u6279|\u504f\u6267|\u75c5\u5a07|\u75af\u72c2\u5360\u6709/, topic: "\u75af\u6279\u7537\u4e3b" },
  { pattern: /\u6211\u4e0d\u518d\u5fcd|\u4e0d\u518d\u5fcd|\u6e05\u9192|\u53cd\u51fb|\u53cd\u624b/, topic: "\u6e05\u9192\u5973\u4e3b" },
  { pattern: /\u5973\u914d|\u6076\u6bd2|\u539f\u914d|\u5c0f\u4e09/, topic: "\u6076\u6bd2\u5973\u914d" },
  { pattern: /\u5a46\u5a46|\u516c\u516c|\u5a46\u5bb6|\u5a46\u5ab3/, topic: "\u5a46\u5ab3\u77db\u76fe" },
  { pattern: /\u5a5a\u5185|\u4e08\u592b|\u8001\u516c|\u51fa\u8f68/, topic: "\u5a5a\u5185\u80cc\u53db" },
  { pattern: /\u62c9\u626f|\u66a7\u6627|\u7ea0\u7f20|\u820d\u4e0d\u5f97/, topic: "\u6781\u9650\u62c9\u626f" },
  { pattern: /\u723d|\u8650\u6e23|\u6253\u8138|\u53cd\u51fb|\u590d\u4ec7/, topic: "\u8650\u6e23\u723d\u6587" },
  { pattern: /\u771f\u76f8|\u7ffb\u8f66|\u53cd\u8f6c|\u79d8\u5bc6/, topic: "\u5267\u60c5\u53cd\u8f6c" },
];

const STOP_WORDS = new Set([
  "\u7b2c\u4e00\u7ae0",
  "\u7b2c\u4e8c\u7ae0",
  "\u7b2c\u4e09\u7ae0",
  "\u4e00\u4e2a",
  "\u4e00\u79cd",
  "\u8fd9\u4e2a",
  "\u90a3\u4e2a",
  "\u81ea\u5df1",
  "\u6211\u4eec",
  "\u4ed6\u4eec",
  "\u5979\u4eec",
  "\u4f60\u4eec",
  "\u4ec0\u4e48",
  "\u65f6\u5019",
  "\u6ca1\u6709",
  "\u4e0d\u662f",
  "\u5df2\u7ecf",
  "\u5c31\u662f",
  "\u7136\u540e",
  "\u56e0\u4e3a",
  "\u6240\u4ee5",
  "\u4f46\u662f",
  "\u5982\u679c",
  "\u5c0f\u8bf4",
  "\u5185\u5bb9",
  "\u7ae0\u8282",
  "\u672c\u7ae0",
  "\u7537\u4eba",
  "\u5973\u4eba",
]);

function normalizeText(text) {
  return String(text || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\u3000-\u303f\uff00-\uffef\[\]{}<>.,!?;:"'()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addCandidate(scores, topic, points) {
  const clean = String(topic || "").replace(/^#+/, "").trim();
  if (!clean || clean.length < 2 || clean.length > 8 || STOP_WORDS.has(clean)) return;
  scores.set(clean, (scores.get(clean) || 0) + points);
}

function normalizeForbiddenWord(word) {
  return String(word || "")
    .replace(/^#+/, "")
    .trim();
}

function readForbiddenWords(file) {
  if (!file) return [];
  try {
    return fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((line) => normalizeForbiddenWord(line))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function containsForbiddenWord(topic, forbiddenWords) {
  return !isCompliantTopic(topic, forbiddenWords);
}

function addDictionaryCandidates(scores, text) {
  for (const keyword of RICH_KEYWORDS) {
    const matches = text.match(new RegExp(keyword, "g"));
    if (matches) addCandidate(scores, keyword, 220 + matches.length * 25 + Math.min(keyword.length, 8));
  }
}

function addDerivedCandidates(scores, text) {
  for (const rule of DERIVED_RULES) {
    if (rule.pattern.test(text)) addCandidate(scores, rule.topic, 210);
  }
}

function addPhraseCandidates(scores, text) {
  const chunks = normalizeText(text).match(/[\u4e00-\u9fa5]{2,12}/g) || [];
  for (const chunk of chunks) {
    for (let size = 2; size <= 4; size += 1) {
      for (let index = 0; index <= chunk.length - size; index += 1) {
        addCandidate(scores, chunk.slice(index, index + size), size);
      }
    }
  }
}

function addBookNameCandidates(scores, bookName) {
  const clean = normalizeText(bookName).replace(/\s+/g, "");
  if (!clean) return;
  for (const keyword of RICH_KEYWORDS) {
    if (clean.includes(keyword)) addCandidate(scores, keyword, 180);
  }
  if (clean.length >= 2 && clean.length <= 6) addCandidate(scores, clean, 40);
}

function isOverlapping(topic, selected) {
  return selected.some((item) => item.includes(topic) || topic.includes(item));
}

function preferTopic(selected, text, topic, pattern, forbiddenWords = []) {
  if (!pattern.test(text) || selected.includes(topic)) return;
  if (containsForbiddenWord(topic, forbiddenWords)) return;
  const replaceable = [
    "\u6253\u8138",
    "\u7ffb\u8f66",
    "\u8ffd\u59bb",
    "\u79bb\u5a5a",
    "\u8650\u6e23",
    "\u80cc\u53db",
  ];
  const index = selected.findIndex((item) => replaceable.includes(item));
  if (index >= 0) selected[index] = topic;
}

function extractLocalTopics(bookName, content, count = 5, options = {}) {
  const forbiddenWords = options.forbiddenWords || readForbiddenWords(options.forbiddenWordsFile);
  const scores = new Map();
  const text = `${bookName || ""} ${content || ""}`;
  addBookNameCandidates(scores, bookName);
  addDictionaryCandidates(scores, text);
  addDerivedCandidates(scores, text);
  addPhraseCandidates(scores, text);

  const ranked = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0], "zh-CN"))
    .map(([topic]) => topic);

  const selected = [];
  for (const topic of ranked) {
    if (selected.length >= count) break;
    if (containsForbiddenWord(topic, forbiddenWords)) continue;
    if (isOverlapping(topic, selected)) continue;
    selected.push(topic);
  }

  preferTopic(selected, text, "\u5a46\u5ab3\u77db\u76fe", /\u5a46\u5a46|\u5a46\u5bb6|\u5a46\u5ab3/, forbiddenWords);
  preferTopic(selected, text, "\u5a5a\u5185\u80cc\u53db", /\u5a5a\u5185|\u4e08\u592b|\u8001\u516c|\u51fa\u8f68/, forbiddenWords);

  for (const fallback of ["\u5267\u60c5\u53cd\u8f6c", "\u60c5\u611f\u7ea0\u845b", "\u8eab\u4efd\u53cd\u8f6c", "\u771f\u76f8\u63ed\u6653", "\u547d\u8fd0\u9006\u8f6c"]) {
    if (selected.length >= count) break;
    if (containsForbiddenWord(fallback, forbiddenWords)) continue;
    if (!isOverlapping(fallback, selected)) selected.push(fallback);
  }

  return sanitizeTopics(selected, { forbiddenWords, limit: count });
}

function buildLocalTopicLabel(bookName, content, options = {}) {
  const topics = extractLocalTopics(bookName, content, 5, options);
  return [...topics, HOT_TOPIC].map((topic) => `#${topic}`).join(" ");
}

module.exports = { buildLocalTopicLabel, extractLocalTopics, readForbiddenWords };
