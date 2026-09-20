const assert = require("assert");
const {
  normalizeDeepSeekLabel,
  requestDeepSeekTopicLabel,
  readDeepSeekApiKey,
  buildTopicLabel,
  buildDashScopeGenerationUrl,
  buildCompatibleChatUrl,
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
  for (const model of ["deepseek-v4-flash-0731", "qwen3.8-flash"]) {
    let calls = 0;
    const label = await requestDeepSeekTopicLabel("测试书", "林澈重逢", {
      apiKey: "sk-test.with.punctuation", model,
      baseUrl: "https://workspace.cn-beijing.maas.aliyuncs.com/api/v1",
      fetchImpl: async (url, options) => {
        calls++;
        const body = JSON.parse(options.body);
        assert.strictEqual(url, "https://workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions");
        assert.strictEqual(options.headers.Authorization, "Bearer sk-test.with.punctuation");
        assert.strictEqual(body.model, model);
        assert.strictEqual(body.enable_thinking, false);
        assert.strictEqual(body.stream, false);
        assert.strictEqual(body.messages.length, 2);
        assert.strictEqual(body.input, undefined);
        return { ok: true, json: async () => ({ choices: [{ message: { content: "#林澈 #热门小说" } }] }) };
      },
    });
    assert.strictEqual(calls, 1);
    assert.strictEqual(label, "#林澈 #热门小说");
  }
  for (const suffix of ["/api/v1", "/compatible-mode/v1/", "/compatible-mode/v1/chat/completions", "/api/v1/services/aigc/text-generation/generation"]) {
    assert.strictEqual(buildCompatibleChatUrl(`https://example.com${suffix}`), "https://example.com/compatible-mode/v1/chat/completions");
  }
  assert.throws(() => buildCompatibleChatUrl("http://example.com/api/v1"));
  assert.throws(() => buildCompatibleChatUrl("https://example.com/unknown"));
  const fallback = await buildTopicLabel("测试", "测试", {
    model: "qwen3.8-flash", apiKey: "test",
    fetchImpl: async () => ({ ok: false, status: 401 }),
    localFallback: () => "#林澈 #热门小说",
  });
  assert.strictEqual(fallback, "#林澈 #热门小说");
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
