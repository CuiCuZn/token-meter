---
name: token-panel
version: 0.2.1
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

## 工具位置

本技能自带工具位于技能目录的 `references/` 下（core、server、canvases）。
技能目录因安装方式而异：

| 安装方式 | 技能目录 |
| --- | --- |
| 技能 ZIP 导入 / 手动复制 | `~/.qoder-cn/skills/token-panel` |
| 插件安装 | 插件根目录下的 `skills/token-panel` |

下文命令用 `$SKILL_DIR` 表示技能目录。技能 ZIP 导入安装时先执行：

```bash
SKILL_DIR="$HOME/.qoder-cn/skills/token-panel"
```

## 数据口径

- **token**：面板主角；当前版本不记录 token 计数，为**本地估算值**（输入按请求前
  上下文累计、输出按回复内容，ASCII ÷4、中文 ÷1.6）。汇报时带一句"本地估算"即可。
- **积分 credits**：会话记录的真实值，参考信息。
- 数据粒度：每个模型请求；模型名显示为真名（如 DeepSeek-V4-Flash）。

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
   命令即可覆盖并再次打开。

3. 用户只要数字（命令同上前缀，均支持 `--json`）：`summary --range today|7d|30d`、
   `projects`、`days --range 30d`、`models`、`sessions --sort tokens --limit 10`、
   `detail --session sessionId`。

## 注意事项

- 面板 HTML 是静态快照，"更新于"时间之后的数据不会自动出现，需重跑生成命令；
- 生成的 HTML 含提问摘要（截断展示），提醒用户不要外发；
- 需要系统安装 Node.js 18+（Windows 下 `$HOME` 等价 `%USERPROFILE%`）；
- 全程只读本机会话转录，不联网、不上传。

## 验证方法

- 刷新：命令输出 JSON 含 `newRequests`、`totalRequests` 字段且退出码为 0；
- 面板：生成后目标文件修改时间应为刚刚，浏览器打开后顶部卡片有数字（非空态）；
- 查询：`summary` 的输出金额与面板顶部卡片一致（同一数据源）。
