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
├── .qoder-plugin/plugin.json    # 插件清单（插件导入通道用）
├── mcp.json                     # MCP Server 注册（stdio）
├── commands/token-panel.md      # 斜杠命令
├── skills/token-panel/          # ★ 技能目录（技能导入通道用：ZIP 根目录含 SKILL.md）
│   ├── SKILL.md
│   └── references/              # 技能自带工具（零依赖 Node）
│       ├── core/                # 扫描/解析/估算/聚合/HTML 生成/CLI
│       ├── server/server.mjs    # MCP stdio server（7 个查询工具）
│       └── canvases/…           # 可选的 IDE 内画布面板
├── assets/avatar.svg
├── LICENSE                      # MIT
└── README.md
```

## 安装

前置要求：Node.js 18+（技能执行命令行时需要；MCP 使用 IDE 内置运行时）。

Qoder CN 有**两条 ZIP 导入通道，结构要求不同、不能混用**，本仓库提供两个对应包：

**方式一：技能导入（最简单，只装技能+工具）**

从 [Releases](https://github.com/CuiCuZn/token-meter/releases) 下载
`token-panel-skill-<版本>.zip`（ZIP 根目录含 `SKILL.md`），在 IDE 的技能导入入口
上传该 ZIP 即可。

**方式二：插件导入（完整组件：技能 + 命令 + MCP）**

从 [Releases](https://github.com/CuiCuZn/token-meter/releases) 下载
`token-meter-<版本>.zip`（ZIP 根目录含 `.qoder-plugin/plugin.json`），在
「扩展 → 插件 → 添加插件 → 上传插件」导入。

**方式三（可选，命令行用户）**

需另行安装 Qoder CLI（独立命令行产品，非必需）：

```bash
npm install -g @qodercn-ai/qoderclicn        # Qoder CN 用户（命令名 qoderclicn）
qoderclicn plugin marketplace add 'https://github.com/CuiCuZn/token-meter.git'
qoderclicn plugin install token-meter@token-meter
qoderclicn plugin list --json                # 确认已安装、状态 enabled
```

说明：

- ⚠️ 两个 ZIP **不能混用**：技能导入要求根目录含 `SKILL.md`，插件导入要求根目录含
  `.qoder-plugin/plugin.json`，用错通道会提示结构不符；
- 不要用 GitHub 仓库页的 "Download ZIP" 按钮（那是源码快照，多一层文件夹壳，两个
  通道都不识别），请从 Releases 下载打包好的 ZIP；
- 安装完成后，技能、命令和 MCP 工具会被自动发现（若未生效，重启一次 IDE）；
- 维护者重新打包：`python dev/make-zips.py`（同时生成上述两个 ZIP）。

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
- 卸载：删除插件/技能目录 + 删除 `~/.qoder-cn/token-meter/` 即完全清理。

**限制**

- token 为本地估算，**不是计费口径**；估算不含系统提示与工具定义，可能低于真实输入量；
- 数据更新仅在“生成面板那一刻”，HTML 是静态快照，看最新数据需重新生成一次；
- 每个 Qoder 大版本可能调整会话文件结构，解析层已做宽容降级，极端情况下需在
  `skills/token-panel/references/core/parse.mjs` 补充适配；
- 使用命令行/MCP 需要系统安装 Node.js（IDE 内置运行时仅覆盖插件内 MCP）。

**免责声明**

- 本项目为开源工具，按「现状」（as-is）提供，不附带任何明示或暗示的担保；
- 所有统计（尤其是 token 估算值）仅供参考，可能与真实用量存在偏差，
  **不构成计费、结算或对账依据**；
- Qoder 客户端升级可能导致会话文件结构变化，进而造成解析失效或数据不准，
  作者不承担由此产生的任何直接或间接损失；
- 请在遵守你所在组织 IT 与数据合规规定的前提下使用本工具。

本项目基于 [MIT License](./LICENSE) 开源。
