const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("qimao", {
  getStatus: () => ipcRenderer.invoke("status:get"),
  getLogs: () => ipcRenderer.invoke("logs:get"),
  getFailures: () => ipcRenderer.invoke("failures:get"),
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (config) => ipcRenderer.invoke("config:save", config),
  getConfigInputs: () => ipcRenderer.invoke("config-inputs:get"),
  saveConfigInputs: (values) => ipcRenderer.invoke("config-inputs:save", values),
  getDeepSeekApiKey: () => ipcRenderer.invoke("deepseek-key:get"),
  saveDeepSeekApiKey: (value) => ipcRenderer.invoke("deepseek-key:save", value),
  applyDirectoryConfig: (config, dirs) => ipcRenderer.invoke("config:apply-directories", config, dirs),
  selectDirectory: () => ipcRenderer.invoke("dialog:select-directory"),
  runCommand: (name) => ipcRenderer.invoke("command:run", name),
  processBatchBooks: (query) => ipcRenderer.invoke("books:process-batch", query),
  setStartup: (enabled) => ipcRenderer.invoke("startup:set", enabled),
  openFolder: (name) => ipcRenderer.invoke("folder:open", name),
});
