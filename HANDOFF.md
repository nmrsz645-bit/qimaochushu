# 交接说明

## 另一台电脑 Codex 接手入口（2026-11-01）

本次交付是用户选定的 1.0.0 基线，包含阿里云 deepseek-v4-flash-0731 / qwen3.8-flash 支持，默认关闭思考模式。不是重新寻找 1.0.19，也不是宣称现有业务没有问题。此前源码及文档备份提交为 `3b02210130480bf4e0295a0e452df4e3149a95a5`；本次后续提交仅整理交接文档。

### 新电脑第一步

源码仓库：https://github.com/nmrsz645-bit/qimaochushu 。新电脑安装 Git、Node.js 24/npm、Google Chrome；发布人员另需 gh。公开源码下载无需业务凭据，推送时由用户在新电脑自行登录 GitHub，禁止传递旧机 token。

目标目录尚不存在时，在 PowerShell 执行：

```powershell
New-Item -ItemType Directory -Force C:\七猫出书
git clone --branch main https://github.com/nmrsz645-bit/qimaochushu.git C:\七猫出书\automation
Set-Location C:\七猫出书\automation
git status --short
git rev-parse HEAD
```

如果已有目录，先只读核对仓库和未提交改动，不覆盖、不 reset、不重复 clone。依次读 TIMEOFF.md、README.md、AGENTS.md、本文件、docs/RELEASE-GUIDE.md；历史 E: 路径和旧阶段状态不作为当前事实。以本文件的新说明和指南验收记录为准。

```powershell
node --version
npm.cmd --version
npm.cmd ci
npm.cmd test
npm.cmd run desktop
```

Electron 未安装完整时，按指南第 8 节检查并执行官方安装脚本。首次只打开管理器；让用户在“配置”页本地填写平台链接、飞书 App ID/App Secret/表格链接、百炼 API Key/接口地址/模型、可选企业微信 Webhook、违禁词/模板/小说目录、扫描页数和数字出书模式。不要索取聊天中的密钥。用户点击“打开登录页面”手动登录七猫；先报告缺项再取得真实业务授权，不自动点击出书、自检或监控。

### 程序结构与修改范围

Electron `desktop/main.js` → preload IPC → `desktop/renderer/app.js`；界面启动 `src/` 业务脚本。`src/run-once.js` 扫描书籍、筛选当天、飞书去重、推广/章节/标签、记录结果；`src/watch-hourly.js` 和 `src/watchdog.js` 负责周期及守护。配置、模型、飞书、失败重试文件见下方架构索引。

只在当前 desktop/、src/、test/ 和必要构建配置修改；根目录同名 JS 不是当前实现入口。修改业务逻辑需对应测试，再独立构建。不要覆盖用户配置、正文、失败队列或处理记录。已知故障清单在下方，尤其飞书大表 90221 尚未修复。

### 下载、上传及客户更新必须分开

- 直接运行：下载 [既有完整程序 ZIP](https://github.com/nmrsz645-bit/qimaochushu/releases/tag/v1.0.0-historical-backup-20261031)，完整解压，运行目录内“七猫出书管理器.exe”；无需另装 Node，但需 Chrome。不能只复制 exe。
- 上传源码：检查差异和敏感数据，只 git add 本次明确文件，commit 后普通 push；禁止 force push。推送前确认 Actions/webhook 不会意外发布。源码上传不会自动更新用户电脑。
- 生成新程序：在不带 config.json/登录态/业务数据的独立纯源码目录按锁文件安装、测试、`npm run pack-desktop`；首次启动之前打包完整 release/win-unpacked，检查 app.asar 和 ZIP，生成 SHA-256。严禁用当前 make-external 脚本发布，它会清空目标并复制配置。
- 上传程序：按指南第 4 节，以已批准的新版本/源码提交创建新的 GitHub Release 和完整 ZIP/校验文件；不覆盖旧附件、旧 tag，不随意改 Latest。当前已有包无需重复上传。本次交接不授权发布新程序。
- 网站/OSS：由“更新1”负责上传和上架，不负责修改程序；交给他源码 SHA、版本、ZIP、SHA-256、测试证据和已知限制。网站仓库、七猫卡片定位、OSS bucket/key、发布及回滚步骤见指南第 5–6 节。不能仅凭 push 声称网站已更新。
- 客户更新：当前只确认手动完整 ZIP 更新，没有可靠自动升级/增量协议。停止业务并备份旧目录及个人资料，新包解压到新目录，核对本机配置路径后使用；失败时保留新数据并回退旧目录，核对外部写入避免重复出书。跨电脑重新配置/登录，不迁移旧登录态。

### 下一位 Codex 首次应汇报

实际源码目录、分支/完整 HEAD、未提交改动、依赖安装及测试结果、程序首次启动情况、配置缺项和已知业务故障。之前 2026-10-31 干净远端输入的 20 项测试、目录构建及隔离窗口启动通过，不等于这台新电脑或真实生产业务已验收。不要为了“交接完成”隐瞒未验证项。

## 本次验收基线（2026-10-31，优先于下文旧阻塞描述）

使用者已明确按现有 1.0.0 源码及已上传程序包接手，目标是其他 Windows 电脑能下载、打开及修改。1.0.19 来源不再是本轮交接前置条件，不虚增版本；下文已知业务缺陷继续有效。干净 GitHub clone 已按锁文件安装依赖、20 项离线测试及目录构建通过；现有 Release 重新下载后哈希一致，空配置隔离启动并正常退出。细节见 docs/RELEASE-GUIDE.md 末节；真实业务不在此次验收范围。

下一位 Codex 的跨电脑安装、版本/构建、GitHub Release、OSS/网站对象、验证和回滚步骤统一见 [docs/RELEASE-GUIDE.md](docs/RELEASE-GUIDE.md)，不要自行拼接更新协议。

## 2026-10-31 当前交接（优先于下方历史段落）

### 已核实及缺口

- 仓库 nmrsz645-bit/qimaochushu，公开，main；程序声明 1.0.0。模型源码提交 cdb62bddd45c8112de5aea52512c1b03a7a1026c，上一发布记录提交 51db1089a972b667375710339e8bfad2f7284de3。
- 外部 1.0.19 仅有故障截图线索，未找到对应源码和提交，不能宣称最新版已同步。已检查原开发目录、独立 1.0.0 构建目录及更新2发布目录，未找到可对应源码。
- 开发目录为 C:\七猫出书\automation；旧 E: 路径只是历史。修改程序由本任务负责，更新1负责发布；本轮目标仅 GitHub，不改 OSS/网站/运行中程序。
- 本轮文档提交不改变版本，具体构建测试结果记入 TIMEOFF.md。既往模型调用成功不等于本轮生产验收。

### 架构与开发入口

Electron desktop/main.js 经 preload IPC 接收 desktop/renderer/app.js 操作，启动 src/ 子进程。src/run-once.js 串联扫描、当天筛选、飞书去重、推广、章节、标签、完成记录。根目录同名 JS 是历史兼容文件，不作新功能入口。

- 配置：src/runtime-config.js、src/config-utils.js。
- 飞书读取和占位：src/feishu-utils.js；标签模型及回退：src/deepseek-topic-utils.js。
- 词过滤：src/compliance-topic-utils.js、src/local-topic-utils.js。
- 失败重试和统计：src/failure-utils.js、src/desktop-service.js。
- 监控和守护：src/watch-hourly.js、src/watchdog.js；浏览器与锁：src/chrome-utils.js、src/process-lock.js。
- 发布：src/make-external-release.js（危险，见下文）；离线测试：test/。

Windows x64、系统 Node.js 24/npm、Chrome。声明依赖 playwright-core ^1.61.1、electron ^43.0.0、electron-builder ^26.15.3，实际安装遵循 package-lock.json。开发顺序 git status --short → npm ci → npm test → npm run desktop；独立构建 npm run pack-desktop，完整产物 release/win-unpacked。

### 配置及数据保护

安全示例说明在 config.example/README.md；各字段获取方式与输入格式见 README.md 最新章节。凭据来自使用者自己控制台，登录由使用者完成。新模型默认 deepseek-v4-flash-0731，可选 qwen3.8-flash，enable_thinking:false、stream:false。密钥按完整文本读取，不能用正则截断。

保留 config.json、config/、违禁词.txt、data/、logs/、failed/、outputs/、七猫出书/、ChromeProfile/、充值模板/、小说可移动/。禁止把真实配置、账号、内部日志或业务数据提交和打包。

### 未修复问题及复现入口

1. 大飞书表：readFeishuBookNames 读 A:Z，报 90221 超过 10 MiB 后 run-once 整轮退出，未进入单本处理；外部日志已确认。研究只读所需列和分页；读取失败不能误判为空以免重复出书。
2. 配置页先改页数/正文发送，再选目录：setConfig 重绘恢复未保存值，入口 renderer/app.js。
3. 小说内容自定义目录被 resolveExistingConfigFiles 中默认目录覆盖。
4. 修改 dataDir 后，部分 UI 统计、失败队列和锁仍使用根目录 data。
5. 飞书请求无明确超时，JSON 解析异常处理不足；部分调用在单本超时范围之外，整轮读回失败中断。
6. 守护 current_task 缺失时有检测盲区，需要独立复现恢复行为。
7. make-external 会清空旧对外版目录并复制真实凭据，禁止直接执行。
8. 20 页读取后唯一 ID 不足 1000，疑似翻页重复，尚未确证，不能宣称已修复。

下方历史“飞书短暂读回失败不能终止整轮”是期望，不是现有实现保证。离线测试通过不能覆盖以上所有路径。

### 发布与后续接手

先找到 1.0.19 来源，再决定正式发布对象，不虚增版本。使用独立纯源码构建目录，检查 package.json build.files 中 config.json 的收录风险；审查 app.asar 和 ZIP 内外，首次启动资料不得回流包内。
发布记录须含源码 SHA、tag、附件 SHA-256 和回读验证。不得覆盖旧包、强推、删除历史或把本机配置当公开默认值。更新需停止业务并保留用户资料；GitHub 发布不等于 OSS/下载站更新。
下一位先读 README.md、本文件、TIMEOFF.md 最新段落；不得未经授权运行 self-check/show-info 或真实出书。若最新版源码无法对应，明确缺口，不将 1.0.0 标作最新版。
