<a id="top"></a>

# WhyFail

<p align="center">
  <a href="#chinese">简体中文</a>
  ·
  <a href="#english">English</a>
</p>

<a id="chinese"></a>

## 简体中文

> 自动检查项目为什么运行失败，并在本地网页中展示错误原因、真实源码行号、现场日志和验证结果。

WhyFail 是一个本地优先的命令失败诊断工具。你只需要提供项目目录，它会自动识别语言和项目结构，选择合适的编译、测试或静态检查命令，并生成可切换中英文、亮色/暗色主题的网页报告。

数据和历史报告默认保留在你的电脑中。WhyFail 不会自动修改项目代码、安装依赖或执行 AI 生成的修复命令。

## 主要功能

- 一条 `whyfail auto` 自动识别语言并检查项目。
- 支持单文件、完整工程、嵌套模块和混合语言仓库。
- 捕获 stdout、stderr、退出码、耗时、运行环境及项目清单。
- 从错误日志中定位真实源文件、行号和列号，并展示相关代码片段。
- 内置常见编译、依赖、模块系统、端口、权限和运行时错误诊断。
- 通过 `whyfail verify` 重跑原命令，判断错误已解决、仍可复现或发生变化。
- 成功命令也会保留关键输出，方便确认结果是否符合预期。
- 本地网页支持简体中文/English、亮色/暗色主题和 Markdown 导出。
- 没有 API Key 也能使用；可选接入 OpenAI-compatible API 进行更深分析。
- 零运行时 npm 依赖。

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

没有任何 API 配置时，WhyFail 使用确定性的内置规则。需要更深入的 AI 分析时，可以配置 OpenAI-compatible `/chat/completions` 服务：

```powershell
$env:WHYFAIL_API_KEY = "your-api-key"
$env:WHYFAIL_BASE_URL = "https://api.openai.com/v1"
$env:WHYFAIL_MODEL = "gpt-4.1-mini"
```

`WHYFAIL_BASE_URL` 和 `WHYFAIL_MODEL` 可选。调用远程服务前，WhyFail 会尝试遮盖常见 API Key、Bearer Token、密码赋值、URL 凭据和当前用户主目录，但它不是完整的 DLP 系统。请只处理你有权上传的日志。

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
- 诊断建议不会被自动执行。

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

# WhyFail · English

> Automatically discover why a project fails, then present the cause, real source locations, captured logs, and verification results in a private local web dashboard.

WhyFail is a local-first command failure diagnostic tool. Give it a project directory and it will detect the languages and project structure, select suitable compilation, test, or static-analysis commands, and generate a web report with Chinese/English language switching and light/dark themes.

Reports stay on your computer by default. WhyFail does not automatically modify project code, install dependencies, or execute AI-generated fixes.

## Features

- Detect and inspect a project with one `whyfail auto` command.
- Support loose source files, complete projects, nested modules, and mixed-language repositories.
- Capture stdout, stderr, exit code, duration, runtime environment, and project manifests.
- Extract real source files, lines, and columns from diagnostics and display bounded code snippets.
- Diagnose common compilation, dependency, module-system, port, permission, and runtime failures.
- Rerun the original command with `whyfail verify` to determine whether a failure is resolved, reproduced, or changed.
- Preserve important output from successful commands so users can confirm expected behavior.
- Provide a local dashboard with Simplified Chinese/English, light/dark themes, and Markdown export.
- Work without an API key; optionally use an OpenAI-compatible API for deeper analysis.
- Require no runtime npm dependencies.

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

Without API configuration, WhyFail uses deterministic built-in rules. For deeper AI analysis, configure an OpenAI-compatible `/chat/completions` service:

```powershell
$env:WHYFAIL_API_KEY = "your-api-key"
$env:WHYFAIL_BASE_URL = "https://api.openai.com/v1"
$env:WHYFAIL_MODEL = "gpt-4.1-mini"
```

`WHYFAIL_BASE_URL` and `WHYFAIL_MODEL` are optional. Before calling a remote service, WhyFail attempts to redact common API keys, bearer tokens, password assignments, URL credentials, and the current home-directory prefix. It is not a complete DLP system; only process logs you are authorized to upload.

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
- Diagnostic suggestions are never executed automatically.

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
