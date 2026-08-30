const HOT_TOPIC = "\u70ed\u95e8\u5c0f\u8bf4";

const BUILTIN_RISK_TERMS = [
  "\u660e\u661f", "\u540d\u4eba", "\u516c\u4f17\u4eba\u7269", "\u7f51\u7ea2", "\u5927\u5e08", "\u5f71\u5e1d", "\u5f71\u540e",
  "\u56fd\u65d7", "\u56fd\u5fbd", "\u56fd\u6b4c", "\u4eba\u6c11\u5e01", "\u9886\u5bfc\u4eba", "\u603b\u4e66\u8bb0", "\u603b\u7406", "\u4e3b\u5e2d", "\u4e24\u4f1a", "\u56fd\u5e86", "\u5efa\u515a", "\u4e00\u5e26\u4e00\u8def", "\u6539\u9769\u5f00\u653e", "\u8d38\u6613\u6218", "\u56fd\u5bb6\u653f\u7b56", "\u56fd\u52a1\u9662", "\u653f\u5e9c", "\u5e02\u59d4", "\u519b\u961f", "\u519b\u4eba", "\u7279\u79cd\u5175", "\u5165\u4f0d", "\u5175\u738b", "\u56fd\u836f", "\u56fd\u68b0", "\u56fd\u5986", "\u836f\u76d1", "\u536b\u5065\u59d4", "\u56fd\u5bb6\u8ba4\u8bc1", "\u56fd\u5bb6\u5ba1\u6279", "\u56fd\u5bb6\u4e13\u5229", "\u7ea2\u5934\u6587\u4ef6", "\u56fd\u5bb4", "\u56fd\u5bbe", "\u7279\u4f9b", "\u4e13\u4f9b", "\u56fd\u793c", "\u56fd\u8868", "\u56fd\u74f7",
  "\u5c0f\u4e09", "\u60c5\u5987", "\u5305\u517b", "\u88f8", "\u80f8", "\u81c0", "\u5185\u88e4", "\u9ad8\u6f6e", "\u65a9\u7537", "\u9e26\u7247\u9999\u6c34", "\u6027\u6697\u793a", "\u4e00\u591c\u60c5",
  "\u8840\u817d", "\u55b7\u8840", "\u5c38\u4f53", "\u6740\u4eba", "\u6740\u624b", "\u67aa", "\u5b50\u5f39", "\u5200\u5177", "\u7529\u68cd", "\u7fa4\u6bb4", "\u7ed1\u67b6", "\u62d0\u5356", "\u76d1\u7981", "\u975e\u6cd5\u62d8\u7981", "\u6050\u6016", "\u7075\u5f02", "\u9b3c\u602a", "\u4e27\u846c", "\u5bb6\u66b4",
  "\u8d2a\u6c61", "\u8150\u8d25", "\u5b66\u5386\u9020\u5047", "\u6284\u88ad", "\u5254\u7a83", "\u78b0\u74f7", "\u8003\u8bd5\u4f5c\u5f0a", "\u9876\u7f6a", "\u66ff\u7f6a", "\u8bc8\u9a97", "\u9a97\u5c40", "\u6bd2\u54c1", "\u51fa\u8f68", "\u5a5a\u5185\u80cc\u53db",
  "\u4e2d\u5956", "\u5230\u8d26", "\u6e05\u7406", "\u624b\u673a\u4e2d\u6bd2", "\u5783\u573e\u7206\u6ee1", "\u5173\u95ed", "\u8df3\u8fc7", "\u6ed1\u52a8\u89e3\u9501", "\u7248\u672c\u66f4\u65b0", "\u6765\u7535", "\u901a\u8bdd", "\u4e0a\u6ed1", "\u70b9\u51fb",
  "\u6c38\u4e45\u514d\u8d39", "\u5b8c\u5168\u514d\u8d39", "\u767e\u5206\u767e", "\u7edd\u5bf9", "\u6c38\u4e0d", "\u6700\u5f3a", "\u7b2c\u4e00", "\u8f6f\u4ef6\u4e0b\u8f7d", "\u5e94\u7528\u4e0b\u8f7d",
  "\u4e2d\u7f8e", "\u4e2d\u5370", "\u53cc\u51cf", "\u6e2f\u73e0\u6fb3", "G20", "\u82f1\u96c4\u70c8\u58eb", "\u4e07\u7586", "\u4eca\u5929\u662f\u4f60\u7684\u751f\u65e5", "\u56fd\u5bb6\u6807\u5fd7", "\u56fd\u5bb6\u7248\u56fe",
  "\u62dc\u91d1", "\u70ab\u5bcc", "\u5acc\u8d2b\u7231\u5bcc", "\u5543\u8001", "\u501a\u8001\u5356\u8001", "\u6d6a\u8d39\u98df\u7269", "\u7269\u5316\u5973\u6027", "\u6027\u522b\u6b67\u89c6", "\u6b67\u89c6", "\u8d2c\u4f4e", "\u5b97\u6559", "\u6076\u641e",
  "\u64e6\u8fb9", "\u4f4e\u4fd7", "\u654f\u611f\u90e8\u4f4d", "\u4ef0\u62cd", "\u4fef\u62cd", "\u4e0b\u4f53", "\u80f8\u90e8", "\u72ec\u5c45", "\u4e0a\u95e8", "\u6210\u5e74\u4eba", "\u751f\u5b50\u4ea4\u53cb", "\u6309\u6469", "\u91c7\u8033", "\u517b\u751f\u4f1a\u6240",
  "\u865a\u5047\u6309\u94ae", "\u8fd4\u56de\u6309\u94ae", "\u76f4\u64ad\u754c\u9762", "\u5fae\u4fe1\u5230\u8d26", "\u8f66\u7978", "\u6d41\u4ea7", "\u706b\u846c\u573a", "\u590d\u4ec7", "\u590d\u4ec7\u53cd\u51fb",
];

function normalizeTopic(topic) {
  return String(topic || "").replace(/^#+/, "").replace(/\s+/g, "").trim();
}

function isCompliantTopic(topic, forbiddenWords = []) {
  const clean = normalizeTopic(topic);
  if (!clean || clean === HOT_TOPIC) return false;
  if (BUILTIN_RISK_TERMS.some((term) => clean.includes(term))) return false;
  return !(forbiddenWords || []).some((word) => {
    const blocked = normalizeTopic(word);
    return blocked && clean.includes(blocked);
  });
}

function sanitizeTopics(topics, { forbiddenWords = [], limit = 5 } = {}) {
  const selected = [];
  for (const topic of topics || []) {
    const clean = normalizeTopic(topic);
    if (!isCompliantTopic(clean, forbiddenWords) || selected.includes(clean)) continue;
    selected.push(clean);
    if (selected.length >= limit) break;
  }
  return selected;
}

function normalizeOutputBookTitle(bookName) {
  return String(bookName || "").replace(/\u5c0f\u4e09/g, "\u524d\u4efb");
}

module.exports = { HOT_TOPIC, isCompliantTopic, normalizeOutputBookTitle, sanitizeTopics };
