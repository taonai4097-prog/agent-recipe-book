#!/usr/bin/env node
/**
 * agent-recipe-book · setup.js
 * ---------------------------------------------------------------------------
 * 解决的问题：MCP 的 `initialize.instructions` 字段要「客户端愿意把它注入模型上下文」
 * 才生效，这一步不归仓库控制。为了让「下载本项目的人」能稳定地让 Agent 用上配方库，
 * 本脚本把使用规矩写进**当前项目**的客户端说明书文件（AGENTS.md / CLAUDE.md /
 * .github/copilot-instructions.md / CODEBUDDY.md），只要客户端读这个文件，规矩就一定
 * 到得了模型眼前。
 *
 * 用法（在「你自己的项目根目录」运行，而不是在 recipe-book 仓库里）：
 *   node path/to/agent-recipe-book/scripts/setup.js
 *   node setup.js --yes                 # 跳过交互确认（CI / 非交互）
 *   node setup.js --dry-run             # 只打印将做什么，不写文件
 *   node setup.js --client workbuddy    # 强制写入 CODEBUDDY.md
 *   node setup.js --file ./AGENTS.md    # 写到指定文件
 *   node setup.js --target ../my-project# 操作指定目录（默认当前目录）
 *   node setup.js --rules ./my-rules.md # 用自定义规矩文件（默认读 ../docs/RECIPE_BOOK_RULES.md）
 *
 * 依赖：仅 Node 内置模块（fs / path / readline / url），无需 npm install。
 *
 * ⚠️ 模块形态：本仓库 package.json 为 "type": "module"，因此本文件必须是 ESM。
 *    写成 CommonJS 的 require() 会在 `node scripts/setup.js` 时直接抛
 *    "require is not defined in ES module scope"（已由 tests/setup.test.js 的 T1 断言拦住
 *    ——别再改回 require，那个坑本库已收录为
 *    recipe-node-cjs-require-under-type-module）。
 * ---------------------------------------------------------------------------
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const SENTINEL_START = "<!-- agent-recipe-book:rules:start -->";
const SENTINEL_END = "<!-- agent-recipe-book:rules:end -->";

// 各客户端 -> 默认说明书文件名（相对于 target 项目目录）
//
// 文件名依据（已核实官方文档，不再是猜测）：
//   · WorkBuddy / CodeBuddy：官方「规则」页明确支持项目根目录的 CODEBUDDY.md，
//     默认把全文放进上下文；并声明「当项目根目录存在 AGENTS.md 而不存在 CODEBUDDY.md 时，
//     自动加载 AGENTS.md 的完整内容」。即 AGENTS.md 是它的**回落**，不是平级。
//     另有 .codebuddy/CODEBUDDY.md 与 .codebuddy/rules/*.md 两种位置。
//     来源：https://www.workbuddy.cn/docs/ide/User-guide/Rules 、/docs/cli/memory
//   · Claude Code：只读 CLAUDE.md（不读 AGENTS.md；官方推荐在 CLAUDE.md 里 @AGENTS.md 导入）。
//   · GitHub Copilot：.github/copilot-instructions.md（近版亦支持 AGENTS.md）。
const CLIENT_FILES = {
  agents: "AGENTS.md",
  claude: "CLAUDE.md",
  copilot: path.join(".github", "copilot-instructions.md"),
  workbuddy: "CODEBUDDY.md",
};

// 内置兜底规矩（与 docs/RECIPE_BOOK_RULES.md 一致；优先读外部文件）
const FALLBACK_RULES = `${SENTINEL_START}
<!-- 本段由 scripts/setup.js 注入，请勿手改标记行；重新运行 setup 会整体替换此段 -->

## agent-recipe-book 使用规矩（自动注入）

> 本段由 \`agent-recipe-book\` 的 setup 脚本写入。它告诉你的 Agent：当 \`agent-recipe-book\`
> 这个 MCP 已连接时，该怎么可靠地用它。原因见下——MCP 的 \`instructions\` 字段要客户端
> 愿意注入模型上下文才生效，这一步不归仓库控制；把规矩写进客户端说明书文件，只要客户端
> 读这个文件，规矩就一定到得了模型眼前。

### 1. 动手前先查

遇到下面这些卡点，**先用 \`search_recipes\` 检索一遍**，再动手：

网页采集 · 编码乱码 · 反爬 · 限流 · 分页 · 会话/cookie 丢失 · 无头浏览器 ·
网站工程 · 工具链 · 评测方法论 · 项目判断 · 前端布局与验证

别人踩过的坑，比你自己从头试更省时间。检索前也可先看 \`experience-guide\` 这个 prompt。

### 2. 引用要带 id

每条结论后面标上 \`[配方id]\`，例如 \`[recipe-py-encoding-mojibake]\`。
带 id 人才能核对，也才能判断这条经验对不对得上自己的场景。

### 3. 查不到，就说查不到

**不要用你自己的知识补答案。** 库的价值在于「真的有人踩过」，
你补的每一句都会被人当成真实经验——那就把库毁了。没命中就明说「查不到」，绝不编造。

### 4. 解卡之后，投稿

检索**没命中**、而你随后把问题解决了：用 \`submit_recipe\` 把这条坑记进库。

- 投稿先进隔离池，**人复核后才公开**（不会一写就污染公开索引）
- 必填字段：\`id\` \`title\` \`tags\` \`model\` \`problem\` \`dead_ends\` \`solution\` \`status\`
- \`dead_ends\` 每条要有四段：试过什么 / 结果如何 / 卡了多久 / 本可提前避开的信号

你这次踩的坑，就是下一个人省下的时间。

### 5. 投稿前先脱敏

去掉：绝对路径 · token / 密钥 · 内网域名与 IP · 项目真名 · 同事姓名。
（本仓库有脱敏自检闸门，写了会被拦下。）

### 如果你看不到投稿工具

\`tools/list\` 里没有 \`submit_recipe\`，说明**当前这个连接是只读的**。
开启方式：环境变量 \`RECIPE_BOOK_WRITE=1\`，改完**必须重启会话**才生效——
MCP 在客户端启动时加载，运行时改配置不会重新读。

### 一句话记住

**动手前先查，查不到说查不到，解卡了记得投稿。**

${SENTINEL_END}
`;

function parseArgs(argv) {
  const opts = {
    yes: false,
    dryRun: false,
    force: false,
    client: null,
    file: null,
    target: null,
    rules: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--yes") opts.yes = true;
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--force") opts.force = true;
    else if (a === "--client") opts.client = (argv[++i] || "").toLowerCase();
    else if (a === "--file") opts.file = argv[++i];
    else if (a === "--target") opts.target = argv[++i];
    else if (a === "--rules") opts.rules = argv[++i];
    else if (a === "-h" || a === "--help") {
      printHelp();
      process.exit(0);
    } else {
      console.warn(`⚠️  未知参数：${a}（用 --help 查看用法）`);
    }
  }
  return opts;
}

function printHelp() {
  console.log(`
agent-recipe-book setup —— 把使用规矩写进客户端说明书文件

用法：
  node setup.js [选项]

选项：
  --yes            跳过交互确认直接写入（CI / 非交互环境）
  --dry-run        只打印将做什么，不写任何文件
  --force          即使目标文件已存在也覆盖（默认会尝试智能合并）
  --client <name>  agents | claude | copilot | workbuddy（强制指定客户端）
  --file <path>    直接写到指定文件（忽略客户端自动检测）
  --target <dir>   操作的目标项目目录（默认：当前目录）
  --rules <path>   自定义规矩文件（默认：../docs/RECIPE_BOOK_RULES.md）
  -h, --help       显示本帮助
`);
}

// 读取规矩内容：优先外部文件，否则用内置兜底
function loadRules(opts, scriptDir) {
  const candidates = [];
  if (opts.rules) candidates.push(path.resolve(opts.rules));
  candidates.push(path.resolve(scriptDir, "..", "docs", "RECIPE_BOOK_RULES.md"));
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) {
        const txt = fs.readFileSync(c, "utf8");
        if (txt.includes(SENTINEL_START) && txt.includes(SENTINEL_END)) {
          return extractBlock(txt);
        }
        // 文件没有哨兵标记，整段当作规矩
        return txt.trim() + "\n";
      }
    } catch {
      /* 继续尝试下一个 */
    }
  }
  return FALLBACK_RULES;
}

function extractBlock(txt) {
  const s = txt.indexOf(SENTINEL_START);
  const e = txt.indexOf(SENTINEL_END);
  if (s === -1 || e === -1 || e < s) return txt.trim() + "\n";
  return txt.slice(s, e + SENTINEL_END.length) + "\n";
}

// 检测客户端：返回 { client, file }
function detectClient(targetDir, opts) {
  if (opts.file) {
    return { client: "custom", file: path.resolve(opts.file) };
  }
  if (opts.client && CLIENT_FILES[opts.client]) {
    return { client: opts.client, file: path.resolve(targetDir, CLIENT_FILES[opts.client]) };
  }
  // 自动检测（按优先级）
  //
  // ⚠️ 判定纪律：**只用「确属该客户端」的强信号，不用顺手能看到的弱信号。**
  // 上一版把「存在 .github/」当作 Copilot 信号——但 .github/ 通常只是放 CI 配置和 PR 模板，
  // 与 Copilot 无关。本仓库自己就有 .github/，于是被判成 copilot，规矩被写进
  // .github/copilot-instructions.md，而实际用 WorkBuddy 的人根本读不到（WorkBuddy 读
  // CODEBUDDY.md / AGENTS.md）。弱信号导致的错判，比不判更糟：脚本显示写入成功，人以为生效了。
  // 现在 .github/ 只有在**已存在 copilot-instructions.md**（说明对方确实在用）时才算信号；
  // 其余一律落 AGENTS.md——它被 Codex / Cursor / Copilot / Gemini CLI / Aider / Zed 原生读取，
  // 也是 WorkBuddy 的回落文件，覆盖面最广。想强制 Copilot 用 --client copilot。
  const has = (p) => fs.existsSync(path.join(targetDir, p));
  if (has(".claude") || has("CLAUDE.md")) {
    return { client: "claude", file: path.resolve(targetDir, CLIENT_FILES.claude) };
  }
  // WorkBuddy 的两个形态都认：现产品用 .workbuddy/，官方文档另载 .codebuddy/
  if (has(".workbuddy") || has(".codebuddy") || has("CODEBUDDY.md")) {
    return { client: "workbuddy", file: path.resolve(targetDir, CLIENT_FILES.workbuddy) };
  }
  if (has(CLIENT_FILES.copilot)) {
    return { client: "copilot", file: path.resolve(targetDir, CLIENT_FILES.copilot) };
  }
  return { client: "agents", file: path.resolve(targetDir, CLIENT_FILES.agents) };
}

// 合并：若已有本段则替换；否则追加
function mergeRules(existing, rulesBlock) {
  if (existing.includes(SENTINEL_START) && existing.includes(SENTINEL_END)) {
    const s = existing.indexOf(SENTINEL_START);
    const e = existing.indexOf(SENTINEL_END) + SENTINEL_END.length;
    const before = existing.slice(0, s).replace(/\s*$/, "");
    const after = existing.slice(e).replace(/^\s*/, "");
    return (before ? before + "\n\n" : "") + rulesBlock + (after ? "\n" + after : "");
  }
  const trimmed = existing.replace(/\s*$/, "");
  return (trimmed ? trimmed + "\n\n" : "") + rulesBlock;
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans);
    });
  });
}

// 供测试引用：不写文件，只返回「将要写入什么」
function planWrite(targetDir, opts, scriptDir) {
  const rulesBlock = loadRules(opts, scriptDir);
  const { client, file } = detectClient(targetDir, opts);
  return { client, file, rulesBlock };
}

export {
  SENTINEL_START,
  SENTINEL_END,
  CLIENT_FILES,
  FALLBACK_RULES,
  loadRules,
  detectClient,
  mergeRules,
  planWrite,
};

const isDirectRun = (() => {
  try {
    return (
      Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
    );
  } catch {
    return false;
  }
})();

async function main() {
  const opts = parseArgs(process.argv);
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const targetDir = path.resolve(opts.target || process.cwd());

  if (!fs.existsSync(targetDir)) {
    console.error(`❌ 目标目录不存在：${targetDir}`);
    process.exit(1);
  }

  const { client, file, rulesBlock } = planWrite(targetDir, opts, scriptDir);

  console.log("────────────────────────────────────────────");
  console.log(" agent-recipe-book 接入设置");
  console.log("────────────────────────────────────────────");
  console.log(` 目标项目目录 : ${targetDir}`);
  console.log(` 检测到的客户端: ${client}`);
  console.log(` 将写入文件   : ${file}`);
  console.log("────────────────────────────────────────────");
  console.log(" 即将写入的规矩内容：");
  console.log("────────────────────────────────────────────");
  console.log(rulesBlock);
  console.log("────────────────────────────────────────────");

  if (opts.dryRun) {
    console.log("🔍 [dry-run] 未写入任何文件，退出。");
    return;
  }

  if (!opts.yes && !opts.force) {
    const ans = await ask("确认把以上规矩写入该文件？[y/N] ");
    if (!/^y(es)?$/i.test(ans.trim())) {
      console.log("🚫 已取消，未写入。");
      return;
    }
  }

  // 确保父目录存在（如 .github）
  const parent = path.dirname(file);
  if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });

  const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const merged = mergeRules(existing, rulesBlock);
  fs.writeFileSync(file, merged, "utf8");

  console.log(`✅ 已写入：${file}`);
  console.log(`   客户端=${client} · 若文件原本已有本段则已整体替换（幂等）。`);
  console.log("   下一步：重启你的 Agent 会话，让它重新读取说明书文件即可生效。");
}

if (isDirectRun) {
  main().catch((err) => {
    console.error("❌ 运行失败：", err && err.message ? err.message : err);
    process.exit(1);
  });
}
