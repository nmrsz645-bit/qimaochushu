# 七猫出书暂停交接

更新时间：2026-09-20

## 最新发布状态（2026-09-20）

> 本节优先于后续历史交接说明；历史段落保留用于追溯此前的暂停状态。

- 已将既有的模型支持与测试改动提交并推送到 `main`：`cdb62bddd45c8112de5aea52512c1b03a7a1026c`（`支持阿里云百炼标签模型`）。默认模型为 `deepseek-v4-flash-0731`，可选 `qwen3.8-flash`，并保留 `deepseek-v3`；新增模型走兼容模式 `/compatible-mode/v1/chat/completions`，关闭思考与流式返回。
- 已在不含任何用户配置、登录态、业务数据或日志的独立构建目录完成 `npm ci`、20 项离线测试和 `npm run pack-desktop`；实际启动打包后的桌面程序成功。构建所产生的初始空白资料没有进入发布包。
- 已发布 Windows x64 完整 ZIP：<https://luotuoruanjiangengx.oss-cn-beijing.aliyuncs.com/packages/qimao-chushu-manager-1.0.0-win-x64.zip>。公开回读文件为 157,364,450 字节，SHA-256 为 `93F67981C4E1CB72F4F92B779045F346AB34585A6B08642FCB65BE5E3BD496A7`；ZIP 共 74 个文件，审计确认未包含 `config.json`、`config/`、账号登录态、密钥、数据、日志或业务目录。
- 下载中心源码入口已推送为 `50c703721c30ddb4c6cba00dd6c3a3cc63c0cdea`，GitHub Pages 地址 <https://nmrsz645-bit.github.io/software-download-center/> 已回读确认展示“七猫出书管理器”及上述链接。既有自定义域名 `download.luotuoqiluotuozhaoma.com` 当前正常 TLS 校验报主机名不匹配，需单独修复证书后再作为官方入口核验。
- 没有执行七猫、飞书、企业微信或真实模型 API 的业务流程，也没有执行 `self-check`、`show-info`。项目当前发布的是手动下载的完整 ZIP；源码中没有可验证的应用内远程更新清单/升级协议。
- 未运行 `npm run make-external`：该脚本会删除既有对外版目录并复制本机配置，无法满足本次资料保护边界。`npm ci` 仍报告 6 个历史高危依赖告警，未在本次发布中冒险升级依赖链。

## 当前状态与目标

本项目是“七猫出书管理器”，技术栈为 Electron + Node.js + Playwright Core。它扫描七猫平台当天新增书籍，生成推广链接、读取章节、生成合规标签、写入飞书，并支持企业微信正文发送、批量指定书籍处理、7x24 守护与失败重试。

当前工作已经停在“跨电脑可接手、可构建、可首次启动”的验收完成状态。用户明确要求此后先不要继续修改程序；新会话只能先检查和汇报，除非用户再次明确授权改代码、打包、生成对外版或发布云端更新。

## 下一步第一条操作

在新会话中，先在仓库根目录执行下面这条只读命令，然后阅读 `README.md`、`AGENTS.md`、本文件和 `HANDOFF.md`，再向用户报告当前 Git 状态；不要先改代码：

```powershell
git status --short; git log -1 --oneline; git rev-parse HEAD; git rev-parse origin/main
```

当前版本以该命令输出的 `HEAD` 与 `origin/main` 完全一致为准。模型支持发布对应提交为 `cdb62bd 支持阿里云百炼标签模型`；本次发布记录及后续仅文档提交会在该提交之后。

GitHub 仓库：<https://github.com/nmrsz645-bit/qimaochushu.git>

## 已完成并验证

- 已建立并推送安全的 Git 源码交接：源码、桌面界面、测试、文档、`package.json` 和 `package-lock.json` 已提交；真实密钥、登录资料、运行数据和构建产物未提交。
- 已补齐首次运行配置初始化：桌面程序、`npm run run-once` 和 `npm run self-check` 在缺少 `config.json` 时会先创建空白本地配置，不会因为配置文件不存在而直接崩溃。
- 已补齐测试：`test/runtime-config.test.js` 验证首次生成配置以及 `self-check` 先初始化、再报告缺少 API Key 的行为。
- 已明确有效代码入口：桌面入口为 `desktop/main.js`；业务脚本为 `src/`。根目录同名旧脚本仅作历史兼容，不能作为新功能修改目标。
- 在源码目录 `E:\七猫出书\automation` 已运行成功：
  - `npm.cmd test`
  - `npm.cmd run pack-desktop`
  - `npm.cmd audit --omit=dev --json`，生产依赖漏洞数为 0。
- 已从 GitHub 新建一个完全独立的临时目录验证：`npm ci`、`npm test`、`npm run pack-desktop` 全部通过；打包后的 `七猫出书管理器.exe` 实际启动成功，自动创建了有效的 `config.json` 和 `config/`、`data/`、`logs/`、`failed/`、`outputs/`、`七猫出书/`、`充值模板/`、`小说可移动/` 目录。

## 未完成事项与边界

- 没有在空白新电脑上填写真实平台链接、飞书凭据、阿里云 DeepSeek Key、企业微信 Webhook，也没有迁移或登录七猫账号。这些是用户个人资料，必须由使用者在目标电脑填写或通过安全离线方式迁移，不能写进 Git。
- 未执行生产账号的 `npm run self-check` 或 `npm run show-info`。两者会访问真实接口；其中企业微信检测会上传检测文件。需用户确认后再做。
- 未重新生成 `E:\七猫出书\对外版\automation`，也未通知或执行云端更新。这样做是为了避免覆盖现有对外版的用户配置、登录资料、数据和日志。若用户明确要求发布，必须先核对管理器已关闭、对外版资料保护和打包哈希。
- `npm ci` 会提示 5 个仅开发/打包依赖的历史高危告警。已验证生产依赖审计为 0，且 `npm audit fix --package-lock-only --dry-run` 没有给出可应用变更；不要为了消除提示盲目使用 `--force` 升级 Electron 打包链。
- 浏览器自动化依赖七猫当前网页结构；平台页面改版或登录失效时，仍可能导致元素定位超时。这需要用实际日志和失败截图排查，不能从单元测试推断平台一定正常。

## 关键文件与路径

- 源码根目录：`E:\七猫出书\automation`
- 本地对外版目录：`E:\七猫出书\对外版\automation`
- 桌面主进程：`desktop/main.js`
- 桌面渲染界面：`desktop/renderer/app.js`、`desktop/renderer/index.html`
- 自动出书主流程：`src/run-once.js`
- 运行配置加载与首次初始化：`src/runtime-config.js`
- 便携目录、守护命令与首页统计：`src/desktop-service.js`
- 飞书写入：`src/feishu-utils.js`
- 标签/合规处理：`src/deepseek-topic-utils.js`、`src/compliance-topic-utils.js`
- 失败重试：`src/failure-utils.js`
- 生成对外版：`src/make-external-release.js`
- 开发约定：`AGENTS.md`
- 用户操作与配置说明：`README.md`
- 项目功能与跨电脑交接说明：`HANDOFF.md`
- 配置说明：`config.example/README.md`

## 运行与验证命令

新电脑接手开发：

```powershell
git clone https://github.com/nmrsz645-bit/qimaochushu.git
cd qimaochushu
npm ci
npm test
npm run desktop
```

构建免 Node 运行的 Windows 目录版：

```powershell
npm run pack-desktop
```

构建结果在 `release\\win-unpacked`。使用时必须完整复制该文件夹，不能只复制 `七猫出书管理器.exe`。

仅在用户确认真实账号允许进行联网检测后：

```powershell
npm run show-info
npm run self-check
```

只在用户确认管理器已关闭、且允许重建对外版后：

```powershell
npm run make-external
```

## 不能误动的数据与配置

绝对不要提交、覆盖、清空、移动或删除以下用户资料，除非用户对具体路径明确授权：

- `config.json`、`config/`、`违禁词.txt`
- `data/`、`logs/`、`failed/`、`outputs/`
- `七猫出书/`、`ChromeProfile/`
- `充值模板/`、`小说可移动/`
- `E:\七猫出书\对外版\automation` 中的全部用户运行资料

升级或生成对外版时，程序文件可以替换；上述用户资料必须保留不变，并在完成后核对。

## 业务口径

- 自动模式只处理当天新增书籍。
- “带数字出书”按书籍 ID 区分；“不带数字出书”按去掉数字前缀后的原书名去重。
- 手动批量书籍 ID 允许重复处理，不受自动去重限制。
- `今日真实书籍数 = 今日已处理书籍 + 待处理数量 + 今日彻底失败`。
- 待处理包含等待一小时重试的书；达到最大重试次数（默认 3 次）后才计入彻底失败。
