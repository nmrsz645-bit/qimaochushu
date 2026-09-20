const fs = require("fs");
const { buildLocalTopicLabel, readForbiddenWords } = require("./local-topic-utils");
const { sanitizeTopics } = require("./compliance-topic-utils");

const DEFAULT_DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/api/v1";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash-0731";
const HOT_TOPIC = "热门小说";
const GENERIC_TOPICS = new Set(["现实故事", "情感故事", "女性成长", "家庭关系", "婚恋情感"]);
const COMPLIANCE_SYSTEM_PROMPT = "人物名仅可使用小说虚构角色名，不得输出明星、名人、公众人物、领导人或国家机关工作人员姓名。不得输出政治国家元素、低俗性暗示、血腥暴力、违法犯罪、虚假诱导、夸大宣传等风险词；不得使用骗局、车祸、流产、火葬场、复仇等风险示例。有风险时改用中性剧情标签。";

const TOPIC_SYSTEM_PROMPT = `你是小说推文抖音标签大师。

请根据小说正文提取短标签，重点提取：
1. 正文里真实出现的人物名。
2. 人物之间的关系，例如青梅竹马、情敌、白月光、闺蜜、前任。
3. 剧情里的关键真相、误会、身份变化、关系变化、关键选择。
4. 关键事件，例如婚约、重逢、断联、退婚、出国、相认。
5. 剧情走向，例如反转、成长、觉醒、和解、逆转。

输出要求：
- 只输出一行标签。
- 每个标签以 # 开头。
- 除 #热门小说 外最多5个标签。
- 最后必须保留 #热门小说。
- 人物名必须来自正文，禁止编造。
- 不要复制示例人物名。
- 标签要短，2到6个字优先。
- 不要输出泛标签：#现实故事 #情感故事 #女性成长 #家庭关系 #婚恋情感。
- 不要解释，不要总结，不要编号。

优先输出格式：
#人物名 #人物名 #人物关系 #身份反转 #真相揭晓 #剧情反转 #热门小说

参考风格：
#林澈 #乔浅月 #青梅竹马 #身份反转 #真相揭晓 #剧情反转 #热门小说`;

function readDeepSeekApiKey(file) {
  if (!file) return "";
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch {
    return "";
  }
}

function normalizeDeepSeekLabel(text, { forbiddenWords = [] } = {}) {
  const candidates = [];
  for (const item of String(text || "").match(/#[^\s#，,；;。]+/g) || []) {
    const topic = item.slice(1).trim();
    if (!topic || topic === HOT_TOPIC || GENERIC_TOPICS.has(topic)) continue;
    candidates.push(topic);
  }
  const selected = sanitizeTopics(candidates, { forbiddenWords, limit: 5 });
  return [...selected, HOT_TOPIC].map((topic) => `#${topic}`).join(" ");
}

function safeErrorDetail(response) {
  const status = Number(response && response.status) || 0;
  return status ? `HTTP ${status}` : "request failed";
}

function buildDashScopeGenerationUrl(baseUrl) {
  const base = String(baseUrl || DEFAULT_DASHSCOPE_BASE_URL).trim().replace(/\/+$/, "");
  if (!/^https:\/\//i.test(base)) throw new Error("DashScope base URL is invalid");
  if (/\/services\/aigc\/text-generation\/generation$/i.test(base)) return base;
  return `${base}/services/aigc/text-generation/generation`;
}

async function requestDeepSeekTopicLabel(bookName, content, options = {}) {
  const apiKey = String(options.apiKey || "").trim();
  if (!apiKey) throw new Error("DashScope DeepSeek API key is missing");

  const fetchImpl = options.fetchImpl || global.fetch;
  if (typeof fetchImpl !== "function") throw new Error("DashScope fetch is unavailable");

  const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 45000);
  const model = options.model || DEFAULT_DEEPSEEK_MODEL;
  const compatible = ["deepseek-v4-flash-0731", "qwen3.8-flash"].includes(model);
  const messages = [
    { role: "system", content: `${COMPLIANCE_SYSTEM_PROMPT}\n\n${TOPIC_SYSTEM_PROMPT}` },
    { role: "user", content: `小说书名：${bookName || ""}\n\n小说正文：\n${content || ""}\n\n额外违禁词（绝不输出）：${(options.forbiddenWords || []).slice(0, 200).join("、") || "无"}` },
  ];
  const endpoint = compatible
    ? buildCompatibleChatUrl(options.baseUrl)
    : buildDashScopeGenerationUrl(options.baseUrl);
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(compatible ? {
        model, messages, enable_thinking: false, max_tokens: 180, stream: false,
      } : {
        model: options.model || DEFAULT_DEEPSEEK_MODEL,
        input: {
          messages: [
            { role: "system", content: COMPLIANCE_SYSTEM_PROMPT },
            { role: "system", content: TOPIC_SYSTEM_PROMPT },
            { role: "user", content: `小说书名：${bookName || ""}\n\n小说正文：\n${content || ""}\n\n额外违禁词（绝不输出）：${(options.forbiddenWords || []).slice(0, 200).join("、") || "无"}` },
          ],
        },
        parameters: {
          result_format: "message",
          enable_thinking: false,
          temperature: 0.2,
          max_tokens: 180,
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error && error.name === "TimeoutError") throw new Error("DashScope DeepSeek request timed out");
    throw new Error("DashScope DeepSeek request failed");
  }

  if (!response || !response.ok) throw new Error(`DashScope DeepSeek request failed: ${safeErrorDetail(response)}`);
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("DashScope DeepSeek response was invalid");
  }
  const text = compatible ? body?.choices?.[0]?.message?.content
    : body?.output?.choices?.[0]?.message?.content;
  if (!String(text || "").trim()) throw new Error("DashScope DeepSeek response was empty");
  const label = normalizeDeepSeekLabel(text, { forbiddenWords: options.forbiddenWords || [] });
  if (label === "#热门小说") throw new Error("DashScope DeepSeek response had no usable labels");
  return label;
}

async function buildTopicLabel(bookName, content, options = {}) {
  const forbiddenWords = options.forbiddenWords || readForbiddenWords(options.forbiddenWordsFile);
  const localFallback = options.localFallback || (() => buildLocalTopicLabel(bookName, content, { forbiddenWords }));
  const requestTopicLabel = options.requestTopicLabel || requestDeepSeekTopicLabel;
  const apiKey = options.apiKey === undefined ? readDeepSeekApiKey(options.apiKeyFile) : options.apiKey;
  try {
    return await requestTopicLabel(bookName, content, {
      apiKey,
      baseUrl: options.baseUrl,
      model: options.model,
      timeoutMs: options.timeoutMs,
      forbiddenWords,
      fetchImpl: options.fetchImpl,
    });
  } catch (error) {
    if (typeof options.onFallback === "function") {
      options.onFallback(`DeepSeek topic generation failed; used local fallback: ${error.message}`);
    }
    return normalizeDeepSeekLabel(localFallback(), { forbiddenWords });
  }
}

function buildCompatibleChatUrl(baseUrl) {
  const url = new URL(baseUrl || DEFAULT_DASHSCOPE_BASE_URL);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("DashScope base URL is invalid");
  }
  const pathname = url.pathname.replace(/\/+$/, "");
  if (!["", "/api/v1", "/api/v1/services/aigc/text-generation/generation", "/compatible-mode/v1", "/compatible-mode/v1/chat/completions"].includes(pathname)) {
    throw new Error("DashScope base URL path is invalid");
  }
  return `${url.origin}/compatible-mode/v1/chat/completions`;
}

module.exports = {
  buildCompatibleChatUrl,
  TOPIC_SYSTEM_PROMPT,
  DEFAULT_DASHSCOPE_BASE_URL,
  DEFAULT_DEEPSEEK_MODEL,
  buildDashScopeGenerationUrl,
  buildTopicLabel,
  normalizeDeepSeekLabel,
  readDeepSeekApiKey,
  requestDeepSeekTopicLabel,
};
