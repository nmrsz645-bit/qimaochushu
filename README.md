# 七猫出书管理器

新 Windows 接手、手工 ZIP 升级、GitHub 补传和网站卡片发布步骤见 [发布与接手指南](docs/RELEASE-GUIDE.md)。git push 不等于客户端已更新；1.0.19 来源仍待核实。

## 2026-10-31 接手与发布核验（优先于下方历史说明）

本仓库可确认的程序版本是 **1.0.0**，模型实现提交为 `cdb62bddd45c8112de5aea52512c1b03a7a1026c`。外部电脑曾出现 `qi-mao-chu-shu-1.0.19`，对应源码与发布来源尚未找到；不能将本仓库称为整体最新版。此前 GitHub main 为 `51db1089a972b667375710339e8bfad2f7284de3`，没有 GitHub Release。历史 OSS 发布见 TIMEOFF.md，不等于 GitHub 安装包。

### 安装与配置

源码需要 Windows x64、Node.js 24/npm 和 Google Chrome；执行下方 npm 命令。完整 Electron 目录包不需另装 Node，必须解压全部文件后启动管理器 exe，不能只复制 exe。

首次启动生成空白 config.json 和运行目录。在配置页填写并保存：

- 平台链接：从本人七猫书库页面复制；点击“打开登录页面”由本人登录。
- 飞书接口：从自己的飞书应用后台取得，分两行填写 `App ID：你的值`、`App Secret：你的值`，使用中文冒号；完成表需给应用访问权限，支持 /wiki/ 或 /sheets/ 电子表格，不是多维表格。
- 阿里 API Key：从自己的百炼业务空间取得，完整粘贴；接口地址须匹配密钥所属地域与空间，不沿用他人工作空间。
- 模型：默认 deepseek-v4-flash-0731，可选 qwen3.8-flash，保留 deepseek-v3。新模型走兼容接口，显式关闭思考和流式输出。
- 企业微信 Webhook：需要时从自己的群机器人取得；正文发送开关不控制异常通知。
- 违禁词每行一个；充值模板 TXT 文件名对应平台模板名称；小说、输出等目录选择本机可写位置，已知目录限制见 HANDOFF.md。

安全配置说明见 config.example/README.md。不要将凭据、config.json、浏览器登录资料或业务数据提交、上传或发到聊天。

### 操作与故障处理

“运行一次”、批量处理和监控都会执行真实业务，可能创建推广、写飞书和发送正文。自动仅处理当天新增，手动批量允许重复。绿色守护状态不证明出书成功，检查日志。升级前停止业务并退出管理器。

不要把“重建基准”当作通用修复，它会改变已处理记录。self-check/show-info 会访问真实接口并可能上传企业微信检测文件，须先获得使用者同意。

- 飞书 `90221 / data exceeded 10485760 bytes`：现有 A:Z 全表去重读取超过 10 MiB，导致整轮退出；不要删表或跳过去重冒险处理，保留日志等待修复。
- `DashScope DeepSeek request failed` 是通用错误，核对模型、接口、网络和超时，不能直接判定密钥失效。业务可能回退本地标签，须看回退日志。
- 扫描有数量但无完成：检查 run.log 扫描后的异常、watch-hourly.log 退出码；页面旧日期书籍会被当天筛选排除。
- npm 缺失：确认安装系统 Node/npm，重新打开终端；编辑器内置 Node 不等于完整开发环境。

排障提供版本、故障时间、脱敏 run.log/watch-hourly.log/watchdog.log；必要时提供 today_scan.json、failed_tasks.json，不打包整个配置目录。

### 安全构建与升级

使用独立纯 Git 源码目录，执行 npm ci、npm test、npm run pack-desktop。产物 release/win-unpacked 必须整套使用；在首次启动产物前制作干净压缩包，并检查 app.asar 内外均无配置、密钥、登录态和运行数据。当前 build.files 包含 config.json，不能在真实配置工作区直接打包发布。

**禁止按下方旧说明直接运行 make-external**：脚本会清空目标对外版目录并复制本机凭据，尚未修复。升级保留用户配置、数据、日志和登录资料，只替换程序文件；本仓库没有已验证的应用内远程更新协议。

## 开发命令

```powershell
npm ci
npm test
npm run desktop
npm run pack-desktop
```

有效入口为 desktop/ 和 src/；根目录同名 JS 是历史兼容文件。完整开发交接见 HANDOFF.md，历史发布记录见 TIMEOFF.md。
