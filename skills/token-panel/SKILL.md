---
name: token-panel
version: 0.2.0
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
argument-hint: "[refresh|summary|面板]"
---

# Token Panel

查询并可视化 Qoder CN 本机的 token 与积分消耗。全部数据来自本地会话转录
`~/.qoder-cn/projects/**/*.jsonl`，解析全程在本地完成，不联网、不上传。

插件根目录 = 本技能目录的上一级再上一级（即 `skills/token-panel/../..`），
以下命令中的 `<PLUGIN_ROOT>` 请替换为该实际路径。

## 数据口径（回答时必须遵守）

- **token**：面板的主角。当前 Qoder CN 版本不记录 token 计数（字段恒为 0），
  为**本地估算值**（输入按请求前上下文累计、输出按回复内容，ASCII ÷4、中文 ÷1.6）。
  汇报时简单带一句"本地估算"即可。
- **积分 credits**：会话记录的真实值，作为参考信息。
- 数据粒度：每个模型请求。

## 工作流

1. **刷新索引（增量，毫秒级）**：

   ```bash
   node "<PLUGIN_ROOT>/core/cli.mjs" refresh --json
   ```

2. **用户要看「面板」时（首选路径）**：生成单文件 HTML 到固定位置并**自动打开浏览器**
   （`--open` 必须带上，不要省略）：

   ```bash
   node "<PLUGIN_ROOT>/core/cli.mjs" html --out "$HOME/.qoder-cn/token-meter/token-panel.html" --open
   ```

   （Windows 等价路径：`%USERPROFILE%\.qoder-cn\token-meter\token-panel.html`）
   每次覆盖同一份文件并弹出最新面板；然后汇报关键数字（今日 / 近 30 天 token、
   最费会话）。

3. **用户只要数字时**（都支持 `--json`）：

   | 问题 | 命令 |
   | --- | --- |
   | 今天/近 7 天/近 30 天 | `summary --range today\|7d\|30d` |
   | 哪个项目最费 | `projects --range all` |
   | 按天趋势 | `days --range 30d` |
   | 最费的会话 | `sessions --sort tokens --limit 10` |
   | 某会话逐请求明细 | `detail --session <sessionId>` |

4. **可选（高级）**：IDE 内画布面板（`canvases/token-dashboard/index.canvas.tsx`）
   与 MCP 工具（`usage_summary` 等）。用户未提就不主动推荐。

## 边界

- 只读：除 `~/.qoder-cn/token-meter/index.json` 索引缓存与生成的 HTML 外不写任何文件。
- HTML 面板完全离线（无 CDN、无外部资源），可直接双击打开。
