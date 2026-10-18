# agent-recipe-book

> **状态：已归档（2026-10-18）** — 不再活跃维护，内容保持可用，欢迎 fork。详见 [ARCHIVED.md](ARCHIVED.md)。

> **让不能联网的 AI，也能积累经验。**
> 别人踩过的坑，你的 AI 不用再踩一遍 —— 而且效果不是嘴上说的：42 题对照实验测出净提升，也测出了哪类配方有害。

## 这是什么

你用 AI 写代码，它绕了三个弯才解出来。那三个弯，别人也绕过。
但这些经验全散在各自的聊天记录里，谁也用不上 —— **下次换个对话窗口，它又从头绕一遍。**

这个库把「踩坑过程」存成文件。**存在文件里，就不会像聊天记录一样被清空。**
然后把库挂进你的 AI 工具箱，它遇到同类问题会自己去查。

它和一般知识库有个根本区别：

| | 一般知识库 | 本库 |
|---|---|---|
| 装什么 | **答案**（"这样做就行"） | **试错过程**（试了 X 失败因为 Y、试了 Z 也失败、最后 A 成了） |
| 你拿到后 | 照抄 | **自己判断"A 适不适合我"** |

我们最看重的字段叫 `dead_ends`（死胡同）—— 它装的是**已经排除的选项**，不是答案。
**知道"哪条路走不通"，往往比知道"正确答案"更省时间。**

## 怎么用

把它挂进你的 AI 工具箱 —— 这一步叫 **MCP**，是一种给 AI 接外部工具的标准接口：不用起服务、不用联网、不用装依赖。

```bash
node mcp/server.js
```

挂上之后它会出现在你的 AI 工具列表里，AI 遇到相关任务会自己去查。挂载说明见 [mcp/README.md](mcp/README.md)。

> ❓ **为什么非得"挂"这一步？** 因为 AI 是被动的 —— **它只用你给它的工具，不会自己跑去找一个陌生网站。**
> 工具箱里没它，对 AI 来说这个库就不存在。（这不是猜测：我们派一个新 AI 往库里写配方，它照样踩了一个库里早就记录过的坑 —— 因为它没查库。）

如果你的 AI 会联网，也可以直接抓全量数据：

```bash
curl https://taonai4097-prog.github.io/agent-recipe-book/api/experiences.json
```

## 接入：让 Agent 稳定用上本库（重要）

本库通过 MCP 提供。但 MCP 的 `initialize.instructions` 字段**只有在客户端愿意把它注入
模型上下文时才生效**——这一步不归本仓库控制。为了保证"下载本项目的人"能稳定地让 Agent
遵守使用规矩，请用下面的 setup 脚本，把规矩写进**你自己的项目**的客户端说明书文件。
只要客户端读这个文件，规矩就一定到得了模型眼前。

### 第一步：连上 MCP

在你的客户端 MCP 配置里加入（路径换成你实际放本库的位置）：

```json
{
  "mcpServers": {
    "agent-recipe-book": {
      "command": "node",
      "args": ["/绝对路径/agent-recipe-book/mcp/server.js"],
      "env": { "RECIPE_BOOK_WRITE": "1" }
    }
  }
}
```

> 只读使用可不加 `RECIPE_BOOK_WRITE`；要投稿（写经验）必须加 `1`，且**改完重启会话**才生效。

### 第二步：把使用规矩写进你的项目

在你**自己的项目根目录**运行（不是在 recipe-book 仓库里）：

```bash
# 自动检测你的客户端并写入对应说明书文件，会先让你确认
node /绝对路径/agent-recipe-book/scripts/setup.js

# 非交互 / CI 环境跳过确认
node /绝对路径/agent-recipe-book/scripts/setup.js --yes

# 只想看会做什么、不写文件
node /绝对路径/agent-recipe-book/scripts/setup.js --dry-run
```

脚本会做的事：

1. 检测你用的客户端（`.claude/` 或 `CLAUDE.md` → Claude Code；`.workbuddy/`、`.codebuddy/`
   或 `CODEBUDDY.md` → WorkBuddy；**已存在** `.github/copilot-instructions.md` → GitHub Copilot；
   都不是 → 落到覆盖面最广的 `AGENTS.md`）。
2. 把"使用规矩"那一段（带 `agent-recipe-book:rules` 哨兵标记）展示给你看。
3. **等你确认后**写进对应文件；重复运行只会整体替换、不会重复叠加（幂等）。

> 客户端判错了？用 `--client agents|claude|copilot|workbuddy` 强制指定，或用 `--file <路径>`
> 直接指定写入文件。注意：脚本**不会**因为你的项目里有 `.github/` 就判定你在用 Copilot
> ——那个目录通常只是放 CI 配置，据此误判会把规矩写进没人读的文件里。

> 不想跑脚本也行：直接把 [`scripts/alias-files/`](scripts/alias-files/) 下对应客户端的文件
> 内容，复制粘贴进你项目的说明书文件即可。

### 第三步：重启会话

写完说明书文件后，**重启你的 Agent 会话**，让它重新读取说明书文件，规矩即生效。

### 各客户端读哪个文件（已核实，非猜测）

| 客户端 | 读取的文件 | 依据 |
|---|---|---|
| WorkBuddy / CodeBuddy | `CODEBUDDY.md`（根目录，全文进上下文）；**没有它时才回落读 `AGENTS.md`** | 官方「规则」页、CLI 记忆页 |
| Claude Code | `CLAUDE.md`（不读 `AGENTS.md`，官方建议在 `CLAUDE.md` 里 `@AGENTS.md` 导入） | 官方行为 |
| GitHub Copilot | `.github/copilot-instructions.md` | 官方行为 |
| Codex / Cursor / Gemini CLI / Aider / Zed 等 | `AGENTS.md` | 跨工具约定 |

> ⚠️ **WorkBuddy 用户二选一就好，别两个都建**：一旦建了 `CODEBUDDY.md`，WorkBuddy 就不再
> 回落到 `AGENTS.md`，两份内容迟早各改各的。只用一个客户端时，保留 `AGENTS.md` 最省事。

## 凭什么说它有用

我们没停在"我觉得有用"，而是做了一次对照实验：

> 让同一个 AI 做同一批题，**一次不给配方，一次给**。
> 结果：给配方的那组平均多答对 **8 个百分点**（相当于 100 道题多对 8 道）。
> **这是巧合的概率只有约 1%**（这个数叫 p 值，一般小于 5% 就算站得住）。
> 而且去掉 42 道题里任何一道，结论都不变。

也测出了**反例**，我们照样写在明面上：

| 发现 | 说明 |
|---|---|
| 给错配方会倒退 **50 个百分点** | AI 照抄了不相关的经验，反而放弃了自己探索。那条配方已修订 |
| **强模型上测不出提升**（p=0.531） | 那些坑它早就学会了，所以不需要 |
| 常见坑上**零提升** | 编码、cookie 这类，AI 本来就会，给了也白给 |

所以这个库**不是给所有人用的** —— 它是给**在本地跑小模型**的人用的。
完整实验设计、统计口径，以及"我们主动撤回过一次自己的结论"的记录，见 **[EVIDENCE.md](EVIDENCE.md)**。

## 库里现在有什么

| 类别 | 条数 | 说明 |
|---|---|---|
| 网页信息采集 | 14 | 反爬、编码、限流、翻页等，真实 `requests` 执行记录 |
| 网站工程 | 19 | 构建本库配套网站时真实踩的坑，每条有客观测量数据 |
| 工具链 / 基础设施 | 30 | git 推送权限、YAML 陷阱、Python 环境、字体阻塞首屏等 |
| 项目判断 / 规则 | 3 | 卡在判断而不是卡在代码的坑 |
| **合计** | **66** | 分类由配方 id 前缀判定，口径见 `lib/search.js` 的 `GROUPS` |

**后三类是一份自证**：本库用配方记录开发本库时踩的坑 —— 这套框架能装任意领域的坑。
全部来自真实执行记录、可复现、已脱敏（无真实域名泄漏）。欢迎社区 Agent 经写入 API 补充。

> 框架也已经装过另外两个完全不同的领域，见 [`books/`](books/README.md)：
> **LifeLens**（Electron 桌面应用 + 本地 Ollama，7 条）、**小红书运营闭环**（Python 社媒爬虫，6 条）。

## 核心约定

- **配方**：一条解题经验 = 问题 + 环境（模型 / skills / harness / soul / 硬件）+ 死胡同（尝试 / 失败现象 / 卡多久 / 本可提前避开的信号）+ 最终解法 + 复盘。
- **人只读，Agent 写**：配方由**贡献者的 Agent** 写入（Agent 最懂上下文里什么敏感），人**不能手填投稿**。人的唯一动作是看一眼隔离池、点放行或合并。
  - 主通道：写侧 MCP `submit_recipe`（Agent 直投，详见 `api/README.md`）
  - 兜底通道：GitHub Issue 表单——**由贡献者的 Agent 代填**，人仍不直接掌握写入格式
- **全站 Agent 可读**：仓库根提供 `llms.txt` 索引 + 每条配方一个 Markdown 文件，任何 Agent 一次抓取即得全库。
- **配方全开，PII 全脱敏**：模型、skill、harness、soul（脱敏后）、电脑配置全部公开；真名 / 学号 / 密钥 / 内网路径一律清洗。
- **开源双协议**：代码 AGPL-3.0 / 配方数据 CC BY-SA 4.0（见 License 节）。

## 目录结构

```
agent-recipe-book/
├── README.md          # 本文件（门面）
├── LICENSE            # AGPL-3.0（代码）/ 配方数据 CC BY-SA 4.0
├── package.json       # Node 侧元信息（type=module；运行时零第三方依赖，devDependencies 仅 ESLint/Prettier）
├── llms.txt           # Agent 索引入口（由 recipes/ 派生）
├── recipe.schema.md   # 配方字段规范（核心契约）
├── PRD.md             # 产品需求文档
├── CONTRIBUTING.md    # Agent 如何投稿 + 两段式脱敏
├── index.html         # 人类浏览的网页（只读：列表 / 搜索 / 详情抽屉）
├── recipes/           # 每条配方一个 .md（内容真源，frontmatter 权威）
├── assets/            # 网页样式与脚本（app.js 以 ES Module 加载）
├── lib/               # ★ 共享检索内核 search.js —— 网站 / MCP / Agent 一份实现
├── mcp/               # ★ 只读 MCP Server（server.js + 挂载说明 README.md）
├── scripts/           # 接入脚本 setup.js（把使用规矩写进下游项目的客户端说明书）
│   └── alias-files/   # 不想跑脚本时，手动复制的客户端说明书模板（4 份）
├── tests/             # 回归测试（search-baseline.js / mcp-smoke.js …）
├── api/
│   ├── ingest.py      # JSON→.md 渲染 + rebuild 索引（核心脚本）
│   └── experiences.json   # 全量结构化数据（由 recipes/ 派生，网页与 Agent 消费）
├── docs/
│   ├── research/      # 选题与方向调研过程稿（含 INDEX.md）
│   └── REPO-GOVERNANCE.md  # 仓库治理标准与摆放说明
└── .github/           # CI 门禁 + PR 模板
```

> 仓库如何组织、分支、提交、发布，见 [docs/REPO-GOVERNANCE.md](docs/REPO-GOVERNANCE.md)。

## 本地运行与测试

```bash
# 起本地预览（ES Module 与 fetch 都需要 http 协议，直接双击 html 不行）
cd agent-recipe-book
python -m http.server 8099      # 然后打开 http://127.0.0.1:8099/

# 跑全部回归测试（运行时零第三方依赖，无需 npm install 即可跑；退出码非 0 = 回退）
# 口径以命令自己的输出为准（「总计（N 个文件）：X 通过 / Y 失败」）。
# 刻意不写死断言数——它会随功能增长变成下一份过时数字（见仓库自己的 BL-020 教训）。
npm test

# 单跑某一个
node tests/search-baseline.js   # 检索质量基线：正例 / 反例 / 元配方不抢 Top1 / 英文短词不穿透词边界
node tests/mcp-smoke.js         # 真 spawn 子进程走 stdio JSON-RPC：握手 / 工具 / 参数校验 / 只读边界

# 起 MCP Server（stdio）
node mcp/server.js              # 挂载说明见 mcp/README.md
```

> **`lib/search.js` 是网站、MCP Server、演示 Agent 共用的检索内核**——三处同一份实现，避免各写一份后互相漂移。
> 它锁住了一条质量基线：**正例 6/6、反例 3/3、单字符与纯虚词 0 命中、元配方不抢 Top1、英文短词不穿透单词边界（"ip" 不得命中 "gzip"）**。
> 改动这个文件后必须先跑回归测试；CI（ubuntu）跑全量 9 套测试，**断言数以 `npm test` 末行的「总计」为准**（不写死在这里——它会随功能增长，写死就是下一份过时文档）。退出码非 0 = 回退。设计演进与架构决策见 [PRD.md](PRD.md)。

## Roadmap（版本预告）

> 登记 ≠ 承诺：以下是当前排队中的可优化方向，按版本分批，接受社区讨论与 PR。

**v0.2 · 测试与内容质量**

- ✅ 写侧测试迁移至临时沙盒目录（测试崩溃不再触碰真实库）
- ✅ 测试输出格式统一，断言口径一次取数
- ✅ 降档（B/C）操作增加二次确认
- ✅ 引用校验接运行时闸门（只读工具 `verify_citations`）
- ✅ lint / format 约定落地（ESLint + ruff + Prettier，已挂 CI）
- 脱敏规则扩充：覆盖更多凭据形态与混淆写法
- **伪坑率度量机制**：为抽样配方建立"是否真坑"金标准标签，目标伪坑率 < 5%——这是本库内容可信度的北极星指标

**v1.0 · 社区治理**

- 贡献者身份层：区分人类 / Agent 来源，匿名标识可累积信誉分
- 举报闭环与批量治理工具（批量复核 / 驳回 / 降级）
- 写侧限频与配额，防滥用
- "这条帮到我了"反馈回路：让被避坑的人留下痕迹
- `llms.txt` 分组与权重，让 Agent 抓取更有序

**远期方向**

- 向量检索 / Embedding（当前关键词匹配在 1000 条内实测够用，规模期再换）
- 相似配方聚类与去重
- 运行监控与告警
- 垂直领域扩展：按"环境可结构化 + 脱敏可控"标准选取新领域

## 贡献

配方由 Agent 经 API 写入，详见 [CONTRIBUTING.md](CONTRIBUTING.md)。
人类贡献者请先确认你的 Agent 已完成脱敏自检。

## License（双轨）

- **代码**（网站 / MCP / 检索内核 / 脚本）：[AGPL-3.0](LICENSE) © 2026 Laoyang4097
  自托管、自用、修改均可；若将修改版**作为网络服务对外提供**，须依 AGPL 开放你的完整修改源码。
- **配方数据**（`recipes/*.md` 及 `api/experiences.json` 的内容）：[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.zh)
  可转载、可改编，须署名并以相同方式共享。
- **投稿即授权（双轨）**：向本库提交配方，即表示同意内容以 CC BY-SA 4.0 随库发布，**并授予库维护者不受"相同方式共享"约束的商用使用权**（详见 [CONTRIBUTING.md](CONTRIBUTING.md)）。
- **名称与品牌**：「agent-recipe-book / 解题配方库」名称及标识归维护者所有。Fork 与二次分发**请更换项目名称与标识**，不得暗示与本项目官方服务有关联。代码与数据按上述协议自由使用，与名称无关。
