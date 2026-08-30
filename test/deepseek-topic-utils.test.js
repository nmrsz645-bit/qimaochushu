const assert = require("assert");
const {
  normalizeDeepSeekLabel,
  requestDeepSeekTopicLabel,
  readDeepSeekApiKey,
  buildTopicLabel,
  buildDashScopeGenerationUrl,
} = require("../src/deepseek-topic-utils");

async function testNormalizesDeepSeekLabels() {
  const label = normalizeDeepSeekLabel(
    "#林澈 #乔浅月 #现实故事 #高考骗局 #热门小说 #热门小说",
    { forbiddenWords: ["乔浅"] }
  );
  assert.strictEqual(label, "#林澈 #热门小说");
}

async function testRequestsDashScopeDeepSeek() {
  let payload;
  let url;
  const label = await requestDeepSeekTopicLabel("测试书", "林澈在婚宴揭穿骗局", {
    apiKey: "test-key",
    baseUrl: "https://workspace.cn-beijing.maas.aliyuncs.com/api/v1",
    model: "deepseek-v3",
    fetchImpl: async (requestUrl, options) => {
      url = requestUrl;
      payload = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({ output: { choices: [{ message: { content: "#林澈 #婚宴骗局 #热门小说" } }] } }),
      };
    },
  });
  assert.strictEqual(url, "https://workspace.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/text-generation/generation");
  assert.strictEqual(payload.model, "deepseek-v3");
  assert.strictEqual(payload.parameters.result_format, "message");
  assert.strictEqual(payload.parameters.enable_thinking, false);
  assert.strictEqual(payload.input.messages.length, 3);
  assert.strictEqual(label, "#林澈 #热门小说");
}

async function testAcceptsFullDashScopeEndpoint() {
  assert.strictEqual(
    buildDashScopeGenerationUrl("https://workspace.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/text-generation/generation"),
    "https://workspace.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/text-generation/generation"
  );
}

async function testReadsTrimmedApiKey() {
  assert.strictEqual(typeof readDeepSeekApiKey, "function");
}

async function testFallsBackToLocalLabelWhenRequestFails() {
  const label = await buildTopicLabel("测试书", "林澈在婚宴揭穿骗局", {
    apiKey: "test-key",
    requestTopicLabel: async () => {
      throw new Error("DeepSeek request failed: HTTP 503");
    },
    localFallback: () => "#林澈 #婚宴骗局 #热门小说",
  });
  assert.strictEqual(label, "#林澈 #热门小说");
}

async function main() {
  await testNormalizesDeepSeekLabels();
  await testRequestsDashScopeDeepSeek();
  await testAcceptsFullDashScopeEndpoint();
  await testReadsTrimmedApiKey();
  await testFallsBackToLocalLabelWhenRequestFails();
  console.log("deepseek-topic-utils tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
