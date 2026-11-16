# Token 消耗面板（token-panel）

Qoder CN 目前只展示积分消耗，没有 token 维度的统计。本技能在**本地**解析 Qoder CN
的会话转录，生成一个**单文件 HTML 消耗面板**：**token 为主角**、中文界面、完全离线
（无 CDN、无外部资源，双击即开），并支持对话式查询用量。

- 数据源：`~/.qoder-cn/projects/**/*.jsonl`（会话转录，只读）
- 输出：`~/.qoder-cn/token-meter/token-panel.html`（固定位置，每次覆盖更新）
- 全程离线：不发任何网络请求、不上传任何内容

## 目录结构

```text
token-panel/
├── SKILL.md              # 技能定义（发布/导入的主文件）
├── references/           # 技能自带工具（零依赖 Node）
│   └── core/
│       ├── scan.mjs          # 扫描会话文件
│       ├── parse.mjs         # 增量 JSONL 解析
│       ├── usage-db.mjs      # 应用数据库读取（每轮实扣积分，Qoder 0.5.12+）
│       ├── estimate.mjs      # token 估算
│       ├── models.mjs        # 模型显示名解析（dfmodel → DeepSeek-V4-Flash）
│       ├── aggregate.mjs     # 多维聚合与面板数据
│       ├── render-html.mjs   # 单文件 HTML 面板生成器
│       ├── store.mjs         # 索引缓存（原子写 + 锁）
│       ├── service.mjs       # 增量刷新编排
│       ├── paths.mjs         # 路径解析
│       └── cli.mjs           # 命令行入口
├── dev/make-zip.py       # 打包脚本（维护者用）
├── LICENSE               # MIT
└── README.md
```

## 安装

前置要求：Node.js 18+。

**方式一：技能 ZIP 导入（推荐）**

从 [Releases](https://github.com/CuiCuZn/token-meter/releases) 下载
`token-panel-<版本>.zip`（ZIP 根目录含 `SKILL.md`），在 IDE 的技能导入入口上传该
ZIP 即可。

**方式二：手动复制**

```bash
git clone https://github.com/CuiCuZn/token-meter.git token-panel
# 将整个文件夹复制为技能目录：
#   ~/.qoder-cn/skills/token-panel
```

安装完成后，技能会被自动发现（若未生效，重启一次 IDE）。

## 使用

只有两种方式，都很简单：

1. **`/token-panel`**：输入斜杠命令 → 自动增量刷新 → 生成面板 → 浏览器自动弹出最新数据。
2. **自然语言**：直接说「**打开 token 面板**」（或「近 7 天花了多少 token」等），
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

## 数据与统计口径

- **双数据源（自动合并）**：Qoder 0.5.11 及更早的用量记录在会话转录 `usage` 字段里；
  Qoder 0.5.12（2026-11-13）起转录不再记录用量，改为从应用本地数据库
  `%APPDATA%\com.qodercn.app.stable\main.sqlite` 的 `chat_session_messages.turn_credits`
  读取**每轮实扣积分**（真实值）。两段数据互补、不重叠，切换点自动衔接。
- **请求粒度（两代同口径）**：一次模型请求 = 一段 assistant 片段链（thinking /
  text / tool_use 通过 parentUuid 串联，已与数据库 turnCount 核对一致）。旧数据
  由链上的 `usage` 直接成记录；新数据无 usage，按同一链结构 + 内容逐请求估算 token，
  并把该轮的整轮实扣积分挂在该轮最后一次请求上。两代「请求数」可直接对比。
- **积分粒度**：旧数据逐请求记录，新数据来自数据库的**每轮实扣积分**（一次提问=
  一轮），均为真实值。
- **token（主角，本地估算）**：任何版本都不记录 token 计数，面板显示的是**本地估算
  值**：按转录内容估算（ASCII ÷4、中文 ÷1.6），输入计上下文累计、输出计回复内容；
  估算不含系统提示与工具定义，可能低于真实输入量。
- **积分 credits**：旧数据来自转录记录、新数据来自数据库实扣值，均为真实值，面板
  中仅作参考不突出展示。
- **模型名**：运行时读取 Qoder 本地模型目录缓存映射为真名（如 `dfmodel` →
  `DeepSeek-V4-Flash`），Qoder 新增模型会自动跟上。
- **索引缓存**：`~/.qoder-cn/token-meter/index.json`，转录按文件偏移量增量解析；
  数据库轮次每次刷新比对更新（按 session + turn 去重）。

## 隐私与限制

**隐私**

- 只读：仅读取本机会话转录，不修改任何 Qoder 文件；
- 只写自有目录：索引缓存与生成的 HTML 都在 `~/.qoder-cn/token-meter/` 下；
- 不联网：解析、估算、生成全部在本机完成；
- 生成的 HTML 包含提问摘要（截断展示），**转发给别人前请注意脱敏**；
- 卸载：删除技能目录 + 删除 `~/.qoder-cn/token-meter/` 即完全清理。

**限制**

- token 为本地估算，**不是计费口径**；估算不含系统提示与工具定义，可能低于真实输入量；
- 新数据的积分是「轮次」粒度（一次提问=一轮），不同轮内的逐请求积分无法拆分；
- 新数据依赖应用数据库 `main.sqlite` 可读；数据库缺失或结构变化时自动退化为仅转录
  模式（新数据为 0），不影响历史数据；
- 数据更新仅在"生成面板那一刻"，HTML 是静态快照，看最新数据需重新生成一次；
- 每个 Qoder 大版本可能调整会话文件/数据库结构，解析层已做宽容降级，极端情况下需在
  `references/core/parse.mjs` 或 `references/core/usage-db.mjs` 补充适配；
- 使用技能需要系统安装 Node.js 22.5+（内置 `node:sqlite`）。

**免责声明**

- 本项目为开源工具，按「现状」（as-is）提供，不附带任何明示或暗示的担保；
- 所有统计（尤其是 token 估算值）仅供参考，可能与真实用量存在偏差，
  **不构成计费、结算或对账依据**；
- Qoder 客户端升级可能导致会话文件结构变化，进而造成解析失效或数据不准，
  作者不承担由此产生的任何直接或间接损失；
- 请在遵守你所在组织 IT 与数据合规规定的前提下使用本工具。

本项目基于 [MIT License](./LICENSE) 开源。
