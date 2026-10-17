/* ============================================================
   setup 接入脚本回归测试
   （对应 2026-10-18 交付包「规则稳定进 Agent 上下文」方案第七节验收标准）
   ------------------------------------------------------------
   跑法： node tests/setup.test.js   （或 npm test）
   退出码：任何一条 FAIL → 1

   为什么必须有这份测试：setup.js 是**分发给别人跑**的脚本，它没有编译期保护。
   交付包里它是 CommonJS（require），在交付目录（无 package.json）自测全绿，
   落进本仓库（package.json 为 "type": "module"）后一跑就抛
   "require is not defined in ES module scope" —— 开箱即死。
   该坑已收录为配方 recipe-node-cjs-require-under-type-module。

   T1 就是为它设的：一旦有人改回 require，T1 立刻红，而不是等用户跑起来才发现。
   ============================================================ */

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ROOT, check, section, done } from "./_harness.js";
import {
  SENTINEL_START,
  SENTINEL_END,
  FALLBACK_RULES,
  loadRules,
  mergeRules,
} from "../scripts/setup.js";

const SETUP = join(ROOT, "scripts", "setup.js");

/* 不用 fs.cpSync，也不用 mkdtempSync 原值：前者在本机临时目录上会让 Node 静默退出
   （rc=127，见配方 recipe-node-cpsync-silent-exit-127），后者会给出 8.3 短名路径
   （形如 C:\Users\LAOYAN~1\...）。realpathSync.native() 还原成长路径再用，两个坑一起绕开。 */
function freshDir(prefix) {
  return realpathSync.native(mkdtempSync(join(tmpdir(), prefix)));
}

function run(args, cwd = ROOT) {
  const r = spawnSync(process.execPath, [SETUP, ...args], {
    cwd,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  return { rc: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

function countOf(text, needle) {
  return text.split(needle).length - 1;
}

/* ---------------- 一、模块形态（T1：本文件的存在理由） ---------------- */
section("一、模块形态：在真实落库位置能跑（防 require 回归）");
const base = run(["--dry-run"]);
check(
  "T1 node scripts/setup.js --dry-run 退出码为 0",
  base.rc === 0,
  `rc=${base.rc} ${base.out.slice(0, 200)}`
);
check("T1b 输出不含 require is not defined", !/require is not defined/.test(base.out));
check("T1c 打印了接入设置横幅", /agent-recipe-book 接入设置/.test(base.out));
check("T2 --help 退出码为 0", run(["--help"]).rc === 0);

/* ---------------- 二、dry-run 不落盘 ---------------- */
section("二、--dry-run 只看不做");
const d1 = freshDir("rb-setup-dry-");
const dry = run(["--dry-run", "--target", d1]);
check("T3 dry-run 退出码 0", dry.rc === 0, `rc=${dry.rc}`);
check("T4 dry-run 未创建任何说明书文件", !existsSync(join(d1, "AGENTS.md")));
check("T5 dry-run 输出提示未写入", /未写入任何文件/.test(dry.out));
rmSync(d1, { recursive: true, force: true });

/* ---------------- 三、真实写入 + 幂等 + 合并 ---------------- */
section("三、真实写入 / 幂等 / 不破坏原有说明书");
const d2 = freshDir("rb-setup-yes-");
const AGENTS = join(d2, "AGENTS.md");
writeFileSync(AGENTS, "# 我的项目\n\n原有内容不要丢。\n", "utf8");

const w1 = run(["--yes", "--target", d2]);
check("T6 写入退出码 0", w1.rc === 0, `rc=${w1.rc} ${w1.out.slice(0, 200)}`);
const after1 = readFileSync(AGENTS, "utf8");
check("T7 文件含规矩段（哨兵 start）", after1.includes(SENTINEL_START));
check("T8 文件含规矩段（哨兵 end）", after1.includes(SENTINEL_END));
check("T9 原有内容被保留", after1.includes("原有内容不要丢"));
check(
  "T10 规矩段写在原内容之后（追加而非覆盖）",
  after1.indexOf("原有内容不要丢") < after1.indexOf(SENTINEL_START)
);

const w2 = run(["--yes", "--target", d2]);
const after2 = readFileSync(AGENTS, "utf8");
check("T11 二次运行退出码 0", w2.rc === 0, `rc=${w2.rc}`);
check(
  "T12 哨兵 start 仍只有 1 处（幂等）",
  countOf(after2, SENTINEL_START) === 1,
  `实际 ${countOf(after2, SENTINEL_START)} 处`
);
check(
  "T13 哨兵 end 仍只有 1 处（幂等）",
  countOf(after2, SENTINEL_END) === 1,
  `实际 ${countOf(after2, SENTINEL_END)} 处`
);
check("T14 二次运行内容不再增长", after2 === after1, `长度 ${after1.length} → ${after2.length}`);
rmSync(d2, { recursive: true, force: true });

/* ---------------- 四、客户端自动检测 ---------------- */
section("四、客户端自动检测");
const cases = [
  [".claude", "claude", "CLAUDE.md"],
  [".workbuddy", "workbuddy", "CODEBUDDY.md"],
  [".codebuddy", "workbuddy", "CODEBUDDY.md"],
];
for (const [marker, expectClient, expectFile] of cases) {
  const d = freshDir("rb-setup-cli-");
  mkdirSync(join(d, marker));
  const r = run(["--yes", "--target", d]);
  check(
    `T15 检测到 ${expectClient}（标记 ${marker}）`,
    r.out.includes(`检测到的客户端: ${expectClient}`),
    r.out.slice(0, 160)
  );
  check(`T16 写入 ${expectFile}`, existsSync(join(d, expectFile)));
  rmSync(d, { recursive: true, force: true });
}

/* 已存在 copilot-instructions.md 才算「确实在用 Copilot」 */
const dCop = freshDir("rb-setup-cop-");
mkdirSync(join(dCop, ".github"));
writeFileSync(join(dCop, ".github", "copilot-instructions.md"), "# 原有 copilot 说明\n", "utf8");
const rCop = run(["--yes", "--target", dCop]);
check(
  "T17a 已有 copilot-instructions.md 时判为 copilot",
  rCop.out.includes("检测到的客户端: copilot"),
  rCop.out.slice(0, 160)
);
check(
  "T17b 写入 .github/copilot-instructions.md",
  existsSync(join(dCop, ".github", "copilot-instructions.md"))
);
rmSync(dCop, { recursive: true, force: true });

/* ⚠️ 弱信号回归：只有 .github/（CI 目录）不得被误判成 Copilot。
   本仓库自己就有 .github/，旧逻辑会把它判成 copilot，而 WorkBuddy 根本不读那份文件。 */
const dWeak = freshDir("rb-setup-weak-");
mkdirSync(join(dWeak, ".github"));
const rWeak = run(["--yes", "--target", dWeak]);
check(
  "T17c 只有 .github/ 目录时不判为 copilot（弱信号不得劫持）",
  !rWeak.out.includes("检测到的客户端: copilot"),
  rWeak.out.slice(0, 160)
);
check("T17d 弱信号时落到覆盖面最广的 AGENTS.md", existsSync(join(dWeak, "AGENTS.md")));
rmSync(dWeak, { recursive: true, force: true });
const d3 = freshDir("rb-setup-def-");
const rDef = run(["--yes", "--target", d3]);
check(
  "T17 无标记时回落到 agents",
  rDef.out.includes("检测到的客户端: agents"),
  rDef.out.slice(0, 160)
);
check("T18 回落时写 AGENTS.md", existsSync(join(d3, "AGENTS.md")));
rmSync(d3, { recursive: true, force: true });

/* ---------------- 五、--client 强制覆盖并自动建父目录 ---------------- */
section("五、--client 强制指定与父目录自动创建");
const d4 = freshDir("rb-setup-force-");
const r4 = run(["--yes", "--target", d4, "--client", "copilot"]);
check("T19 --client copilot 退出码 0", r4.rc === 0, `rc=${r4.rc}`);
check("T20 自动创建 .github/ 并写入", existsSync(join(d4, ".github", "copilot-instructions.md")));
rmSync(d4, { recursive: true, force: true });

/* ---------------- 六、--file 与错误入参 ---------------- */
section("六、--file 指定文件 / 目标目录不存在");
const d5 = freshDir("rb-setup-file-");
const custom = join(d5, "MY-NOTES.md");
const r5 = run(["--yes", "--file", custom]);
check("T21 --file 退出码 0", r5.rc === 0, `rc=${r5.rc}`);
check("T22 写入了指定的文件", existsSync(custom));
rmSync(d5, { recursive: true, force: true });

const rBad = run(["--yes", "--target", join(ROOT, "__肯定不存在的目录__")]);
check("T23 目标目录不存在时退出码非 0", rBad.rc !== 0, `rc=${rBad.rc}`);
check("T24 给出「目标目录不存在」提示", /目标目录不存在/.test(rBad.out));

/* ---------------- 七、规矩原文与内置兜底不许漂移 ---------------- */
section("七、规矩原文与内置兜底一致性（防止两处各改各的）");
const scriptDir = join(ROOT, "scripts");
const fromFile = loadRules({}, scriptDir);
check(
  "T25 能读到 docs/RECIPE_BOOK_RULES.md",
  existsSync(join(ROOT, "docs", "RECIPE_BOOK_RULES.md"))
);
check(
  "T26 读到的块与内置兜底完全一致",
  fromFile.trim() === FALLBACK_RULES.trim(),
  `文件 ${fromFile.length} 字符 vs 兜底 ${FALLBACK_RULES.length} 字符`
);
for (const rule of [
  "动手前先查",
  "引用要带 id",
  "查不到，就说查不到",
  "解卡之后，投稿",
  "投稿前先脱敏",
]) {
  check(`T27 规矩含「${rule}」`, fromFile.includes(rule));
}
check("T28 规矩含只读态排障说明", /RECIPE_BOOK_WRITE/.test(fromFile));

/* ---------------- 八、合并函数边界 ---------------- */
section("八、合并函数边界");
const once = mergeRules("", FALLBACK_RULES);
check("T29 空文件合并后只有一处哨兵", countOf(once, SENTINEL_START) === 1);
const twice = mergeRules(once, FALLBACK_RULES);
check("T30 对已含规矩的内容再合并，仍只有一处哨兵", countOf(twice, SENTINEL_START) === 1);
const kept = mergeRules("# 标题\n\n保留我\n", FALLBACK_RULES);
check("T31 合并后原内容仍在", kept.includes("保留我"));
check("T32 合并后原内容在规矩段之前", kept.indexOf("保留我") < kept.indexOf(SENTINEL_START));

done();
