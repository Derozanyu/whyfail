import { redact } from './redact.js';

function localized(en, zh) { return { en, 'zh-CN': zh }; }

const rules = [
  {
    id: 'nullish-property-access',
    test: (text) => /Cannot read propert(?:y|ies) of (?:undefined|null)|undefined is not an object|NoneType.*has no attribute/i.test(text),
    build: () => ({
      code: 'nullish_value_access', confidence: 0.88,
      title: localized('A null or undefined value was used as an object', '将空值或 undefined 当作对象使用'),
      explanation: localized(
        'A value reached this code path without the object shape the function expects. The first application-owned stack frame is the immediate failure point; earlier frames show where the invalid value was passed.',
        '某个值进入当前代码路径时，不具备函数预期的对象结构。第一个属于应用自身的堆栈位置是直接失败点，更早的调用位置可以说明无效值从哪里传入。'),
      suggestions: [localized('Trace the value backward through the captured application frames and verify the caller contract before adding a fallback.', '沿已捕获的应用调用栈反向追踪该值，在添加兜底逻辑前先确认调用方契约。')]
    })
  },
  {
    id: 'missing-module',
    test: (text) => /ModuleNotFoundError|Cannot find module|ERR_MODULE_NOT_FOUND/i.test(text),
    build: () => ({
      code: 'missing_dependency', confidence: 0.9,
      title: localized('A required module cannot be resolved', '无法解析所需模块'),
      explanation: localized(
        'The runtime cannot find a module referenced by the application. The dependency may be missing, installed in another environment, or referenced with an invalid path.',
        '运行时无法找到应用引用的模块。该依赖可能未安装、安装在其他环境中，或者引用路径有误。'),
      suggestions: [localized('Confirm the active runtime and dependency environment, then inspect the missing module in the manifest or lockfile.', '确认当前运行时与依赖环境，然后在清单或锁文件中检查缺失模块。')]
    })
  },
  {
    id: 'esm-cjs',
    test: (text) => /require is not defined in ES module scope|Cannot use import statement outside a module/i.test(text),
    build: () => ({
      code: 'module_system_mismatch', confidence: 0.96,
      title: localized('ESM/CommonJS module boundary mismatch', 'ESM 与 CommonJS 模块边界不匹配'),
      explanation: localized(
        'The file is being loaded under one JavaScript module system but uses syntax from the other module system.',
        '该文件按一种 JavaScript 模块系统加载，却使用了另一种模块系统的语法。'),
      suggestions: [
        localized('Keep the project as ESM and convert require() calls to import statements.', '保持项目使用 ESM，并将 require() 调用转换为 import。'),
        localized('Alternatively, mark the affected configuration file as CommonJS with a .cjs extension.', '或者将相关配置文件改为 .cjs 扩展名，使其按 CommonJS 加载。')
      ]
    })
  },
  {
    id: 'rust-ownership',
    test: (text) => /borrow of moved value|use of moved value|cannot borrow .* as mutable|does not live long enough|lifetime may not live long enough/i.test(text),
    build: () => ({
      code: 'rust_ownership_error', confidence: 0.94,
      title: localized('Rust ownership or lifetime constraints were violated', '违反了 Rust 所有权或生命周期约束'),
      explanation: localized('The compiler found a move, borrow, mutability, or lifetime relationship that cannot be proven safe.', '编译器发现移动、借用、可变性或生命周期关系无法证明是安全的。'),
      suggestions: [localized('Follow the first rustc source span and inspect where the value was moved or how long the borrow must remain valid.', '从 rustc 报告的第一个源码位置开始，检查值在哪里被移动，以及借用需要保持有效多久。')]
    })
  },
  {
    id: 'go-compile',
    test: (text) => /(?:^|\n).+\.go:\d+(?::\d+)?:.*(?:undefined:|assignment mismatch|cannot use|import cycle not allowed)/i.test(text),
    build: () => ({
      code: 'go_compile_error', confidence: 0.92,
      title: localized('Go compilation or type checking failed', 'Go 编译或类型检查失败'),
      explanation: localized('The Go toolchain reported an unresolved name, incompatible value, return-count mismatch, or package import cycle.', 'Go 工具链报告了未解析名称、不兼容值、返回值数量不匹配或包导入循环。'),
      suggestions: [localized('Inspect the first reported .go location, then verify the symbol, value type, and imported package boundary.', '检查第一个报告的 .go 位置，并核对符号、值类型和导入包边界。')]
    })
  },
  {
    id: 'jvm-compile',
    test: (text) => /cannot find symbol|incompatible types:|unresolved reference:|type mismatch: inferred type is|Compilation failed/i.test(text),
    build: () => ({
      code: 'jvm_compile_error', confidence: 0.9,
      title: localized('Java or Kotlin compilation failed', 'Java 或 Kotlin 编译失败'),
      explanation: localized('The JVM compiler could not resolve a symbol or reconcile the declared and actual types.', 'JVM 编译器无法解析某个符号，或无法统一声明类型与实际类型。'),
      suggestions: [localized('Check the first application source location, imports, dependency scope, and the exact method or property signature.', '检查第一个应用源码位置、导入、依赖作用域以及对应方法或属性的准确签名。')]
    })
  },
  {
    id: 'cangjie-dependency',
    test: (text) => /(?:cjpm|Error:)[^\n]*(?:cyclic dependency|can not find (?:the following )?dependencies|cannot find (?:the following )?dependencies)/i.test(text),
    build: () => ({
      code: 'cangjie_dependency_error', confidence: 0.94,
      title: localized('Cangjie package dependency resolution failed', '仓颉包依赖解析失败'),
      explanation: localized('CJPM found a missing dependency or a dependency cycle in the module graph.', 'CJPM 在模块依赖图中发现了缺失依赖或循环依赖。'),
      suggestions: [localized('Check cjpm.toml and the dependency chain named in the first CJPM error.', '检查 cjpm.toml，以及第一条 CJPM 错误中指出的依赖链。')]
    })
  },
  {
    id: 'cangjie-test',
    test: (text) => /(?:\[\s*FAILED\s*\].*CASE|FAILED\s*:\s*[1-9]\d*)/i.test(text) && /(?:CASE|Summary\s*:|cjpm)/i.test(text),
    build: () => ({
      code: 'cangjie_test_failure', confidence: 0.93,
      title: localized('A Cangjie unit test failed', '仓颉单元测试失败'),
      explanation: localized('The Cangjie test runner completed with one or more failed test cases.', '仓颉测试运行器执行完成，但存在一个或多个失败用例。'),
      suggestions: [localized('Start with the first failed CASE and compare its assertion with the source location captured in the report.', '从第一个失败的 CASE 开始，将断言与报告中捕获的源码位置对照检查。')]
    })
  },
  {
    id: 'cangjie-compile',
    test: (text) => /\.cj:\d+(?::\d+)?/i.test(text) && /(?:\berror\b|expected|undeclared|cannot|type mismatch|ambiguous)/i.test(text),
    build: () => ({
      code: 'cangjie_compile_error', confidence: 0.93,
      title: localized('Cangjie compilation or type checking failed', '仓颉编译或类型检查失败'),
      explanation: localized('The Cangjie compiler reported a syntax, name-resolution, or type-checking diagnostic.', '仓颉编译器报告了语法、名称解析或类型检查错误。'),
      suggestions: [localized('Inspect the first reported .cj line and column, then verify the symbol, import, and expected type.', '检查第一处报告的 .cj 源码行和列，然后核对符号、导入与预期类型。')]
    })
  },
  {
    id: 'native-compile-link',
    test: (text) => /undefined reference to|no matching function for call|was not declared in this scope|undeclared identifier|fatal error: .* file not found|LNK\d+/i.test(text),
    build: () => ({
      code: 'native_compile_or_link_error', confidence: 0.91,
      title: localized('C or C++ compilation/linking failed', 'C 或 C++ 编译/链接失败'),
      explanation: localized('The native toolchain found a missing declaration, incompatible call, missing header, or unresolved linker symbol.', '本地编译工具链发现缺失声明、不兼容调用、缺失头文件或无法解析的链接符号。'),
      suggestions: [localized('Use the first compiler location for source errors; for linker errors, verify the defining object/library is part of the link command.', '源码错误从第一个编译器位置开始；链接错误则确认定义该符号的目标文件或库已加入链接命令。')]
    })
  },
  {
    id: 'dotnet-compile',
    test: (text) => /\berror\s+CS\d{4}\b|Unhandled exception\. System\.|System\.NullReferenceException/i.test(text),
    build: () => ({
      code: 'dotnet_error', confidence: 0.9,
      title: localized('.NET compilation or runtime execution failed', '.NET 编译或运行失败'),
      explanation: localized('The .NET toolchain reported a C# compiler diagnostic or an unhandled runtime exception.', '.NET 工具链报告了 C# 编译诊断或未处理的运行时异常。'),
      suggestions: [localized('Use the CS diagnostic code and first project-owned .cs frame to verify the symbol, nullable contract, and target framework.', '结合 CS 诊断码与第一个项目内 .cs 位置，核对符号、可空性契约和目标框架。')]
    })
  },
  {
    id: 'ruby-error',
    test: (text) => /(?:NoMethodError|NameError|LoadError|ArgumentError|SyntaxError).*\(.*\)|\.rb:\d+:in `/i.test(text),
    build: () => ({
      code: 'ruby_error', confidence: 0.88,
      title: localized('Ruby loading, syntax, or method dispatch failed', 'Ruby 加载、语法或方法调用失败'),
      explanation: localized('Ruby could not load a dependency, resolve a constant/method, or parse the source.', 'Ruby 无法加载依赖、解析常量或方法，或者无法解析源码。'),
      suggestions: [localized('Inspect the first project-owned .rb frame and confirm the active bundle, receiver class, and method arguments.', '检查第一个项目内 .rb 位置，并确认当前 bundle、接收者类型和方法参数。')]
    })
  },
  {
    id: 'php-error',
    test: (text) => /PHP (?:Parse error|Fatal error)|Uncaught (?:Error|TypeError)|Call to undefined (?:function|method)/i.test(text),
    build: () => ({
      code: 'php_error', confidence: 0.9,
      title: localized('PHP parsing or execution failed', 'PHP 解析或执行失败'),
      explanation: localized('PHP reported a parse failure, missing callable/class, type error, or uncaught fatal error.', 'PHP 报告了解析失败、缺失函数或类、类型错误或未捕获的致命错误。'),
      suggestions: [localized('Inspect the reported PHP file and line, then verify Composer autoloading and the callable signature.', '检查报告的 PHP 文件与行号，并核对 Composer 自动加载和调用签名。')]
    })
  },
  {
    id: 'swift-compile',
    test: (text) => /\.swift:\d+:\d+:\s+error:|cannot find .* in scope|value of type .* has no member/i.test(text),
    build: () => ({
      code: 'swift_compile_error', confidence: 0.92,
      title: localized('Swift compilation or type checking failed', 'Swift 编译或类型检查失败'),
      explanation: localized('The Swift compiler found an unresolved symbol, missing member, or incompatible type relationship.', 'Swift 编译器发现未解析符号、缺失成员或不兼容的类型关系。'),
      suggestions: [localized('Inspect the first .swift diagnostic and verify module imports, optional handling, and the inferred generic type.', '检查第一个 .swift 诊断位置，并核对模块导入、可选值处理和推断出的泛型类型。')]
    })
  },
  {
    id: 'address-in-use',
    test: (text) => /EADDRINUSE|address already in use|端口.*占用/i.test(text),
    build: () => ({
      code: 'address_in_use', confidence: 0.94,
      title: localized('The requested network address is already in use', '请求的网络地址已被占用'),
      explanation: localized('Another process is already listening on the requested port or address.', '另一个进程已经监听了所请求的端口或地址。'),
      suggestions: [localized('Identify the listening process or configure the application to use another port.', '查找正在监听的进程，或将应用配置为使用其他端口。')]
    })
  },
  {
    id: 'permission',
    test: (text) => /EACCES|Permission denied|Access is denied|权限不足|拒绝访问/i.test(text),
    build: () => ({
      code: 'permission_denied', confidence: 0.86,
      title: localized('The operation was denied by the operating system', '操作被操作系统拒绝'),
      explanation: localized('The process lacks permission to access a required file, directory, port, or executable.', '当前进程没有权限访问所需的文件、目录、端口或可执行程序。'),
      suggestions: [localized('Inspect ownership and permissions for the exact resource named in the error before increasing privileges.', '先检查错误中具体资源的所有权和权限，再考虑提升权限。')]
    })
  },
  {
    id: 'syntax',
    test: (text) => /SyntaxError|ParseError|unexpected token|语法错误/i.test(text),
    build: () => ({
      code: 'syntax_error', confidence: 0.84,
      title: localized('The source could not be parsed', '源代码无法被解析'),
      explanation: localized('The parser encountered syntax it does not accept. The reported line may be the failure point rather than the original mistake.', '解析器遇到了无法接受的语法。报告行可能只是失败位置，不一定是最初写错的位置。'),
      suggestions: [localized('Inspect the reported line and the immediately preceding block, then verify the configured language/runtime version.', '检查报告行及其前一个代码块，并确认配置的语言或运行时版本。')]
    })
  }
];

function evidenceFrom(run) {
  const combined = `${run.stderr}\n${run.stdout}`;
  const lines = combined.split(/\r?\n/).filter(Boolean);
  const important = lines.filter((line) => /error|exception|failed|cannot|denied|not found|undefined|traceback/i.test(line));
  return [...new Set((important.length ? important : lines.slice(-8)).map(redact))].slice(0, 8);
}

export function ruleDiagnosis(run) {
  const text = `${run.stderr}\n${run.stdout}`;
  const rule = rules.find((item) => item.test(text));
  const base = rule ? rule.build() : {
    code: 'unclassified_failure', confidence: 0.45,
    title: localized('The command failed and requires further investigation', '命令执行失败，需要进一步排查'),
    explanation: localized('No high-confidence built-in rule matched this failure. Review the captured evidence and use an AI provider for deeper analysis.', '没有高置信度的内置规则匹配该错误。请检查已捕获的证据，或配置 AI 提供方进行深入分析。'),
    suggestions: [localized('Start with the first application-owned stack frame and compare the current environment with the last known working state.', '从第一个属于应用自身的堆栈位置开始，并对比当前环境与最近一次正常运行时的差异。')]
  };
  return {
    source: rule ? 'builtin-rule' : 'generic-fallback',
    ...base,
    evidence: evidenceFrom(run),
    verification: rule
      ? {
          status: 'verified',
          title: localized('Failure type verified', '错误类型已验证'),
          explanation: localized('The compiler, runtime, or operating-system output directly confirms this failure class. The suggested investigation still helps locate the code-level reason behind it.', '编译器、运行时或操作系统输出已直接确认此错误类型；上方排查建议用于继续定位代码层面的成因。')
        }
      : {
          status: 'needs-confirmation',
          title: localized('Further verification required', '需要进一步验证'),
          explanation: localized('No dedicated diagnostic signature confirmed a specific failure class. Reproduce the failure with a narrower command and inspect the first project-owned source frame.', '目前没有专用诊断特征确认具体错误类型。请用更小范围的命令复现，并检查第一处项目源码位置。')
        },
    unverified: rule ? [] : [localized('Run the narrowest relevant compiler, test, or type-check command and compare its first error with the captured evidence.', '运行范围最小的相关编译、测试或类型检查命令，并将第一条错误与已捕获证据进行对照。')]
  };
}

export async function diagnose(run) {
  const fallback = ruleDiagnosis(run);
  if (!process.env.WHYFAIL_API_KEY) return fallback;
  try {
    const endpoint = (process.env.WHYFAIL_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const payload = {
      model: process.env.WHYFAIL_MODEL || 'gpt-4.1-mini',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are an evidence-driven software failure diagnostician. Return JSON only with bilingual en and zh-CN text. Never claim a cause is verified without evidence.' },
        { role: 'user', content: JSON.stringify({
          schema: { code: 'string', confidence: '0..1', title: { en: 'string', 'zh-CN': 'string' }, explanation: { en: 'string', 'zh-CN': 'string' }, suggestions: [{ en: 'string', 'zh-CN': 'string' }], unverified: [{ en: 'string', 'zh-CN': 'string' }] },
          run: { command: run.command, exitCode: run.exitCode, stderr: redact(run.stderr).slice(-12000), stdout: redact(run.stdout).slice(-8000), context: run.context }
        }) }
      ]
    };
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.WHYFAIL_API_KEY}` }, body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
    const result = await response.json();
    const parsed = JSON.parse(result.choices[0].message.content);
    return {
      ...fallback,
      ...parsed,
      source: 'ai',
      evidence: fallback.evidence,
      verification: {
        status: 'needs-confirmation',
        title: localized('AI hypothesis requires confirmation', 'AI 推测需要验证'),
        explanation: localized('The AI explanation is an evidence-based hypothesis, not the result of a dedicated verification command. Use the suggested check before treating the deeper cause as confirmed.', 'AI 解释是基于证据的推测，并非专门验证命令的结果。在确认深层原因前，请先执行建议的检查。')
      }
    };
  } catch (error) {
    return { ...fallback, providerError: redact(error.message) };
  }
}
