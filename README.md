# 七猫出书管理器

Windows 桌面自动化工具：扫描七猫书库中当天新增的书籍，生成推广链接，读取章节内容，生成合规标签，写入飞书表格，并可选发送小说正文到企业微信。

## 开发环境

- Windows 10/11 x64
- Node.js 24 或兼容版本
- Google Chrome

安装依赖并启动桌面管理器：

```powershell
npm ci
npm run desktop
```

运行完整测试：

```powershell
npm test
```

构建 Windows 目录版：

```powershell
npm run pack-desktop
```

生成本地对外版：

```powershell
npm run make-external
```

## 首次配置

真实配置不在 Git 仓库中。请在管理器的“配置”页面填写，或参考 [config.example/README.md](config.example/README.md) 建立本地文件。

首次直接执行 `npm run run-once`、`npm run self-check` 等命令时，也会自动创建空白的本地 `config.json`；随后仍需在管理器配置页填写账号、接口和目录。

必须由使用者在本机自行提供：

- 平台链接及七猫账号登录状态
- DeepSeek/DashScope API Key
- 企业微信 Webhook
- 飞书 API 凭据和表格链接
- 充值模板、违禁词和可移动小说内容目录

不要提交 `config.json`、`config/`、Chrome 登录目录、运行数据、日志或任何 API Key。

## 运行口径

- 自动扫描仅处理当天上架的书籍。
- “不带数字出书”时，`15书名`、`8书名` 按原书名视为同一本；“带数字出书”时按书籍 ID 分别处理。
- 首页统计：今日真实书籍数、今日已处理书籍、待处理数量、今日彻底失败。
- 待处理包含尚未达到重试上限、正在等待下一次重试的书籍。
- 失败任务只统计达到最大重试次数（默认 3 次）的书籍。
- 日志默认保留 72 小时。

## 目录说明

- `src/`：自动化与业务逻辑。
- `desktop/`：Electron 管理器界面。
- `test/`：Node 单元测试。
- `docs/`：历史设计与实现说明。
- `release/`：本地构建产物，不提交。
