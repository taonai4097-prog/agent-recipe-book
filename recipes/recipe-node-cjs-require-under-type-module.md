---
id: recipe-node-cjs-require-under-type-module
title: '脚本在别处能跑，落进 "type": "module" 仓库就报 require is not defined'
tags:
- node
- esm
- 模块系统
- 脚本分发
- 交付验收
model: 'Node 22 / package.json 中 "type": "module"'
problem: '交付一个给下游用户直接跑的 Node 脚本（scripts/setup.js）。在交付目录里自测：dry-run、真实写入、幂等、合并、建目录全部通过。原样复制进目标仓库后，同一条命令一运行就抛
  ReferenceError: require is not defined in ES module scope，脚本开箱即死。'
dead_ends:
- attempt: 在交付目录里反复自测（那个目录没有 package.json）
  failure: 全绿。因为 Node 判定模块类型看的是「离这个 .js 文件最近的 package.json」，与你在哪个目录敲命令无关。交付目录没有 package.json
    → 默认按 CommonJS 处理 → require 合法。测试环境和脚本最终要待的环境不是同一个，等于测了个寂寞。
  duration: 整个交付阶段
  early_signal: 你自测的目录，和脚本最终要落进去的目录，是两个不同的目录（一个没有 package.json，一个有）
- attempt: 当作文件名问题，想直接改成 .cjs
  failure: 确实能跑，但代价是把一个干净的分发文件名变成带妥协后缀的名字，README、文档、命令示例全要跟着改；而且真正的病因是「脚本形态与仓库形态不一致」，不是扩展名。改名只是把不一致藏起来。
  duration: 一轮（想到即放弃）
  early_signal: 你打算用「改扩展名」来绕开一个本质是环境不一致的问题
- attempt: 以为是 ESLint 报错，先去改 lint 配置
  failure: 白跑。lint 只是同一病因的另一个症状（本仓库 ESLint 的 sourceType 也是 module），根因没动，改配置等于给症状贴创可贴。
  duration: 一轮
  early_signal: 你在改「报错工具」而不是改「报错的那个文件」
solution: ① 先记牢判定规则：Node 按「离这个 .js 文件最近的 package.json」的 type 字段决定它是 ESM 还是 CJS，跟你在哪个目录敲命令毫无关系（cd
  到别处跑也一样）。② 正确修法是让脚本形态与仓库一致：仓库是 type:module，脚本就写成 ESM（import 语法）。③ ESM 的连带改动别漏：__dirname
  不存在，改用 path.dirname(fileURLToPath(import.meta.url)) 取脚本自身目录。④ 落库后必须在真实位置再跑一次（node
  scripts/setup.js --dry-run），不要沿用交付目录的测试结论。⑤ 最后加一条回归断言把模块形态钉死，否则下次有人手滑改回 require，要等用户跑起来才发现——脚本类交付物尤其要如此，因为它没有编译期保护。
result: 改成 ESM 后同一条命令在本仓库内跑通；6 项行为验证（写入、原内容保留、幂等二次运行哨兵唯一、行数不增长、自动建 .github/、客户端自动检测）全部通过。
retrospective: 这类坑的阴险之处在于「测试全绿」给了虚假信心——失败不在脚本逻辑，而在脚本所处的环境。凡是要分发给别人跑的独立脚本，验收动作必须包含「在它最终要待的位置真跑一次」，而不是在临时目录跑通就交付。还有一个更一般的教训：当一个问题同时以「运行报错」和「lint
  报错」两种面貌出现时，往往只有一个根因，先找根因再动手，别两边各修一次。
harness: scripts/setup.js + tests/setup.test.js（T1 断言模块形态）
verified: true
status: published
confidence: B
contributor_id: anon-47856d
created_at: '2026-10-18'
---

## 背景与卡点

交付一个给下游用户直接跑的 Node 脚本。在交付目录里自测：dry-run、真实写入、幂等、合并、建目录全部通过。
原样复制进目标仓库后，同一条命令一运行就抛 `ReferenceError: require is not defined in ES module scope`，脚本开箱即死。

## 判定规则（一句话）

**Node 按「离这个 .js 文件最近的 package.json」的 `type` 字段决定它是 ESM 还是 CJS——
跟你在哪个目录敲命令毫无关系。**

所以交付目录里没有 package.json（默认 CJS，`require` 合法）跑得欢，
落进 `"type": "module"` 的仓库里立刻死。

## 死胡同详解 / 解法步骤 / 复盘

详见 frontmatter 结构化字段；此处供人深读。

### 一句话记忆

- **分发脚本必须在「它最终要待的位置」真跑一次验收**，临时目录跑通不算。
- ESM 下没有 `__dirname`：用 `path.dirname(fileURLToPath(import.meta.url))`。
- 别用改 `.cjs` 扩展名来绕——那是把「环境不一致」藏起来，不是修好。
