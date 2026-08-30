const assert = require("assert");
const { isCompliantTopic, normalizeOutputBookTitle, sanitizeTopics } = require("../src/compliance-topic-utils");

assert.strictEqual(isCompliantTopic("\u6797\u6f88"), true);
assert.strictEqual(isCompliantTopic("\u67d0\u660e\u661f"), false);
assert.strictEqual(isCompliantTopic("\u56fd\u5e86\u6d3b\u52a8"), false);
assert.strictEqual(isCompliantTopic("\u8840\u817d\u590d\u4ec7"), false);
assert.strictEqual(isCompliantTopic("\u8f66\u7978\u771f\u76f8"), false);
assert.strictEqual(isCompliantTopic("\u62dc\u91d1\u4eba\u751f"), false);
assert.strictEqual(isCompliantTopic("\u590d\u4ec7\u53cd\u51fb"), false);
assert.strictEqual(isCompliantTopic("\u60c5\u611f\u7ea0\u845b", ["\u60c5\u611f"]), false);
assert.deepStrictEqual(sanitizeTopics(["\u6797\u6f88", "\u5c0f\u4e09\u4e0a\u4f4d", "\u4e54\u6d45", "\u6797\u6f88"], { limit: 5 }), ["\u6797\u6f88", "\u4e54\u6d45"]);
assert.strictEqual(normalizeOutputBookTitle("\u5c0f\u4e09\u79bb\u573a\u540e"), "\u524d\u4efb\u79bb\u573a\u540e");

console.log("compliance-topic-utils tests passed");
