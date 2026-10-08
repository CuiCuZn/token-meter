---
description: 生成 token 消耗 HTML 面板（刷新本地用量索引后输出单文件页面）
---

按 token-panel 技能执行：

1. 生成面板到固定位置并自动打开浏览器（内部会先做增量刷新）：

   ```bash
   node "<PLUGIN_ROOT>/core/cli.mjs" html --out "$HOME/.qoder-cn/token-meter/token-panel.html" --open
   ```

2. 汇报关键数字：今日 / 近 30 天 token（本地估算）与最费会话。
3. 用一句话汇报关键数字：今日 / 近 30 天 token（本地估算）与最费会话。
