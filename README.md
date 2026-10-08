# Token 消耗面板（token-meter）

Qoder CN 目前只展示积分消耗，没有 token 维度的统计。本插件在**本地**解析 Qoder CN
的会话转录，生成一个**单文件 HTML 消耗面板**：**token 为主角**、中文界面、完全离线
（无 CDN、无外部资源，双击即开）。同时提供 `/token-panel` 技能（对话查询 + 生成
面板）、MCP 查询工具，以及可选的 IDE 内画布面板。

- 数据源：`~/.qoder-cn/projects/**/*.jsonl`（会话转录，只读）
- 输出：`~/.qoder-cn/token-meter/token-panel.html`（固定位置，每次覆盖更新）
- 全程离线：不发任何网络请求、不上传任何内容

## 目录结构

```text
token-meter/
├── .qoder-plugin/plugin.json    # 插件清单
├── mcp.json                     # MCP Server 注册（stdio）
├── skills/token-panel/SKILL.md  # 技能：/token-panel 与自然语言触发
├── commands/token-panel.md      # 斜杠命令
├── canvases/token-dashboard/    # 可选的 IDE 内画布面板
│   ├── index.canvas.tsx
│   └── scripts/index.mjs        # 数据桥（宿主运行）
├── server/server.mjs            # MCP stdio server（7 个查询工具）
├── core/                        # 数据内核（零依赖 Node）
│   ├── scan.mjs                 # 扫描会话文件
│   ├── parse.mjs                # 增量 JSONL 解析
│   ├── estimate.mjs             # token 估算
│   ├── models.mjs               # 模型显示名解析（dfmodel → DeepSeek-V4-Flash）
│   ├── aggregate.mjs            # 多维聚合与面板数据
│   ├── render-html.mjs          # 单文件 HTML 面板生成器
│   ├── store.mjs                # 索引缓存（原子写 + 锁）
│   ├── service.mjs              # 增量刷新编排
│   ├── paths.mjs                # 路径解析
│   └── cli.mjs                  # 命令行入口
└── assets/avatar.svg
```

## 安装

前置要求：Node.js 18+。

**方式一：从 Git 仓库安装（推荐）**

```bash
git clone <仓库地址>
qodercli plugin install --scope local <克隆目录>/token-meter
qodercli plugin list --json     # 确认已安装、状态 enabled
```

**方式二：从 zip 包安装**

解压 `token-meter-<版本>.zip` 后，执行同样的 `qodercli plugin install` 命令。

安装完成后，技能、命令和 MCP 工具会被自动发现（若未生效，重启一次 IDE）。

## 使用

只有两种方式，都很简单：

1. **`/token-panel`**：输入斜杠命令 → 自动增量刷新 → 生成面板 → 浏览器自动弹出最新数据。
2. **自然语言**：直接说「**打开 token 面板**」（或「近 7 天花了多少 token」等），
   由技能自动完成同样的流程。

面板固定生成在 `~/.qoder-cn/token-meter/token-panel.html`，每次覆盖同一份文件，
浏览器一次性收藏即可。想重新统计时再说一声即可，毫秒级完成。

## 数据与统计口径

- **请求粒度**：一次模型请求 = 会话文件中一条带 `usage` 的 assistant 记录。文件里
  一次请求会拆成 thinking / text / tool_use 多个链式片段，只有末段带用量，解析器
  会按链合并，输出 token 计整轮。
- **token（主角）**：当前 Qoder CN 版本不记录 token 计数（字段恒为 0），面板显示的是
  **本地估算值**：输入按该请求之前的上下文累计、输出按回复内容估算（ASCII ÷4、
  中文 ÷1.6）；若将来版本恢复记录值，面板会自动改用真实值并按模型校准。
- **积分 credits**：来自会话记录的**真实值**，面板中仅作参考不突出展示。
- **模型名**：运行时读取 Qoder 本地模型目录缓存映射为真名（如 `dfmodel` →
  `DeepSeek-V4-Flash`），Qoder 新增模型会自动跟上。
- **索引缓存**：`~/.qoder-cn/token-meter/index.json`，按文件偏移量增量解析；历史数据
  只全量解析一次，后续刷新只读新增字节（毫秒级）。

## 隐私与限制

**隐私**

- 只读：仅读取本机会话转录，不修改任何 Qoder 文件；
- 只写自有目录：索引缓存与生成的 HTML 都在 `~/.qoder-cn/token-meter/` 下；
- 不联网：解析、估算、生成全部在本机完成；
- 生成的 HTML 包含提问摘要（截断展示），**转发给别人前请注意脱敏**；
- 卸载：删除插件目录 + 删除 `~/.qoder-cn/token-meter/` 即完全清理。

**限制**

- token 为本地估算，**不是计费口径**；估算不含系统提示与工具定义，可能低于真实输入量；
- 数据更新仅在“生成面板那一刻”，HTML 是静态快照，看最新数据需重新生成一次；
- 每个 Qoder 大版本可能调整会话文件结构，解析层已做宽容降级，极端情况下需在
  `core/parse.mjs` 补充适配；
- 使用命令行/MCP 需要系统安装 Node.js（IDE 内置运行时仅覆盖插件内 MCP）。
