---
name: token-panel
version: 0.4.0
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

- **请求粒度**：一次模型请求 = 会话文件中一条带 `usage` 的 assistant 记录。文件里
  一次请求会拆成 thinking / text / tool_use 多个链式片段，只有末段带用量，解析器
  会按链合并，输出 token 计整轮。
- **token（主角，本地估算）**：当前 Qoder CN 版本不记录 token 计数（字段恒为 0），
  面板显示的是**本地估算值**——输入按该请求之前的上下文累计、输出按回复内容估算
  （ASCII ÷4、中文 ÷1.6），估算不含系统提示与工具定义，可能低于真实输入量；若将来
  版本恢复记录值，面板会自动改用真实值并按模型校准。汇报时带一句「本地估算」即可。
- **积分 credits**：来自会话记录的真实值，面板中仅作参考、不突出展示。
- **模型名**：运行时读取 Qoder 本地模型目录缓存映射为真名（如 `dfmodel` →
  `DeepSeek-V4-Flash`），Qoder 新增模型会自动跟上。
- **索引缓存**：`~/.qoder-cn/token-meter/index.json`，按文件偏移量增量解析；历史数据
  只全量解析一次，后续刷新只读新增字节（毫秒级）。

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
- 需要系统安装 Node.js 18+（Windows 下 `$HOME` 等价 `%USERPROFILE%`）；
- 全程只读本机会话转录，不修改任何 Qoder 文件；索引缓存与生成的 HTML 只写在
  `~/.qoder-cn/token-meter/` 下；卸载 = 删除技能目录 + 删除该目录，无残留；
- 每个 Qoder 大版本可能调整会话文件结构，解析层已做宽容降级，极端情况下需补充
  `references/core/parse.mjs` 的适配。

## 验证方法

- 刷新：命令输出 JSON 含 `newRequests`、`totalRequests` 字段且退出码为 0；
- 面板：生成后目标文件修改时间应为刚刚，浏览器打开后顶部卡片有数字（非空态）；
- 筛选：点击顶部「今天」等筛选按钮，卡片与会话列表数字应即时变化，且可与
  `summary --range today` 的输出对上；
- 查询：`summary` 的输出金额与面板顶部卡片一致（同一数据源）。

---

**开源仓库**：https://github.com/CuiCuZn/token-meter —— 欢迎查看源码、提 issue；
如果这个小工具对你有帮助，点个 Star 支持一下。
