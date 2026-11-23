---
name: token-panel
version: 0.5.0
description: >-
  Show Qoder CN local token and credit usage: refresh the usage index from
  session transcripts, answer usage questions (today / 7 days / 30 days, by
  project, by model, by session), and generate the single-file HTML token
  dashboard. Use when the user asks about token consumption, credit usage,
  积分消耗, token 面板, 用量统计, 花了多少, or runs /token-panel.
description_zh: >-
  查看 Qoder CN 本地 token 与积分消耗：刷新用量索引、回答用量问题、生成单文件
  HTML 消耗面板。
user-invocable: true
argument-hint: refresh|summary|面板
---

# Token Panel

查询并可视化 Qoder CN 本机的 token 与积分消耗。数据来自本地会话转录
`~/.qoder-cn/projects/**/*.jsonl`，解析全程在本机完成，不联网、不上传。

## 使用

只有两种方式，都很简单：

1. **`/token-panel`**：输入斜杠命令 → 自动增量刷新 → 生成面板 → 浏览器自动弹出最新数据。
2. **自然语言**：直接说「打开 token 面板」（或「近 7 天花了多少 token」等），
   由技能自动完成同样的流程。

面板固定生成在 `~/.qoder-cn/token-meter/token-panel.html`，每次覆盖同一份文件，
浏览器一次性收藏即可。想重新统计时再说一声即可，毫秒级完成。

## 面板功能

- **时间筛选**：顶部可切换 今天 / 昨天 / 本周 / 本月 / 全部，或自定义起止日期。
  今天、昨天按 0:00–23:59 自然日口径；本周、本月按**当前日期所在的日历周（周一起）
  与日历月**口径（不是往前推算 7 天 / 30 天）。所有卡片、趋势图、项目/模型分布与
  会话列表都会随筛选即时联动。
- **主题**：右上角一键切换白天 / 黑夜；首次打开跟随系统主题，手动选择后会被记住。
- **会话列表**：固定高度、内容内部滚动；点击任意行展开该会话在当前筛选范围内的
  逐请求明细。

## 工具位置

本技能自带工具（零依赖 Node）位于技能目录的 `references/` 下。技能 ZIP 导入或
手动安装时，技能目录为 `~/.qoder-cn/skills/token-panel`。下文命令用 `$SKILL_DIR`
表示技能目录，先执行：

```bash
SKILL_DIR="$HOME/.qoder-cn/skills/token-panel"
```

## 数据口径

- **双数据源（自动合并，互补不重叠）**：旧数据（Qoder 0.5.11 及更早）来自会话转录
  `usage` 字段（逐请求）；Qoder 0.5.12（2026-11-13）起转录不再写 usage，改为读取
  应用本地数据库 `%APPDATA%\com.qodercn.app.stable\main.sqlite` 中
  `chat_session_messages.turn_credits`（每轮**实扣积分**，真实值）。
- **请求粒度（两代同口径）**：一次模型请求 = 一段 assistant 片段链（thinking /
  text / tool_use 通过 parentUuid 串联）。旧数据有 `usage` 直接成记录；新数据无
  usage，按同一链结构结合内容逐请求估算 token，并在该轮最后一次请求上挂载数据库
  的整轮实扣积分。面板「请求数」两代可直接对比。
- **token（主角，本地估算）**：任何版本都不记录 token 计数，面板显示的是**本地
  估算值**——输入按该请求之前的上下文累计、输出按回复内容估算（ASCII ÷4、中文
  ÷1.6），估算不含系统提示与工具定义，可能低于真实输入量；汇报时带一句「本地
  估算」即可。
- **积分 credits**：旧数据来自转录 usage、新数据来自数据库每轮实扣值，均为真实值；
  新数据的积分粒度是「轮」（一次提问=一轮），面板中仅作参考、不突出展示。
- **模型名**：内置当前代际映射（如 `qmodel_latest` → Qwen4-Max、`dfmodel` →
  DeepSeek-Flash；`auto`/`<synthetic>` 等占位值不参与归属），本地旧模型目录缓存仅
  作未收录键的兜底，无法识别的键原样显示。
- **索引缓存**：`~/.qoder-cn/token-meter/index.json`，按文件偏移量增量解析历史转录；
  数据库轮次每次刷新全量比对更新（同一轮按 session + turn 去重）。

## 工作流

1. 刷新索引（增量，毫秒级）：

   ```bash
   node "$SKILL_DIR/references/core/cli.mjs" refresh --json
   ```

2. 生成单文件 HTML 面板到固定位置并自动打开浏览器：

   ```bash
   node "$SKILL_DIR/references/core/cli.mjs" html --out "$HOME/.qoder-cn/token-meter/token-panel.html" --open
   ```

   打开后汇报关键数字（今日 / 近 30 天 token、最费会话）。重新统计时重跑同一条
   命令即可覆盖并再次打开。面板自带交互：顶部筛选栏（今天 / 昨天 / 本周 / 本月 /
   全部 / 自定义日期区间，按日历周与日历月口径）会让卡片、趋势、分布与会话列表
   即时联动；右上角可切换白天/黑夜主题；会话列表固定高度、内部滚动。

3. 用户只要数字（命令同上前缀，均支持 `--json`）：`summary --range today|7d|30d`、
   `projects`、`days --range 30d`、`models`、`sessions --sort tokens --limit 10`、
   `detail --session sessionId`。

## 注意事项

- 面板 HTML 是静态快照，"更新于"时间之后的数据不会自动出现，需重跑生成命令；
- 生成的 HTML 含提问摘要（截断展示），提醒用户不要外发；
- 需要系统安装 Node.js 22.5+（内置 `node:sqlite`；Windows 下 `$HOME` 等价
  `%USERPROFILE%`）；
- 需要只读访问 Qoder 应用数据库 `main.sqlite`（应用运行时也可读取）；数据库缺失或
  版本过旧时自动退化为仅转录模式（新数据为 0），不影响历史数据；
- 全程只读本机会话转录与应用数据库，不修改任何 Qoder 文件；索引缓存与生成的 HTML
  只写在 `~/.qoder-cn/token-meter/` 下；卸载 = 删除技能目录 + 删除该目录，无残留；
- 每个 Qoder 大版本可能调整会话文件/数据库结构，解析层已做宽容降级，极端情况下需
  补充 `references/core/parse.mjs` 或 `references/core/usage-db.mjs` 的适配。

## 验证方法

- 刷新：命令输出 JSON 含 `newRequests`、`totalRequests` 字段且退出码为 0；
- 面板：生成后目标文件修改时间应为刚刚，浏览器打开后顶部卡片有数字（非空态）；
- 筛选：点击顶部「今天」等筛选按钮，卡片与会话列表数字应即时变化，且可与
  `summary --range today` 的输出对上；
- 查询：`summary` 的输出金额与面板顶部卡片一致（同一数据源）。

---

**开源仓库**：https://github.com/CuiCuZn/token-meter —— 欢迎查看源码、提 issue；
如果这个小工具对你有帮助，点个 Star 支持一下。
