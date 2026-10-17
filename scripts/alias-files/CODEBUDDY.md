# WorkBuddy 项目说明（CODEBUDDY.md）

> ✅ 文件名已核实：WorkBuddy 官方「规则」页明确支持项目根目录的 `CODEBUDDY.md`，
> 默认把全文放进上下文；另有 `.codebuddy/CODEBUDDY.md` 与 `.codebuddy/rules/*.md`。
> 官方同时声明**兼容 AGENTS.md**：当根目录有 `AGENTS.md` 而没有 `CODEBUDDY.md` 时，
> 会自动加载 `AGENTS.md` 全文。
>
> ⚠️ 因此二选一即可，**不要两个都建**：一旦建了 `CODEBUDDY.md`，WorkBuddy 就不再回落到
> `AGENTS.md`，两份内容容易各改各的。用 WorkBuddy 且没有其他客户端时，只保留 `AGENTS.md`
> 更省事（它还被 Codex / Cursor / Copilot / Gemini CLI / Aider / Zed 原生读取）。
> 依据：<https://www.workbuddy.cn/docs/ide/User-guide/Rules> 、<https://www.workbuddy.cn/docs/cli/memory>
>
> 本文件由 `agent-recipe-book` 的接入方案提供，告知 Agent 如何可靠地使用配方库 MCP。

<!-- agent-recipe-book:rules:start -->
<!-- 本段由 scripts/setup.js 注入，请勿手改标记行；重新运行 setup 会整体替换此段 -->

## agent-recipe-book 使用规矩（自动注入）

> 本段由 `agent-recipe-book` 的 setup 脚本写入。它告诉你的 Agent：当 `agent-recipe-book`
> 这个 MCP 已连接时，该怎么可靠地用它。原因见下——MCP 的 `instructions` 字段要客户端
> 愿意注入模型上下文才生效，这一步不归仓库控制；把规矩写进客户端说明书文件，只要客户端
> 读这个文件，规矩就一定到得了模型眼前。

### 1. 动手前先查

遇到下面这些卡点，**先用 `search_recipes` 检索一遍**，再动手：

网页采集 · 编码乱码 · 反爬 · 限流 · 分页 · 会话/cookie 丢失 · 无头浏览器 ·
网站工程 · 工具链 · 评测方法论 · 项目判断 · 前端布局与验证

别人踩过的坑，比你自己从头试更省时间。检索前也可先看 `experience-guide` 这个 prompt。

### 2. 引用要带 id

每条结论后面标上 `[配方id]`，例如 `[recipe-py-encoding-mojibake]`。
带 id 人才能核对，也才能判断这条经验对不对得上自己的场景。

### 3. 查不到，就说查不到

**不要用你自己的知识补答案。** 库的价值在于「真的有人踩过」，
你补的每一句都会被人当成真实经验——那就把库毁了。没命中就明说「查不到」，绝不编造。

### 4. 解卡之后，投稿

检索**没命中**、而你随后把问题解决了：用 `submit_recipe` 把这条坑记进库。

- 投稿先进隔离池，**人复核后才公开**（不会一写就污染公开索引）
- 必填字段：`id` `title` `tags` `model` `problem` `dead_ends` `solution` `status`
- `dead_ends` 每条要有四段：试过什么 / 结果如何 / 卡了多久 / 本可提前避开的信号

你这次踩的坑，就是下一个人省下的时间。

### 5. 投稿前先脱敏

去掉：绝对路径 · token / 密钥 · 内网域名与 IP · 项目真名 · 同事姓名。
（本仓库有脱敏自检闸门，写了会被拦下。）

### 如果你看不到投稿工具

`tools/list` 里没有 `submit_recipe`，说明**当前这个连接是只读的**。
开启方式：环境变量 `RECIPE_BOOK_WRITE=1`，改完**必须重启会话**才生效——
MCP 在客户端启动时加载，运行时改配置不会重新读。

### 一句话记住

**动手前先查，查不到说查不到，解卡了记得投稿。**

<!-- agent-recipe-book:rules:end -->
