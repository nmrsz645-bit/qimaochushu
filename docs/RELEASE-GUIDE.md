# 七猫出书：新 Windows 接手与发布指南

核验日期：2026-10-31。本指南只对应可维护历史源码 1.0.0，不对应来源未找到的 qi-mao-chu-shu-1.0.19。
使用者现已选定此 1.0.0 源码和已上传完整包为本次接手基线；1.0.19 来源不再阻塞本次交接。下文追查来源要求适用于未来声称对应 1.0.19 的发布，不限制本基线下载和开发。
本轮仅发布文档，以下构建、上传、网站修改命令是未来操作说明，本轮未执行。

## 1. 源码和版本关系

- 自有公开仓库：https://github.com/nmrsz645-bit/qimaochushu ，开发主分支 main。
- 已确认历史备份 tag：v1.0.0-historical-backup-20261031，提交 0679a88eec3f1557e8f8e184a53e8f2b38dc11fc。
- 历史备份 Release 标记为 prerelease，避免 GitHub 将唯一正式 Release 自动识别为 Latest；不表示 1.0.19 已验证。
- 没有独立、已验证的测试/正式客户端更新通道。测试只在隔离目录进行，不将测试包覆盖旧包。

```powershell
git clone --branch main https://github.com/nmrsz645-bit/qimaochushu.git C:\Projects\qimaochushu
Set-Location C:\Projects\qimaochushu
git status --short
git log -1 --oneline
git ls-remote origin refs/heads/main
```

复现已知历史包可在另一个干净 clone 中执行 `git switch --detach v1.0.0-historical-backup-20261031`。不要 reset 用户工作区。改动前读 AGENTS.md、README.md、HANDOFF.md。

## 2. 新机环境、安装和数据

Windows 10/11 x64，系统 Node.js 24（已验证 24.19.0）、npm（随 Node 安装）、Git、Google Chrome。锁文件版本：Electron 43.0.0、electron-builder 26.15.3、playwright-core 1.61.1。Chrome 无锁定版本，应在目标机验证；无需 Python。发布管理员另需 GitHub CLI gh。

```powershell
node --version
npm.cmd --version
git --version
npm.cmd ci
npm.cmd test
npm.cmd run desktop
```

系统 npm 路径不可见时重新打开终端；已安装于标准位置时可执行 `& 'C:\Program Files\nodejs\npm.cmd' test`。不要把编辑器内置 Node 当完整开发环境。

启动只打开管理器，首次创建 config.json、config、data、logs、failed、outputs、充值模板、小说可移动及七猫出书目录。使用者在配置页填自己的接口并手动登录 Chrome；详见 README.md / config.example/README.md。

完整 Electron 目录版不需要另装 Node；必须整套复制，Chrome 是外部运行时。
新机接手只克隆源码，不向旧机索取凭据或业务数据。DPAPI 数据、cookie、ChromeProfile/七猫出书登录目录不能作为可分发资料，应在新机重新登录。
同一台电脑升级则保留其 config.json、config/、违禁词.txt、data/、logs/、failed/、outputs/、模板、小说正文及登录资料；不要把“升级保留”误解成“发布包携带”。

## 3. 版本、构建、完整包与校验

程序版本字段在 package.json 的 version；package-lock.json 根 version 与 packages[""].version 应同步。未来已批准版本可用 `npm.cmd version <已批准版本> --no-git-tag-version`；尖括号是占位，不可原样执行。本次不升版，也不凭外层目录名改成 1.0.19。

在独立纯源码 clone 构建，不在运行中的工作区操作。先检查没有 config.json 和真实配置目录，因为 build.files 显式包含 config.json。

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run pack-desktop
# 首次启动产物之前，在当前干净构建目录运行：
Copy-Item README.md,HANDOFF.md -Destination release\win-unpacked
Copy-Item docs\RELEASE-GUIDE.md -Destination release\win-unpacked
Compress-Archive -LiteralPath release\win-unpacked -DestinationPath qimao-APPROVED-VERSION-win-x64.zip
Get-FileHash -LiteralPath qimao-APPROVED-VERSION-win-x64.zip -Algorithm SHA256
```

APPROVED-VERSION 必须替换为本次实际版本；目标 ZIP 必须为新文件。产物是完整目录 ZIP，不是增量包；本项目没有已验证的增量生成脚本、差分协议或自动应用补丁功能。`dist-desktop` 仅对应 electron-builder 默认目标，本轮没有验证其安装器，不将其描述为已验收安装方案。
现有 `src/make-external-release.js` / `npm run make-external` 会清空目标并复制凭据，**不得作为安全发布命令**。

审查 app.asar 内部与 ZIP 全部文件：不得有真实 config.json、config/、.env、密钥、浏览器资料、业务数据或日志。首次启动测试应解压到另一临时目录，不回灌测试产生资料到发布包。

## 4. GitHub 发布顺序

先测试和审查 → 明确源码 SHA → 提交推送源码/文档 → 构建审查及哈希 → 新 tag/Release → 回读验证 → 交给网站负责人更新卡片。git push 只上传源码，不代表客户端收到更新。
截至核验，本源码仓库无 Actions 工作流、webhook；Pages API 404。每次推送前仍需重新检查，不能假设未来配置不变。

```powershell
git diff --check
git status --short
# 只暂存已审查的本次文件，不使用 git add . 收入私有资料
git add README.md HANDOFF.md docs/RELEASE-GUIDE.md
git commit -m "更新接手与发布说明"
git push origin main
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

未来新包发布示例（变量必须先填入真实已审查值；不得复用历史 tag 覆盖）：

```powershell
# $releaseTag、$sourceCommit、$zipPath、$checksumPath、$notesPath 由本次发布记录提供
gh release create $releaseTag $zipPath $checksumPath --repo nmrsz645-bit/qimaochushu --target $sourceCommit --title "已确认历史或测试版本（非最新版）" --notes-file $notesPath --prerelease --latest=false
gh release view $releaseTag --repo nmrsz645-bit/qimaochushu --json url,tagName,isPrerelease,assets
```

不自动批准真正最新版为正式版；先解决 1.0.19 来源及已知业务故障。历史 tag/附件保留，不强推、不删除、不静默替换。

## 5. 客户端、OSS 与网站具体对象

**此仓库未发现可验证的远程自动更新协议**，没有已确认的七猫 manifest 字段或客户端自动下载入口。不要编造更新脚本、catalog.json 或版本检测参数。

历史 OSS 对象：bucket `luotuoruanjiangengx`，北京 endpoint `oss-cn-beijing.aliyuncs.com`，key `packages/qimao-chushu-manager-1.0.0-win-x64.zip`。这是历史完整包，不能覆盖。
本仓库没有 OSS 上传脚本，也没有已验证的上传凭据变量约定；OSS 更新由网站负责人使用其已审查发布流程操作。本轮不运行上传命令。

网站仓库：https://github.com/nmrsz645-bit/software-download-center 。当前 main/index.html 中，定位 `<h3>七猫出书管理器</h3>` 所属 article.card：无专用卡片 id，字段是 div.meta 的版本说明、a.download 的 href 和按钮文案。历史 href 为上述 OSS HTTPS 对象。不能把其他产品的矩阵清单套用给七猫。
该七猫卡片是静态 HTML，未核实任何外部运行时 catalog 与七猫的对应关系。网站生产域名证书和实际部署需网站负责人另行验证。

未来网站操作：新对象或 GitHub 附件先上传并校验；由“更新”负责人在网站仓库的规定流程中修改上述卡片三个字段，审核后部署；部署后回读实际 HTML 和下载地址。源码 push 不等于 Pages/自定义域名已生效。

共享网站指南指定链接（提交前已确认该分支文件可读；生产发布仍由网站负责人操作）：
[网站](https://github.com/nmrsz645-bit/software-download-center/blob/docs-cross-pc-handoff/docs/PUBLISHING.md#website) · [目录映射](https://github.com/nmrsz645-bit/software-download-center/blob/docs-cross-pc-handoff/docs/PUBLISHING.md#catalog) · [客户端更新](https://github.com/nmrsz645-bit/software-download-center/blob/docs-cross-pc-handoff/docs/PUBLISHING.md#client-update) · [验证与回滚](https://github.com/nmrsz645-bit/software-download-center/blob/docs-cross-pc-handoff/docs/PUBLISHING.md#verify-rollback) · [凭证](https://github.com/nmrsz645-bit/software-download-center/blob/docs-cross-pc-handoff/docs/PUBLISHING.md#credentials)。

## 6. 回读、手工升级与回滚

```powershell
# 使用不存在的新目录，禁止 --clobber 覆盖已保存包
gh release download $releaseTag --repo nmrsz645-bit/qimaochushu --pattern '*.zip' --dir C:\Temp\qimao-download-verify-NEW
Get-FileHash C:\Temp\qimao-download-verify-NEW\*.zip -Algorithm SHA256
```

核对下载字节、SHA-256、tag 指向 SHA、app.asar 的 package.json 版本、src/desktop 与源提交，检查 README/HANDOFF 同版。现有历史 ZIP SHA-256 为 `2487a44438d6d7a80f18ea26bad496053691d4a68ed11d157c235b1339958a33`，仅适用于历史附件，不用于将来的包。
在隔离解压副本无真实配置启动，确认窗口响应、默认目录生成及退出后子进程结束；不能据此宣称真实业务验收。
同机手工升级：停止监控并退出 → 备份旧完整目录和用户资料 → 新包解压到新目录 → 在本机受控恢复必要资料并重新核对绝对路径 → 用户手动验证登录/配置。不要覆盖原目录，也不公开迁移数据。跨电脑重新配置/登录，不迁移 DPAPI/浏览器登录态。
回滚：停止新副本，恢复升级前完整目录及对应资料快照后启动旧程序。新运行产生的业务写入不会因换回旧程序自动撤销；先核对已处理记录/飞书避免重复出书。网站回滚由负责人把卡片指回保留旧对象，禁止覆盖旧包。

## 7. 凭证与未完成项

GitHub 使用 gh auth login 的既有账户会话，核对 gh auth status 和仓库归属；不把 token 写在命令、示例或 Git 中，不扩张权限。OSS 权限由账户管理员按对象范围配置，使用网站流程约定的安全凭据存储；本项目没有可验证的 OSS 配置名，不凭空指定。
业务配置名：platformLinkFile、feishuApiFile、feishuTableLinkFile、deepseekApiKeyFile、deepseekApiBaseUrl、deepseekModel、wechatWebhookFile，均由 config-utils.js 定义。凭据获取见 README，不含任何真实值。

仍缺：1.0.19 完整源码/包构建记录；实际外层更新器和 catalog 来源；可靠的自动升级/增量协议；跨电脑生产接口及全链路验收。已知飞书大表、目录配置和守护缺陷见 HANDOFF。没有这些证据时，只能称“已确认历史 1.0.0”，不能称所有最新版已交付。

## 8. 本次选定基线的干净远端验收

2026-10-31 从 GitHub main 新 clone 到隔离目录，输入提交 `7d3fdf5c062bf267ad8e48bfaad78c28c72deb5e`；后续本次提交仅补文档，程序和锁文件不变。

- Node 24.19.0 / npm 11.17.0；`npm ci --no-audit --no-fund` 按锁文件安装 285 个包，退出 0。该次没有进行漏洞审计；存在依赖弃用警告，不代表依赖无漏洞。
- 本机 npm 安装脚本策略下 Electron 的 path.txt 未就绪，执行官方包自带 `node node_modules/electron/install.js` 后补齐。这是遇到该缺失时的排障步骤，不要求关闭全局安全策略。electron-winstaller 的脚本许可警告未影响本次目录包；未验证安装器。
- `npm test` 的 20 个脚本全部通过；`npm run pack-desktop` 成功生成 release/win-unpacked。无需修改程序或锁文件。
- 从既有 GitHub Release 重新下载完整 ZIP，157375213 字节，SHA-256 与第 6 节一致；没有重复发布、改 tag 或 Latest。
- 下载包解压到独立空目录，未导入配置和登录资料。隔离启动创建了标题“七猫出书管理器”的窗口及默认 config.json/config/data/logs/outputs/failed/七猫出书，进程响应正常；发送窗口关闭消息后专属进程数为 0。因隐藏启动，未进行可见页面逐项点击验收。
- 当前可修改范围为 desktop/、src/、test/ 和构建配置；修改前读 AGENTS.md 并保留个人资料。根目录同名 JS 是历史兼容入口。

上述是在本机隔离路径模拟干净接手，不是另一台实体电脑的实测；没有调用真实模型、飞书、七猫接口或启动出书任务。已知业务缺陷仍保留，不将开发可用等同业务无故障。
