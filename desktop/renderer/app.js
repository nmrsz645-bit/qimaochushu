const tabs = document.querySelectorAll("[data-tab]");
const chromeCommands = new Set(["run-once", "run-today", "watch-hourly", "self-check", "rebuild-baseline", "open-login", "show-info"]);
for (const button of tabs) {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
    document.getElementById(button.dataset.tab).classList.add("active");
  });
}

function setMessage(text) {
  document.getElementById("message").textContent = text;
}

async function refreshStatus() {
  const status = await window.qimao.getStatus();
  const isMonitoring = status.running.includes("watch-hourly");
  const isWatchdog = status.running.includes("watchdog");
  const banner = document.getElementById("monitorBanner");
  banner.className = `monitor-banner ${isMonitoring || isWatchdog ? "running" : "stopped"}`;
  banner.textContent = isWatchdog ? "守护监控运行中：卡住会自动重启" : isMonitoring ? "监控运行中：正在每小时检测新书" : "监控未运行";
  const monitorButton = document.querySelector('[data-command="watch-hourly"]');
  monitorButton.classList.toggle("running", isMonitoring || isWatchdog);
  monitorButton.textContent = isWatchdog ? "守护监控运行中" : isMonitoring ? "监控运行中" : "开始 7*24 监控";
  const chromeBusy = status.running.some((name) => chromeCommands.has(name));
  document.querySelectorAll("[data-command]").forEach((button) => {
    const command = button.dataset.command;
    button.disabled = chromeBusy && chromeCommands.has(command) && command !== "stop-all";
  });
  const items = [
    ["运行中", status.running.length ? status.running.join(", ") : "否"],
    ["开机自启", status.startupEnabled ? "开" : "关"],
    ["今日真实书籍数", status.todayNewBookCount],
    ["待处理数量", status.todayPendingBookCount],
    ["今日已处理书籍", status.todayProcessedBookCount],
    ["今日彻底失败", status.todayTerminalFailureBookCount],
    ["今日单本处理数量", status.todayManualProcessedBookCount],
    ["已处理书籍", status.seenCount],
    ["失败任务", status.failureCount],
    ["最近扫描ID", status.lastScanBookCount],
    ["最近新书", status.lastNewBookCount],
  ];
  document.getElementById("statusGrid").innerHTML = items
    .map(([label, value]) => `<div class="metric"><label>${label}</label><strong>${value}</strong></div>`)
    .join("");
}

async function refreshLogs() {
  const logs = await window.qimao.getLogs();
  document.getElementById("runLog").textContent = logs.run || "暂无 run.log";
  document.getElementById("watchLog").textContent = logs.watch || "暂无 watch-hourly.log";
  document.getElementById("watchdogLog").textContent = logs.watchdog || "暂无 watchdog.log";
}

async function refreshFailures() {
  const failures = await window.qimao.getFailures();
  document.getElementById("failureRows").innerHTML = failures
    .map((failure) => {
      const error = String(failure.error || "").split("\n")[0];
      return `<tr><td>${failure.bookId || ""}</td><td>${failure.bookName || ""}</td><td>${failure.attempts || ""}</td><td>${failure.stage || ""}</td><td>${failure.lastFailedAt || ""}</td><td>${error}</td></tr>`;
    })
    .join("");
}

async function loadConfig() {
  setConfig(await window.qimao.getConfig());
  const inputs = await window.qimao.getConfigInputs();
  for (const key of ["platformLink", "wechatWebhook", "feishuApi", "feishuTableLink", "deepseekApiKey", "forbiddenWords"]) {
    document.getElementById(key).value = inputs[key] || "";
  }
}

function dirname(file) {
  const value = String(file || "");
  const index = Math.max(value.lastIndexOf("\\"), value.lastIndexOf("/"));
  return index >= 0 ? value.slice(0, index) : "";
}

function readConfigFromText() {
  return JSON.parse(document.getElementById("configText").value || "{}");
}

function normalizeScanPageCount(value) {
  const pageCount = Math.floor(Number(value));
  return Number.isFinite(pageCount) && pageCount >= 1 && pageCount <= 100 ? pageCount : 10;
}

function updateScanPageCountHint(value) {
  const pageCount = normalizeScanPageCount(value);
  document.getElementById("scanPageCountHint").textContent = `第 1 页起依次扫描，预计最多读取 ${pageCount * 50} 本`;
}

function setConfig(config) {
  document.getElementById("configText").value = JSON.stringify(config, null, 2);
  document.getElementById("sendNovelToWechat").checked = config.sendNovelToWechat !== false;
  document.getElementById("deepseekApiBaseUrl").value = config.deepseekApiBaseUrl || "";
  document.getElementById("deepseekModel").value = config.deepseekModel || "";
  const scanPageCount = normalizeScanPageCount(config.scanPageCount);
  document.getElementById("scanPageCount").value = scanPageCount;
  document.getElementById("duplicateBookTitleMode").value = config.duplicateBookTitleMode === "without-number" ? "without-number" : "with-number";
  updateScanPageCountHint(scanPageCount);
  document.getElementById("configInputDir").value = dirname(config.platformLinkFile);
  document.getElementById("templateDir").value = config.templateDir || "";
  document.getElementById("outputDir").value = config.outputDir || "";
  document.getElementById("novelDir").value = dirname(config.latestChapterTextFile);
  document.getElementById("failedDir").value = config.failedDir || "";
  document.getElementById("logDir").value = config.logDir || "";
  document.getElementById("dataDir").value = config.dataDir || "";
}

document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", async () => {
    try {
      setMessage(`正在执行：${button.textContent.trim()}`);
      const result = await window.qimao.runCommand(button.dataset.command);
      if (result.output) {
        setMessage(`${result.ok ? "执行成功" : "执行失败"}，退出码：${result.code}\n\n${result.output}`);
      } else {
        setMessage(JSON.stringify(result, null, 2));
      }
      setTimeout(refreshStatus, 800);
    } catch (error) {
      setMessage(error.message || String(error));
    }
  });
});

document.querySelectorAll("[data-startup]").forEach((button) => {
  button.addEventListener("click", async () => {
    try {
      const enabled = button.dataset.startup === "enable";
      const result = await window.qimao.setStartup(enabled);
      setMessage(result.enabled ? "已开启开机自启：开机后会自动启动守护监控。" : "已关闭开机自启。");
      await refreshStatus();
    } catch (error) {
      setMessage(`开机自启设置失败：${error.message || error}`);
    }
  });
});

document.querySelectorAll("[data-folder]").forEach((button) => {
  button.addEventListener("click", () => window.qimao.openFolder(button.dataset.folder));
});

document.getElementById("refreshLogs").addEventListener("click", refreshLogs);
document.getElementById("refreshFailures").addEventListener("click", refreshFailures);
document.getElementById("loadConfig").addEventListener("click", loadConfig);
document.getElementById("scanPageCount").addEventListener("input", (event) => updateScanPageCountHint(event.target.value));
document.querySelectorAll("[data-select-config]").forEach((button) => {
  button.addEventListener("click", async () => {
    const dir = await window.qimao.selectDirectory();
    if (!dir) return;
    const config = readConfigFromText();
    config[button.dataset.selectConfig] = dir;
    setConfig(config);
  });
});
document.querySelectorAll("[data-select-dir]").forEach((button) => {
  button.addEventListener("click", async () => {
    const dir = await window.qimao.selectDirectory();
    if (!dir) return;
    const config = await window.qimao.applyDirectoryConfig(readConfigFromText(), { [button.dataset.selectDir]: dir });
    setConfig(config);
  });
});
document.getElementById("saveConfig").addEventListener("click", async () => {
  try {
    const config = readConfigFromText();
    config.sendNovelToWechat = document.getElementById("sendNovelToWechat").checked;
    config.deepseekApiBaseUrl = document.getElementById("deepseekApiBaseUrl").value.trim();
    config.deepseekModel = document.getElementById("deepseekModel").value.trim();
    config.scanPageCount = normalizeScanPageCount(document.getElementById("scanPageCount").value);
    config.duplicateBookTitleMode = document.getElementById("duplicateBookTitleMode").value === "without-number" ? "without-number" : "with-number";
    document.getElementById("scanPageCount").value = config.scanPageCount;
    updateScanPageCountHint(config.scanPageCount);
    await window.qimao.saveConfig(config);
    const inputResult = await window.qimao.saveConfigInputs(Object.fromEntries(
      ["platformLink", "wechatWebhook", "feishuApi", "feishuTableLink", "deepseekApiKey", "forbiddenWords"]
        .map((key) => [key, document.getElementById(key).value])
    ));
    const fallbackKeys = inputResult.fallbacks || [];
    setConfig(fallbackKeys.length ? await window.qimao.getConfig() : config);
    setMessage(fallbackKeys.length
      ? `配置已保存。旧路径不可写，已自动改存：${fallbackKeys.join("、")}`
      : "配置已保存，所有接口与文本设置已写入配置目录。");
  } catch (error) {
    setMessage(`配置保存失败：${error.message}`);
  }
});

refreshStatus();
refreshLogs();
refreshFailures();
loadConfig();
setInterval(refreshStatus, 5000);

document.getElementById("processBatchBooks").addEventListener("click", async () => {
  const input = document.getElementById("batchBookIds");
  const query = input.value.trim();
  if (!query) {
    setMessage("请输入一个或多个书籍ID。");
    return;
  }
  const button = document.getElementById("processBatchBooks");
  button.disabled = true;
  try {
    setMessage("正在暂停监控并批量处理书籍，完成后会自动恢复监控。");
    const result = await window.qimao.processBatchBooks(query);
    setMessage(`${result.ok ? "批量书籍处理完成" : "批量书籍处理失败"}，退出码：${result.code}\n\n${result.output || ""}`);
  } catch (error) {
    setMessage(error.message || String(error));
  } finally {
    button.disabled = false;
    refreshStatus();
  }
});
