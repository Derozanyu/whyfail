<a id="top"></a>

# WhyFail

<p align="center">
  <a href="#chinese">简体中文</a>
  ·
  <a href="#english">English</a>
</p>

<a id="chinese"></a>

### 桌面 App（Windows 原型）

桌面版不需要手动输入 `whyfail auto --cwd ...`。打开 WhyFail 后，点击右上角的 **＋ 选择项目**，选择项目文件夹；WhyFail 会自动识别语言、执行安全检查并在同一窗口打开报告。命令行和浏览器版本仍然保留，共用同一套检查记录。

桌面版左下角的 **设置** 集中管理亮色/暗色主题、中文/英文界面和 OpenAI-compatible API。API Key 通过 Electron `safeStorage` 交给 Windows DPAPI 加密，渲染页面无法读取已保存的明文 Key；不配置 API 时，WhyFail 继续使用本地规则诊断。

从源码启动桌面版：

```powershell
npm.cmd install
npm.cmd run desktop
```

生成 Windows 安装包和便携版：

```powershell
npm.cmd run desktop:dist
```

生成文件位于 `dist-desktop`。桌面 App 已经自带 WhyFail 的运行环境，但检查 Python、Rust、仓颉等项目时，电脑仍需安装目标项目对应的工具链。

- `WhyFail-Portable-版本-x64.exe`：单文件便携版，双击后解压到系统临时目录并运行，不写入安装记录。
- `WhyFail-Setup-版本-x64.exe`：正式安装包，可选择安装目录，并创建桌面及开始菜单快捷方式。
- `SHA256SUMS.txt`：发布文件校验值。上传 GitHub Release 时建议把三个文件一起上传。

当前构建没有商业代码签名证书。其他电脑首次打开时，Windows SmartScreen 可能显示“未知发布者”；这不代表校验失败，正式公开分发时建议购买代码签名证书或使用可信的开源项目签名服务。

## 简体中文

> 自动检查项目为什么运行失败，并在本地网页中展示错误原因、真实源码行号、现场日志和验证结果。

WhyFail 是一个本地优先的命令失败诊断工具。你只需要提供项目目录，它会自动识别语言和项目结构，选择合适的编译、测试或静态检查命令，并生成可切换中英文、亮色/暗色主题的网页报告。

数据和历史报告默认保留在你的电脑中。WhyFail 不会自动修改项目代码、安装依赖或执行 AI 生成的修复命令。

## 主要功能

- 一条 `whyfail auto` 自动识别语言并检查项目。
- 支持单文件、完整工程、嵌套模块和混合语言仓库。
- 捕获 stdout、stderr、退出码、耗时、运行环境及项目清单。
- 自动生成执行前后的黑匣子快照，记录 Git、资源、依赖文件和最近源码变化。
- 失败报告由用户主动确认后，可把自定义修改要求交给本机 Agent，在隔离副本中循环修复和验证。
- 从错误日志中定位真实源文件、行号和列号，并展示相关代码片段。
- 内置常见编译、依赖、模块系统、端口、权限和运行时错误诊断。
- 通过 `whyfail verify` 重跑原命令，判断错误已解决、仍可复现或发生变化。
- 成功命令也会保留关键输出，方便确认结果是否符合预期。
- 本地网页支持简体中文/English、亮色/暗色主题和 Markdown 导出。
- 没有 API Key 也能使用；可选接入 OpenAI-compatible API 进行更深分析。
- 零运行时 npm 依赖。

## 已经有 Codex 或 Claude，为什么还需要 WhyFail？

Codex、Claude 等编程智能体擅长交互式理解代码、分析错误、修改文件和运行测试。如果你已经在智能体中，只想解决一次具体报错，直接让智能体处理通常更快。WhyFail 不试图在推理能力上与大模型竞争，也不把“再生成一段 AI 解释”当作核心价值。

WhyFail 更适合作为智能体之前和智能体之间的**故障取证与复现层**：

- **标准化采集**：不同语言都记录为一致的命令、退出码、环境、日志、源码位置和验证状态。
- **现场不会丢失**：在终端关闭、日志滚走或换人处理前，把失败现场保存成持久报告。
- **无需 AI 账户**：内置规则、本地网页、源码定位和重跑验证可以离线使用。
- **结果可审计**：诊断结论与原始证据分开显示，不需要相信一段无法追溯的聊天回答。
- **可重复验证**：保存原始参数和工作目录，修复后能够重新执行完全相同的命令。
- **模型可替换**：同一份证据可以交给 OpenAI-compatible 模型、其他智能体或人工处理，而不绑定某个聊天产品。
- **适合非交互场景**：目标是进入 CI、自动化脚本、教学现场和团队故障交接，而不要求智能体一直在线控制项目。

推荐组合方式是：先由 WhyFail 采集并生成结构化证据，再把报告交给 Codex/Claude 修复，最后由 WhyFail 重跑原命令验证结果。

### 真正的差异化路线

当前版本已经完成本地采集、源码定位、统一报告、原命令重跑和第一版黑匣子记录，但仍与 AI 编程助手存在功能重叠。接下来不应继续堆“更像聊天机器人”的能力，而应优先建设：

- [x] **本地黑匣子记录**：在命令执行前后记录 Git、系统资源、环境变量存在状态、项目文件哈希和最近源码变化，并与同一命令最近一次成功记录比较。
- [x] **可审计 Agent 修复**：用户主动提交修改要求后，Agent 在隔离副本中工作；每轮文件变化、输出、验证报告与停止原因均写入黑匣子。
- [ ] **稳定失败指纹**：对路径、时间戳等噪声归一化，让同一个错误在不同电脑和 CI 中获得相同 ID，并自动聚类。
- [ ] **可移植复现包**：导出经过脱敏的 `.whyfail` 包，包含日志、环境、清单、必要源码片段和复现说明，接收方无需访问原电脑。
- [ ] **运行差异比较**：`whyfail diff <旧报告> <新报告>`，精确展示依赖、环境、命令、错误位置和输出发生了什么变化。
- [ ] **CI 标准产物**：输出 SARIF/JUnit/JSON 并为 GitHub Actions 等平台生成可定位到源码行的注释。
- [ ] **成功契约**：不仅判断退出码 0，还允许项目声明必须出现的字段、文件、数量或测试条件，避免“命令成功但业务结果错误”。

这些能力不是靠一次模型对话稳定获得的，它们需要持续安装在执行环境中的确定性工具、版本化数据格式和可审计工作流。这才是 WhyFail 应该建立的护城河。

## 环境要求

- [Node.js](https://nodejs.org/) 20 或更高版本。
- Git（使用 `git clone` 安装时需要）。
- 目标项目对应的工具链。例如 Python 项目需要 `python`，Rust 项目需要 `cargo`，仓颉项目需要 `cjc`/`cjpm`。

### 还没有 Node.js？

Node.js 是 WhyFail 当前版本的运行环境，npm 会随 Node.js 一起安装，不需要单独下载 npm。

1. 打开 [Node.js 官方下载页](https://nodejs.org/en/download/)。
2. 选择 **LTS** 版本，不要选择 Current 实验版本。
3. Windows 用户下载安装 `.msi` 安装包，macOS 用户下载安装 `.pkg`，按默认选项完成安装；Linux 用户按照下载页提供的包管理器或版本管理器步骤安装。
4. 安装完成后关闭并重新打开 PowerShell/终端。

然后确认 Node.js 和 npm 可用：

```powershell
node --version
npm.cmd --version
```

WhyFail 会识别并调用已有工具链，但不会替用户安装编译器、运行时或项目依赖。

## 安装

### 方式一：从 GitHub 克隆后安装（推荐）

把下面的仓库地址替换成你实际上传后的地址：

```powershell
git clone https://github.com/Derozanyu/whyfail.git
cd whyfail
npm.cmd install -g .
```

macOS 或 Linux 可以使用：

```bash
git clone https://github.com/Derozanyu/whyfail.git
cd whyfail
npm install -g .
```

### 方式二：下载 ZIP 后安装

1. 在 GitHub 仓库页面点击 **Code → Download ZIP**。
2. 解压并在 PowerShell 中进入解压后的目录。
3. 执行：

```powershell
npm.cmd install -g .
```

### 验证安装

```powershell
whyfail --help
```

如果 PowerShell 的脚本执行策略阻止 `whyfail.ps1`，使用对应的 Windows 命令包装器：

```powershell
whyfail.cmd --help
```

看到 `WhyFail 0.5.0` 和命令帮助即表示安装成功。

## 30 秒开始使用

检查一个项目：

```powershell
whyfail auto --cwd "D:\projects\my-project"
```

PowerShell 执行策略受限时使用：

```powershell
whyfail.cmd auto --cwd "D:\projects\my-project"
```

WhyFail 完成检查后会输出本地报告地址：

```text
WhyFail UI: http://127.0.0.1:3967/?run=run_xxx
```

在浏览器中打开该地址即可查看报告。网页服务运行期间不要关闭当前终端；查看完毕后按 `Ctrl+C` 停止服务。

路径中存在空格时必须保留双引号：

```powershell
whyfail auto --cwd "D:\My Projects\demo"
```

## 建议先预览自动命令

`auto` 可能运行项目自身定义的测试或构建脚本。检查陌生仓库前建议先使用 `--plan`，它只显示将要执行的命令，不真正运行：

```powershell
whyfail auto --cwd "D:\projects\my-project" --plan
```

确认无误后再去掉 `--plan`：

```powershell
whyfail auto --cwd "D:\projects\my-project"
```

## 自动识别的语言

| 生态 | 识别依据 | 默认自动检查 |
| --- | --- | --- |
| JavaScript / TypeScript | `package.json`、`tsconfig.json`、源码扩展名 | 已有的 `typecheck`、`test`、`lint`、`build` 脚本，或语法/类型检查 |
| Python | `pyproject.toml`、requirements/setup 文件、`.py` | 存在测试时运行 `pytest`，否则做不导入程序的语法编译 |
| Rust | `Cargo.toml`、`.rs` | `cargo check --all-targets` |
| Go | `go.mod`、`.go` | `go test ./...` |
| Java / Kotlin | Maven/Gradle 文件、`.java`、`.kt` | Maven/Gradle 测试或编译检查 |
| C / C++ | `CMakeLists.txt`、C/C++ 源码 | CMake 配置/构建或 syntax-only 检查 |
| C# / .NET | `.sln`、`.csproj`、`.cs` | `dotnet build/test` 或编译检查 |
| Ruby | `Gemfile`、`.rb` | Rake 测试或 `ruby -c` |
| PHP | `composer.json`、`.php` | Composer test 或 `php -l` |
| Swift | `Package.swift`、`.swift` | `swift test` 或 `swiftc -typecheck` |
| 仓颉 Cangjie | `cjpm.toml`、`.cj` | 有 `*_test.cj` 时运行 `cjpm test`，否则运行 `cjpm build`；散文件使用 `cjc` |

混合语言仓库会生成一个汇总报告。点击失败的子检查，可以查看该命令的日志、诊断和相关源码。

## 检查任意命令

如果不想自动识别，也可以明确指定需要运行的命令。`--` 后面的内容会原样作为程序和参数执行：

```powershell
whyfail run -- python app.py
whyfail run -- python -m pytest tests
whyfail run -- npm.cmd run build
whyfail run -- cargo test
whyfail run -- cjpm build
```

不立即启动网页：

```powershell
whyfail run --no-web -- python app.py
```

稍后可以统一打开历史报告：

```powershell
whyfail ui
```

使用其他端口：

```powershell
whyfail ui --port 4100
```

## 修复后验证

每个可重跑的命令报告都有一个 Run ID，例如：

```text
run_20260716_032735_33ny
```

修改代码后，使用该 ID 重跑原工作目录中的同一条命令：

```powershell
whyfail verify run_20260716_032735_33ny
```

验证结果有三种：

- `resolved`：原命令现在退出码为 0，原错误已经不再复现。
- `reproduced`：再次得到相同诊断，错误仍可稳定复现。
- `changed`：命令仍失败，但变成另一类错误，请查看新报告。

多命令汇总报告不能直接重跑，请先打开其中一个子报告。手动导入的日志没有原始命令，也无法直接重跑。

## 黑匣子记录

从 v0.6.0 开始，`whyfail run`、`whyfail auto` 和 `whyfail check` 会自动在命令执行前后保存本地环境快照，不需要增加参数。网页报告中的“黑匣子记录”会显示：

- Git 分支、提交、工作区是否干净及未提交文件。
- CPU、可用内存、磁盘空间和 Node.js/操作系统版本。
- 常用工具链、虚拟环境、代理和 CI 环境变量是否存在。
- 项目根目录中依赖清单与锁文件的内容哈希。
- 最近 24 小时修改的源码文件。
- 命令执行期间发生变化的依赖/锁文件。

当同一命令在同一目录中曾经成功运行，后续报告会自动把当前快照与最近一次成功快照比较。例如，它可以指出 Node.js 版本、Git 提交、分支、环境变量或 `package-lock.json` 是否发生变化。第一次运行只建立基线，因此不会凭空推断变化原因。

为了避免泄露凭据，黑匣子只记录受支持环境变量的**名称和是否存在**，不保存它们的值；API Key、Token、密码和代理地址值都不会写入快照。报告仍保存在本机 WhyFail 数据目录中。

## 由用户启动的 Agent 修复

从 v0.7.0 开始，WhyFail 默认只诊断和记录，**不会自动修改代码**。失败的单命令报告会显示“交给 Agent 修复”按钮。点击后可以填写自己的要求，例如：

```text
尽量只做最小修改。
不要重构登录模块。
保持现有函数名和对外接口。
```

确认后，WhyFail 会：

1. 在本机 WhyFail 数据目录中创建项目的隔离源码副本。
2. 把诊断证据、源码位置、原命令和用户提示交给 Agent。
3. 等待 Agent 修改隔离副本。
4. 在隔离副本中重新执行原始命令。
5. 如果仍然失败，将新诊断用于下一轮，直到成功、无进展或达到尝试上限。
6. 把每轮 Agent 输出、修改文件、验证 Run ID 和停止原因保存到原报告的黑匣子中。

原项目不会被自动覆盖。`.env`、私钥、凭据文件和指向项目外部的符号链接不会复制给 Agent。`node_modules`、`.venv` 和 `venv` 只会在 WhyFail 运行验证命令期间临时链接，Agent 修改阶段不会看到这些链接。

网页是推荐入口，也可以从终端启动：

```powershell
whyfail heal run_20260719_120000_abcd `
  --instruction "只做最小修改，不要改变公开接口" `
  --max-attempts 3
```

### 配置修复 Agent

默认适配器尝试调用本机 `codex` 命令。用户需要自行安装并登录可用的 Codex CLI；这与仅用于诊断解释的 `WHYFAIL_API_KEY` 是两套独立配置。如果 Agent 不可用，报告会保留 `agent_unavailable` 状态和实际启动错误，不会修改原项目。

还可以接入任何能够从标准输入读取提示、在当前工作目录修改文件并以退出码报告状态的本地 Agent：

```powershell
$env:WHYFAIL_AGENT_COMMAND = "my-agent"
$env:WHYFAIL_AGENT_ARGS = '["repair", "--cwd", "{cwd}"]'
```

`WHYFAIL_AGENT_ARGS` 必须是 JSON 数组；`{cwd}` 会替换为隔离工作目录。不要把 API Key 或其他密钥直接写进参数数组。

## 导入已有日志

分析一个日志文件：

```powershell
whyfail analyze error.log
```

从标准输入导入：

```powershell
Get-Content error.log | whyfail analyze -
```

导入日志只进行分析，不会再次执行产生该日志的原命令。

## 多命令项目检查

如果自动模式不符合项目约定，可以在项目根目录创建 `whyfail.yaml`：

```yaml
name: backend-check

commands:
  - name: unit-tests
    run: ["python", "-m", "pytest"]

  - name: type-check
    run: ["python", "-m", "mypy", "."]

  - name: build
    run: ["python", "-m", "build"]
```

然后运行：

```powershell
whyfail check
```

命令使用参数数组执行，不经过 shell 字符串拼接。当前 `run` 不接受管道、重定向或 PowerShell 内建命令；这类输出可以保存后通过 `analyze` 导入。

## 从源码直接运行（贡献者）

如果不想全局安装，可以在 WhyFail 仓库根目录运行：

```powershell
node .\src\cli.js auto --cwd "D:\projects\my-project"
node .\src\cli.js ui
```

注意：`node src\cli.js ...` 是源码开发方式；普通用户全局安装后应直接使用 `whyfail ...`。

运行测试：

```powershell
npm.cmd test
```

当前测试套件使用 Node.js 内置测试运行器，不需要下载测试框架。

## 可选 AI 诊断

API 不是必需品。没有 API 时，自动识别、命令执行、源码行号、内置错误规则、本地网页和修复验证都可以正常使用。

配置 API 后，WhyFail 只在命令失败时请求模型，对内置规则难以覆盖的复杂错误进行补充分析，例如跨文件调用关系、多个错误信息之间的联系和更具体的排查建议。AI 不会修改代码、安装依赖或自动执行建议。

### 使用 OpenAI API

1. 在 [OpenAI API Keys](https://platform.openai.com/api-keys) 创建密钥，并确保 API 账户已配置可用额度。ChatGPT 订阅和 API 计费是不同的产品。
2. 在准备运行 WhyFail 的同一个 PowerShell 窗口设置环境变量：

```powershell
$env:WHYFAIL_API_KEY = "your-api-key"
$env:WHYFAIL_BASE_URL = "https://api.openai.com/v1"
$env:WHYFAIL_MODEL = "gpt-4.1-mini"
```

3. 在这个窗口正常运行：

```powershell
whyfail auto --cwd "D:\projects\my-project"
```

`WHYFAIL_BASE_URL` 和 `WHYFAIL_MODEL` 可选；不设置时分别使用 `https://api.openai.com/v1` 和 `gpt-4.1-mini`。其他供应商必须兼容 `/chat/completions`、Bearer 认证和 JSON object 响应格式。

以上 `$env:` 设置只在当前 PowerShell 进程及其子进程中有效。关闭窗口后密钥不会继续保留。提前关闭可以执行：

```powershell
Remove-Item Env:WHYFAIL_API_KEY
```

不要把真实 API Key 写进 README、源码、`.env` 后提交到 GitHub，也不要把密钥发给其他用户；每位用户应使用自己的密钥。

### API 会收到什么？

API 仅在失败诊断阶段收到经过遮盖处理的诊断上下文，包括命令与退出码、stderr 最后约 12,000 个字符、stdout 最后约 8,000 个字符，以及操作系统、运行时、项目清单摘要和已捕获的相关源码片段。完整原始报告仍保存在本机。

WhyFail 会尝试遮盖常见 API Key、Bearer Token、密码赋值、URL 凭据和当前用户主目录，但它不是完整的 DLP 系统。源码与日志仍可能包含业务数据，请只对有权上传的项目启用远程 API。API 调用会产生供应商费用。

## 本地数据与隐私

报告默认保存在被检查项目之外：

- Windows：`%LOCALAPPDATA%\WhyFail\runs`
- macOS：`~/Library/Application Support/WhyFail/runs`
- Linux：`~/.local/share/whyfail/runs`

查看实际数据目录：

```powershell
whyfail data-dir
```

开发或 CI 环境可通过 `WHYFAIL_DATA_DIR` 修改保存位置。

源码片段只从被检查的项目目录内读取，并限制单个片段和文件大小。WhyFail 不会因为诊断建议而自动编辑或删除用户文件。

## 更新与卸载

从 GitHub 克隆安装的用户可以进入仓库后更新：

```powershell
git pull
npm.cmd install -g .
```

卸载：

```powershell
npm.cmd uninstall -g whyfail-local
```

## 常见问题

### PowerShell 提示“无法将 whyfail 识别为 cmdlet”

说明还没有全局安装，或者 npm 全局目录没有加入 `PATH`。先在 WhyFail 源码目录执行：

```powershell
npm.cmd install -g .
```

然后检查：

```powershell
whyfail.cmd --help
```

### 为什么自动检查提示找不到 python、cargo、cjpm 等命令？

WhyFail 不安装目标语言工具链。请先安装对应编译器/运行时，并确认该命令可以在同一个终端中直接运行。

### 为什么网页没有自动弹出？

当前版本会启动本地网页服务并打印 URL，不会强制打开系统浏览器。复制终端中的 `http://127.0.0.1:...` 地址到浏览器即可。

### 为什么检查成功仍然需要确认？

退出码 0 能确认进程成功结束，但不一定代表业务结果完全正确。WhyFail 会保留关键输出，供用户与命令约定的成功结果对照。

## 当前限制

- 自动命令遵循常见生态约定，特殊项目建议使用 `whyfail.yaml`。
- 项目依赖和对应语言工具链必须提前安装。
- `run` 暂不解析 shell 管道、重定向或 shell 内建命令。
- 日志导入无法还原并重跑原始命令。
- 诊断建议和 Agent 修复都不会在用户明确确认前执行。
- 当前版本不会把隔离修复自动应用回原项目；请先检查报告中保留的工作目录。

## 许可证与设计说明

WhyFail 采用 [MIT License](LICENSE)。

亮色主题的视觉方向受到 [Esther Design System](https://github.com/esthersjw/esther-design-system) 启发；暗色主题参考独立的 [Ferrari DESIGN.md analysis](https://getdesign.md/ferrari/design-md)。本项目的页面实现为原创代码，没有复制上述项目的源文件、模板、图片或品牌素材。

暗色标题使用开源字体 [Fraunces](https://github.com/google/fonts/tree/main/ofl/fraunces)，字体文件遵循 SIL Open Font License 1.1，详见 `public/fonts/OFL-Fraunces.txt`。

## 参与贡献

欢迎提交 Issue 和 Pull Request。提交前请运行：

```powershell
npm.cmd test
```

本文安装示例使用的 GitHub 仓库地址为 `https://github.com/Derozanyu/whyfail`。

<p align="center"><a href="#english">Continue in English ↓</a></p>

---

<a id="english"></a>

### Desktop app (Windows prototype)

The desktop edition removes the need to type `whyfail auto --cwd ...`. Open WhyFail, click **+ Choose project**, select a project folder, and WhyFail will detect its languages, run safe checks, and open the report in the same window. The CLI and browser UI remain available and share the same run history.

The bottom-left **Settings** drawer contains the light/dark theme, Chinese/English language, and OpenAI-compatible API configuration. API keys are encrypted through Electron `safeStorage` and Windows DPAPI; the renderer cannot read a previously saved plaintext key. Local rule-based diagnosis remains available without an API.

Run the desktop app from source:

```powershell
npm.cmd install
npm.cmd run desktop
```

Build the Windows installer and portable executable:

```powershell
npm.cmd run desktop:dist
```

Artifacts are written to `dist-desktop`. The app bundles WhyFail's own runtime, but target toolchains such as Python, Rust, or Cangjie must still be installed when those projects are checked.

- `WhyFail-Portable-version-x64.exe`: a single-file portable build that extracts to the system temporary directory at runtime and does not create an installation record.
- `WhyFail-Setup-version-x64.exe`: the installer, with a selectable destination plus desktop and Start menu shortcuts.
- `SHA256SUMS.txt`: checksums for release verification. Upload all three files to a GitHub Release.

These local builds are not signed with a commercial code-signing certificate, so Windows SmartScreen may show “Unknown publisher” on another computer. Public releases should eventually be code-signed.

# WhyFail · English

> Automatically discover why a project fails, then present the cause, real source locations, captured logs, and verification results in a private local web dashboard.

WhyFail is a local-first command failure diagnostic tool. Give it a project directory and it will detect the languages and project structure, select suitable compilation, test, or static-analysis commands, and generate a web report with Chinese/English language switching and light/dark themes.

Reports stay on your computer by default. WhyFail does not automatically modify project code, install dependencies, or execute AI-generated fixes.

## Features

- Detect and inspect a project with one `whyfail auto` command.
- Support loose source files, complete projects, nested modules, and mixed-language repositories.
- Capture stdout, stderr, exit code, duration, runtime environment, and project manifests.
- Capture before/after black-box snapshots containing Git, resources, dependency files, and recent source changes.
- After explicit user confirmation, send custom repair instructions to a local Agent that iterates inside an isolated copy and records every verification attempt.
- Extract real source files, lines, and columns from diagnostics and display bounded code snippets.
- Diagnose common compilation, dependency, module-system, port, permission, and runtime failures.
- Rerun the original command with `whyfail verify` to determine whether a failure is resolved, reproduced, or changed.
- Preserve important output from successful commands so users can confirm expected behavior.
- Provide a local dashboard with Simplified Chinese/English, light/dark themes, and Markdown export.
- Work without an API key; optionally use an OpenAI-compatible API for deeper analysis.
- Require no runtime npm dependencies.

## Why use WhyFail when Codex or Claude already exists?

Coding agents such as Codex and Claude are strong at interactively understanding code, diagnosing errors, editing files, and running tests. If an agent already has access to the repository and the goal is to fix one failure, asking the agent directly may be faster. WhyFail does not try to outperform foundation models at reasoning, and “generate another AI explanation” is not its core value.

WhyFail is intended to become a **failure evidence and reproduction layer** that operates before, after, and between agents:

- **Standardized capture:** every language produces the same command, exit-code, environment, log, source-location, and verification structure.
- **Durable failure state:** preserve the scene before a terminal closes, logs scroll away, or ownership changes.
- **No AI account required:** built-in rules, local reports, source locations, and rerun verification work offline.
- **Auditable results:** diagnostic claims remain separate from raw evidence instead of existing only as an untraceable chat response.
- **Repeatable verification:** preserve the original argument array and working directory, then rerun the exact command after a change.
- **Model independence:** send the same evidence to an OpenAI-compatible model, another agent, or a human without binding the workflow to one chat product.
- **Non-interactive use:** the intended destination includes CI, automation, classrooms, and team handoffs where an agent is not continuously controlling the repository.

The recommended workflow is: let WhyFail capture structured evidence, give that report to Codex/Claude for repair, and let WhyFail rerun the original command to verify the result.

### Differentiation roadmap

The current release already provides local capture, source locations, normalized reports, exact-command reruns, and a first black-box recorder, but it still overlaps with coding agents. Future work should prioritize durable infrastructure rather than more chatbot-like behavior:

- [x] **Local black-box recording:** capture Git, system resources, environment-variable presence, project-file hashes, and recent source changes before and after a command, then compare failures with the latest success of the same command.
- [x] **Auditable Agent repair:** after a user submits repair instructions, an Agent works in an isolated copy while every file change, output, verification report, and stop reason is recorded.
- [ ] **Stable failure fingerprints:** normalize path and timestamp noise so the same failure receives the same ID across developer machines and CI, then cluster occurrences.
- [ ] **Portable reproduction bundles:** export a redacted `.whyfail` package containing logs, environment, manifests, required snippets, and reproduction instructions.
- [ ] **Run-to-run diffing:** add `whyfail diff <old-run> <new-run>` to show changes in dependencies, environment, command, source location, and output.
- [ ] **CI-standard artifacts:** emit SARIF/JUnit/JSON and source-line annotations for platforms such as GitHub Actions.
- [ ] **Success contracts:** let projects declare required fields, files, counts, or test conditions instead of treating exit code 0 as complete business success.

These capabilities are not reliably produced by a one-off model conversation. They require a deterministic tool installed in the execution environment, a versioned evidence format, and an auditable workflow. That is the moat WhyFail should build.

## Requirements

- [Node.js](https://nodejs.org/) 20 or newer.
- Git when installing with `git clone`.
- The toolchain required by the target project. For example, Python projects need `python`, Rust projects need `cargo`, and Cangjie projects need `cjc`/`cjpm`.

### Do not have Node.js yet?

Node.js is the runtime required by the current WhyFail release. npm is installed together with Node.js and does not need a separate download.

1. Open the [official Node.js download page](https://nodejs.org/en/download/).
2. Select an **LTS** release rather than the Current release.
3. On Windows, install the `.msi` package; on macOS, install the `.pkg`; on Linux, follow the package-manager or version-manager instructions on the download page.
4. Close and reopen PowerShell or your terminal after installation.

Then confirm that Node.js and npm are available:

```powershell
node --version
npm.cmd --version
```

WhyFail detects and invokes existing toolchains. It does not install compilers, runtimes, or project dependencies for the user.

## Installation

### Option 1: Clone from GitHub and install globally (recommended)

Replace the repository URL below with the real URL after publishing the project:

```powershell
git clone https://github.com/Derozanyu/whyfail.git
cd whyfail
npm.cmd install -g .
```

On macOS or Linux:

```bash
git clone https://github.com/Derozanyu/whyfail.git
cd whyfail
npm install -g .
```

### Option 2: Download the ZIP archive

1. Open the GitHub repository and select **Code → Download ZIP**.
2. Extract the archive and open PowerShell in the extracted directory.
3. Run:

```powershell
npm.cmd install -g .
```

### Confirm the installation

```powershell
whyfail --help
```

If the PowerShell execution policy blocks `whyfail.ps1`, use the Windows command shim:

```powershell
whyfail.cmd --help
```

The installation is ready when the output shows `WhyFail 0.5.0` and the command help.

## Quick start

Inspect a project:

```powershell
whyfail auto --cwd "D:\projects\my-project"
```

When PowerShell execution policy is restricted:

```powershell
whyfail.cmd auto --cwd "D:\projects\my-project"
```

After the checks complete, WhyFail prints a local report URL:

```text
WhyFail UI: http://127.0.0.1:3967/?run=run_xxx
```

Open the URL in a browser. Keep the terminal open while the dashboard is running, then press `Ctrl+C` when finished.

Always quote paths containing spaces:

```powershell
whyfail auto --cwd "D:\My Projects\demo"
```

## Preview automatic commands first

Automatic mode may run test or build scripts defined by the target repository. For an unfamiliar repository, start with `--plan`. It displays the exact commands without executing them:

```powershell
whyfail auto --cwd "D:\projects\my-project" --plan
```

After reviewing the plan, remove `--plan` to run the checks:

```powershell
whyfail auto --cwd "D:\projects\my-project"
```

## Automatically detected languages

| Ecosystem | Detection | Default automatic check |
| --- | --- | --- |
| JavaScript / TypeScript | `package.json`, `tsconfig.json`, source extensions | Existing `typecheck`, `test`, `lint`, or `build` scripts; otherwise syntax/type checking |
| Python | `pyproject.toml`, requirements/setup files, `.py` | `pytest` when tests exist; otherwise syntax compilation without importing the program |
| Rust | `Cargo.toml`, `.rs` | `cargo check --all-targets` |
| Go | `go.mod`, `.go` | `go test ./...` |
| Java / Kotlin | Maven/Gradle files, `.java`, `.kt` | Maven/Gradle tests or compiler checking |
| C / C++ | `CMakeLists.txt`, native source extensions | CMake configure/build or syntax-only checking |
| C# / .NET | `.sln`, `.csproj`, `.cs` | `dotnet build/test` or loose-source compiler checking |
| Ruby | `Gemfile`, `.rb` | Rake tests or `ruby -c` |
| PHP | `composer.json`, `.php` | Composer test or `php -l` |
| Swift | `Package.swift`, `.swift` | `swift test` or `swiftc -typecheck` |
| Cangjie | `cjpm.toml`, `.cj` | `cjpm test` when `*_test.cj` exists; otherwise `cjpm build`; loose files use `cjc` |

Mixed-language repositories produce a summary report. Open a failed child check to inspect its logs, diagnosis, and related source files.

## Inspect any command

To bypass automatic detection, specify the exact executable and arguments. Everything after `--` is passed as the program and argument array:

```powershell
whyfail run -- python app.py
whyfail run -- python -m pytest tests
whyfail run -- npm.cmd run build
whyfail run -- cargo test
whyfail run -- cjpm build
```

Capture the report without immediately starting the dashboard:

```powershell
whyfail run --no-web -- python app.py
```

Open report history later:

```powershell
whyfail ui
```

Use a different port:

```powershell
whyfail ui --port 4100
```

## Verify a fix

Every rerunnable command report has a Run ID, for example:

```text
run_20260716_032735_33ny
```

After changing the code, use that ID to rerun the exact command in its original working directory:

```powershell
whyfail verify run_20260716_032735_33ny
```

Verification has three possible outcomes:

- `resolved`: the command now exits with code 0 and the original failure no longer reproduces.
- `reproduced`: the same diagnosis appears again and the failure remains reproducible.
- `changed`: the command still fails, but with a different diagnosis; inspect the new report.

A multi-command summary cannot be rerun directly; open one of its child reports first. Imported logs do not contain a runnable original command and therefore cannot be rerun directly.

## Black-box recording

Starting with v0.6.0, `whyfail run`, `whyfail auto`, and `whyfail check` automatically save local snapshots before and after command execution. No extra flag is required. The “Black-box recording” section in the web report shows:

- Git branch, commit, clean/dirty state, and uncommitted files.
- CPU, available memory, disk space, and Node.js/operating-system versions.
- Whether common toolchain, virtual-environment, proxy, and CI variables are present.
- Content hashes for dependency manifests and lock files in the project root.
- Source files modified during the last 24 hours.
- Dependency or lock files changed while the command was running.

If the same command has previously succeeded in the same directory, a later report automatically compares the current snapshot with that latest successful snapshot. It can therefore highlight changes in Node.js, Git commit or branch, environment-variable presence, and files such as `package-lock.json`. The first run only establishes a baseline and does not invent a causal conclusion.

To avoid credential leakage, the recorder stores only the **names and presence state** of supported environment variables, never their values. API keys, tokens, passwords, and proxy address values are not written into the snapshot. Reports remain in the local WhyFail data directory.

## User-initiated Agent repair

Starting with v0.7.0, WhyFail diagnoses and records by default; it **never edits code automatically**. Failed single-command reports show an “Ask an Agent to repair” button. Before starting, the user can provide constraints such as:

```text
Make the smallest possible change.
Do not refactor authentication.
Keep existing function names and public interfaces.
```

After confirmation, WhyFail:

1. Creates an isolated source copy under the local WhyFail data directory.
2. Sends the diagnosis evidence, source locations, saved command, and user instructions to the Agent.
3. Waits for the Agent to edit the isolated copy.
4. Reruns the exact original command inside that copy.
5. Repeats with the new diagnosis until the command passes, no progress is made, or the attempt limit is reached.
6. Stores every Agent output, changed file, verification Run ID, and stop reason in the original report's black box.

The original project is never overwritten automatically. `.env` files, private keys, credential files, and symlinks pointing outside the project are not copied for the Agent. `node_modules`, `.venv`, and `venv` are linked only while WhyFail runs verification and are removed during the Agent editing phase.

The web UI is the recommended entry point. A terminal command is also available:

```powershell
whyfail heal run_20260719_120000_abcd `
  --instruction "Make the smallest change and keep public interfaces stable" `
  --max-attempts 3
```

### Configure the repair Agent

The default adapter attempts to invoke a local `codex` command. The user must install and authenticate a compatible Codex CLI separately; this is independent from `WHYFAIL_API_KEY`, which is only used for optional diagnostic explanations. If the Agent cannot start, the report preserves an `agent_unavailable` state and the actual launch error without changing the original project.

Any local Agent that reads its prompt from standard input, edits the current working directory, and reports status through its process exit code can be connected:

```powershell
$env:WHYFAIL_AGENT_COMMAND = "my-agent"
$env:WHYFAIL_AGENT_ARGS = '["repair", "--cwd", "{cwd}"]'
```

`WHYFAIL_AGENT_ARGS` must be a JSON array. `{cwd}` is replaced with the isolated workspace path. Do not put API keys or other secrets directly in the argument array.

## Import an existing log

Analyze a log file:

```powershell
whyfail analyze error.log
```

Import standard input:

```powershell
Get-Content error.log | whyfail analyze -
```

Log import performs analysis only. It does not execute the command that originally produced the log.

## Multi-command project checks

When automatic mode does not match a project's conventions, create `whyfail.yaml` in the project root:

```yaml
name: backend-check

commands:
  - name: unit-tests
    run: ["python", "-m", "pytest"]

  - name: type-check
    run: ["python", "-m", "mypy", "."]

  - name: build
    run: ["python", "-m", "build"]
```

Run it with:

```powershell
whyfail check
```

Commands are executed as argument arrays rather than shell strings. The current `run` command does not accept pipelines, redirections, or PowerShell built-ins; save that output and import it with `analyze` instead.

## Run directly from source (contributors)

To use WhyFail without a global installation, run it from the repository root:

```powershell
node .\src\cli.js auto --cwd "D:\projects\my-project"
node .\src\cli.js ui
```

`node src\cli.js ...` is the source-development workflow. After global installation, normal users should use `whyfail ...` directly.

Run the test suite:

```powershell
npm.cmd test
```

The test suite uses Node.js's built-in test runner and does not download a test framework.

## Optional AI diagnosis

The API is optional. Automatic detection, command execution, source locations, built-in diagnostic rules, the local dashboard, and fix verification all work without it.

When configured, WhyFail calls the model only after a command fails. The model supplements deterministic rules for complex failures, such as cross-file relationships, interactions among multiple diagnostics, and more specific investigation guidance. AI never edits code, installs dependencies, or automatically executes suggestions.

### Use the OpenAI API

1. Create a key at [OpenAI API Keys](https://platform.openai.com/api-keys) and ensure that the API account has available billing/credits. ChatGPT subscriptions and API billing are separate products.
2. Set environment variables in the same PowerShell window that will run WhyFail:

```powershell
$env:WHYFAIL_API_KEY = "your-api-key"
$env:WHYFAIL_BASE_URL = "https://api.openai.com/v1"
$env:WHYFAIL_MODEL = "gpt-4.1-mini"
```

3. Run WhyFail normally in that window:

```powershell
whyfail auto --cwd "D:\projects\my-project"
```

`WHYFAIL_BASE_URL` and `WHYFAIL_MODEL` are optional. Their defaults are `https://api.openai.com/v1` and `gpt-4.1-mini`. Other providers must support `/chat/completions`, Bearer authentication, and JSON object response format.

The `$env:` values apply only to the current PowerShell process and its children. They disappear after the window closes. Remove the key earlier with:

```powershell
Remove-Item Env:WHYFAIL_API_KEY
```

Never commit a real key in README, source code, or a `.env` file, and never share it with other users. Each user should provide their own key.

### What is sent to the API?

Only failed diagnoses invoke the API. The redacted diagnostic context includes the command and exit code, approximately the last 12,000 characters of stderr, the last 8,000 characters of stdout, and context such as OS/runtime information, manifest summaries, and captured related source snippets. The complete original report remains local.

WhyFail attempts to redact common API keys, bearer tokens, password assignments, URL credentials, and the current home-directory prefix, but it is not a complete DLP system. Source and logs may still contain business data, so only enable a remote API for projects you are authorized to upload. API calls may incur provider charges.

## Local data and privacy

Reports are stored outside the inspected project by default:

- Windows: `%LOCALAPPDATA%\WhyFail\runs`
- macOS: `~/Library/Application Support/WhyFail/runs`
- Linux: `~/.local/share/whyfail/runs`

Display the actual data directory:

```powershell
whyfail data-dir
```

Development and CI environments can override it with `WHYFAIL_DATA_DIR`.

Source snippets are only read from inside the inspected project and are bounded by file and snippet limits. WhyFail does not edit or delete user files in response to diagnostic suggestions.

## Update and uninstall

For an installation cloned from GitHub:

```powershell
git pull
npm.cmd install -g .
```

Uninstall WhyFail:

```powershell
npm.cmd uninstall -g whyfail-local
```

## Troubleshooting

### PowerShell says that `whyfail` is not recognized

The CLI is not globally installed, or npm's global command directory is not present in `PATH`. From the WhyFail source directory, run:

```powershell
npm.cmd install -g .
```

Then verify the Windows command shim:

```powershell
whyfail.cmd --help
```

### Automatic checking cannot find `python`, `cargo`, `cjpm`, or another tool

WhyFail does not install target-language toolchains. Install the relevant compiler/runtime and confirm that its command works in the same terminal.

### Why did the browser not open automatically?

The current release starts a local web server and prints its URL without forcing the system browser to open. Copy the printed `http://127.0.0.1:...` URL into a browser.

### Why does a successful check still require confirmation?

Exit code 0 confirms that a process completed successfully, but it does not prove every business expectation. WhyFail preserves important output so the user can compare it with the command's success contract.

## Current limitations

- Automatic command selection follows common ecosystem conventions; custom projects should use `whyfail.yaml`.
- Project dependencies and language toolchains must already be installed.
- `run` does not currently parse shell pipelines, redirections, or shell built-ins.
- Imported logs cannot reconstruct and rerun the original command.
- Diagnostic suggestions and Agent repairs are never executed without explicit user confirmation.
- Applying an isolated repair back to the original project is not automated in the current release; inspect the retained workspace first.

## License and design notes

WhyFail is released under the [MIT License](LICENSE).

The light theme's visual direction is inspired by the [Esther Design System](https://github.com/esthersjw/esther-design-system). The dark theme references the independent [Ferrari DESIGN.md analysis](https://getdesign.md/ferrari/design-md). This repository's UI implementation is original and does not copy source files, templates, imagery, or brand assets from those references.

Dark-theme display typography uses the open-source [Fraunces](https://github.com/google/fonts/tree/main/ofl/fraunces) font under the SIL Open Font License 1.1. See `public/fonts/OFL-Fraunces.txt`.

## Contributing

Issues and pull requests are welcome. Before submitting a change, run:

```powershell
npm.cmd test
```

The installation examples use `https://github.com/Derozanyu/whyfail` as the repository URL.

<p align="center">
  <a href="#top">Back to top</a>
  ·
  <a href="#chinese">简体中文</a>
</p>
