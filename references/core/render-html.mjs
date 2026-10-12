// Single-file HTML panel generator. Token-first, Chinese UI, zero external
// resources (all CSS/JS inlined) so the output opens directly in any browser.
// The payload carries every request record; filtering (today / yesterday /
// week / month / all / custom dates) and theme switching happen client-side.

export function renderPanelHtml(payload, options = {}) {
  const title = options.title ?? "Token 消耗面板";
  const embedded = JSON.stringify(payload).replace(/</g, "\\u003c");
  return TEMPLATE
    .replaceAll("__TITLE__", () => title)
    .replace("__PAYLOAD__", () => embedded);
}

const TEMPLATE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>__TITLE__</title>
<style>
  :root {
    --bg: #f5f6f8; --card: #ffffff; --border: #e4e6ea; --text: #1f2329;
    --muted: #6b7280; --accent: #3b82f6; --accent2: #f59e0b; --track: #eef0f3;
    --pill-active: #ffffff; --shadow: 0 1px 3px rgba(15, 23, 42, .16);
    color-scheme: light;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #15171a; --card: #1e2126; --border: #2c3037; --text: #e8eaed;
      --muted: #9aa1ab; --track: #2a2e35; --pill-active: #3a4048;
      --shadow: 0 1px 3px rgba(0, 0, 0, .45);
      color-scheme: dark;
    }
  }
  :root[data-theme="dark"] {
    --bg: #15171a; --card: #1e2126; --border: #2c3037; --text: #e8eaed;
    --muted: #9aa1ab; --track: #2a2e35; --pill-active: #3a4048;
    --shadow: 0 1px 3px rgba(0, 0, 0, .45);
    color-scheme: dark;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text);
    font: 14px/1.6 "Segoe UI", "Microsoft YaHei", system-ui, sans-serif; padding: 28px 20px 40px; }
  .wrap { max-width: 1080px; margin: 0 auto; }
  h1 { font-size: 22px; font-weight: 600; }
  h2 { font-size: 15px; font-weight: 600; margin-bottom: 12px; }
  .sub { color: var(--muted); font-size: 12.5px; margin-top: 4px; }
  .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 12px;
    background: var(--card); border: 1px solid var(--border); border-radius: 10px;
    padding: 10px 12px; margin-top: 14px; }
  .pills { display: inline-flex; background: var(--track); border-radius: 9px; padding: 3px; gap: 2px; }
  .pills button { border: 0; background: transparent; color: var(--muted); font: inherit;
    font-size: 13px; line-height: 1.2; padding: 6px 13px; border-radius: 7px; cursor: pointer; }
  .pills button:hover { color: var(--text); }
  .pills button.active { background: var(--pill-active); color: var(--text); font-weight: 600;
    box-shadow: var(--shadow); }
  .dates { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 12.5px; }
  .dates input { font: inherit; font-size: 13px; color: var(--text); background: var(--card);
    border: 1px solid var(--border); border-radius: 8px; padding: 5px 9px; }
  .dates input:focus { outline: none; border-color: var(--accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 22%, transparent); }
  .theme-btn { margin-left: auto; font: inherit; font-size: 13px; color: var(--text);
    background: var(--card); border: 1px solid var(--border); border-radius: 8px;
    padding: 6px 12px; cursor: pointer; }
  .theme-btn:hover { border-color: var(--accent); color: var(--accent); }
  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 14px 0; }
  @media (max-width: 860px) { .cards { grid-template-columns: repeat(2, 1fr); } }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }
  .card .label { color: var(--muted); font-size: 12.5px; }
  .card .total { font-size: 26px; font-weight: 650; margin: 2px 0 4px; letter-spacing: .2px; }
  .card .meta { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .panel { background: var(--card); border: 1px solid var(--border); border-radius: 10px;
    padding: 16px 18px; margin-bottom: 14px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 860px) { .grid2 { grid-template-columns: 1fr; } }
  .legend { display: flex; gap: 16px; align-items: center; color: var(--muted); font-size: 12.5px; margin-bottom: 8px; }
  .dot { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
  .dot.in { background: var(--accent); } .dot.out { background: var(--accent2); }
  .rank-row { display: grid; grid-template-columns: minmax(90px, 34%) 1fr auto; gap: 10px;
    align-items: center; padding: 5px 0; font-size: 13px; }
  .rank-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rank-track { background: var(--track); border-radius: 4px; height: 14px; overflow: hidden; }
  .rank-bar { height: 100%; background: var(--accent); border-radius: 4px; min-width: 2px; }
  .rank-val { color: var(--muted); font-variant-numeric: tabular-nums; }
  .empty { color: var(--muted); font-size: 13px; padding: 8px 0; }
  .hint { color: var(--muted); font-size: 12px; font-weight: 400; margin-left: 8px; }
  .session-scroll { max-height: 480px; overflow: auto; }
  .session-scroll thead th { position: sticky; top: 0; z-index: 2; background: var(--card); }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; color: var(--muted); font-weight: 500; padding: 7px 8px;
    border-bottom: 1px solid var(--border); white-space: nowrap; }
  td { padding: 7px 8px; border-bottom: 1px solid var(--border); vertical-align: top; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tbody tr.srow { cursor: pointer; }
  tbody tr.srow:hover { background: color-mix(in srgb, var(--accent) 6%, transparent); }
  .expander { display: inline-block; width: 14px; color: var(--muted); transition: transform .12s; }
  tr.srow.open .expander { transform: rotate(90deg); }
  .prompt { color: var(--muted); max-width: 200px; overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap; }
  td.model-cell { white-space: nowrap; }
  tr.drow > td { padding: 0 10px 12px; background: color-mix(in srgb, var(--accent) 4%, transparent); }
  tr.drow table { font-size: 12.5px; }
  tr.drow th, tr.drow td { padding: 4px 8px; }
  .detail-scroll { max-height: 340px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; }
  .ctx-cell { min-width: 88px; }
  .ctx-track { background: var(--track); border-radius: 3px; height: 8px; overflow: hidden; margin-top: 4px; }
  .ctx-bar { height: 100%; background: var(--accent2); min-width: 1px; }
  footer { color: var(--muted); font-size: 12px; margin-top: 18px; line-height: 1.8; }
  code { background: var(--track); border-radius: 4px; padding: 1px 5px; font-size: 12px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>__TITLE__</h1>
    <p class="sub">更新于 <span id="generatedAt">-</span> · 数据来源：Qoder CN 本机会话记录 · 全部在本机解析，不联网</p>
  </header>

  <div class="toolbar">
    <div class="pills" id="pills">
      <button type="button" data-preset="today">今天</button>
      <button type="button" data-preset="yesterday">昨天</button>
      <button type="button" data-preset="week">本周</button>
      <button type="button" data-preset="month">本月</button>
      <button type="button" data-preset="all" class="active">全部</button>
    </div>
    <div class="dates">
      <input type="date" id="dateFrom" aria-label="开始日期">
      <span>~</span>
      <input type="date" id="dateTo" aria-label="结束日期">
    </div>
    <button type="button" class="theme-btn" id="themeBtn" title="切换白天 / 黑夜">主题：白天</button>
  </div>

  <section class="cards" id="cards"></section>

  <section class="panel">
    <h2>Token 趋势<span class="hint" id="trendRange"></span></h2>
    <div class="legend"><span><span class="dot in"></span>输入 Token</span><span><span class="dot out"></span>输出 Token</span></div>
    <div id="trend"></div>
  </section>

  <div class="grid2">
    <section class="panel"><h2>按项目</h2><div id="byProject"></div></section>
    <section class="panel"><h2>按模型</h2><div id="byModel"></div></section>
  </div>

  <section class="panel">
    <h2>会话列表<span class="hint">点击任意行展开每次请求的明细</span></h2>
    <div class="session-scroll"><table id="sessions"></table></div>
  </section>

  <footer>
    Token 数为本地估算：输入按该请求之前的上下文累计、输出按回复内容（ASCII÷4、中文÷1.6），不代表账单口径。<br>
    筛选与主题切换只在当前快照内进行；看最新数据请重新生成：<code>node token-meter/core/cli.mjs html</code>
  </footer>
</div>

<script id="payload" type="application/json">__PAYLOAD__</script>
<script>
(function () {
  var data = JSON.parse(document.getElementById("payload").textContent);
  var REQUESTS = data.requests || [];
  var SESSIONS = data.sessions || [];
  var MODELS = data.models || [];
  var DAY = 86400000;
  var PRESETS = { today: "今天", yesterday: "昨天", week: "本周", month: "本月", all: "全部" };

  // ---- theme (default follows system, click toggles light/dark, remembered) ----
  var THEME_KEY = "token-panel-theme";
  var rootEl = document.documentElement;
  var themeBtn = document.getElementById("themeBtn");
  function systemDark() {
    return window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)").matches : false;
  }
  function isDark() {
    var t = rootEl.getAttribute("data-theme");
    if (t === "dark") return true;
    if (t === "light") return false;
    return systemDark();
  }
  function paintThemeBtn() { themeBtn.textContent = "主题：" + (isDark() ? "黑夜" : "白天"); }
  try {
    var savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === "light" || savedTheme === "dark") rootEl.setAttribute("data-theme", savedTheme);
  } catch (e) {}
  paintThemeBtn();
  themeBtn.addEventListener("click", function () {
    var next = isDark() ? "light" : "dark";
    rootEl.setAttribute("data-theme", next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    paintThemeBtn();
  });
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var onMq = function () { if (!rootEl.getAttribute("data-theme")) paintThemeBtn(); };
    if (mq.addEventListener) mq.addEventListener("change", onMq);
    else if (mq.addListener) mq.addListener(onMq);
  }

  // ---- helpers ----
  function pad2(n) { return String(n).padStart(2, "0"); }
  function fmt(n) {
    n = Number(n) || 0;
    if (n >= 1e8) return (n / 1e8).toFixed(2) + "亿";
    if (n >= 1e4) {
      var wan = n / 1e4;
      return (wan >= 100 ? wan.toFixed(0) : wan.toFixed(1)) + "万";
    }
    return String(Math.round(n));
  }
  function fmtExact(n) { return (Math.round(Number(n) || 0)).toLocaleString("zh-CN"); }
  function fmtTime(ms) {
    if (ms === null || ms === undefined || isNaN(ms)) return "-";
    var d = new Date(ms);
    return (d.getMonth() + 1) + "-" + pad2(d.getDate()) + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }
  function fmtDay(ms) {
    var d = new Date(ms);
    return (d.getMonth() + 1) + "-" + pad2(d.getDate());
  }
  function dayKey(ms) {
    var d = new Date(ms);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }
  function monthKey(ms) {
    var d = new Date(ms);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1);
  }
  function startOfDay(y, m, d) { return new Date(y, m, d).getTime(); }
  function fmtCredits(n) {
    n = Number(n) || 0;
    return n >= 100 ? String(Math.round(n)) : n.toFixed(1);
  }
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function shortProject(slug) {
    var s = String(slug || "");
    var parts = s.split("-");
    return parts[parts.length - 1] || s;
  }

  // ---- filter state ----
  var state = { preset: "all", from: "", to: "" };
  var pills = document.getElementById("pills");
  var dateFrom = document.getElementById("dateFrom");
  var dateTo = document.getElementById("dateTo");

  function presetRange(preset) {
    var now = new Date();
    var y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
    if (preset === "today") return { since: startOfDay(y, m, d), until: startOfDay(y, m, d + 1) };
    if (preset === "yesterday") return { since: startOfDay(y, m, d - 1), until: startOfDay(y, m, d) };
    if (preset === "week") {
      var mondayOffset = (now.getDay() + 6) % 7;
      return { since: startOfDay(y, m, d - mondayOffset), until: startOfDay(y, m, d - mondayOffset + 7) };
    }
    if (preset === "month") return { since: startOfDay(y, m, 1), until: startOfDay(y, m + 1, 1) };
    return { since: null, until: null };
  }
  function dateInputToMs(str, plusDays) {
    if (!str) return null;
    var parts = String(str).split("-");
    var y = Number(parts[0]), mm = Number(parts[1]), dd = Number(parts[2]);
    if (!y || !mm || !dd) return null;
    return startOfDay(y, mm - 1, dd + (plusDays || 0));
  }
  function activeRange() {
    if (state.preset === "custom") {
      var from = state.from, to = state.to;
      if (from && to && from > to) { var tmp = from; from = to; to = tmp; }
      var since = dateInputToMs(from, 0);
      var until = dateInputToMs(to, 1);
      if (since === null && until === null) return { since: null, until: null, label: "全部" };
      var label = (since !== null ? fmtDay(since) : "最早") + " ~ " + (until !== null ? fmtDay(until - 1) : "现在");
      return { since: since, until: until, label: label };
    }
    var r = presetRange(state.preset);
    return { since: r.since, until: r.until, label: PRESETS[state.preset] || "全部" };
  }
  function inRange(range, t) {
    if (range.since !== null && range.since !== undefined && t < range.since) return false;
    if (range.until !== null && range.until !== undefined && t >= range.until) return false;
    return true;
  }
  function syncControls() {
    var btns = pills.querySelectorAll("button");
    for (var i = 0; i < btns.length; i += 1) {
      var b = btns[i];
      if (b.getAttribute("data-preset") === state.preset) b.classList.add("active");
      else b.classList.remove("active");
    }
    if (dateFrom.value !== state.from) dateFrom.value = state.from;
    if (dateTo.value !== state.to) dateTo.value = state.to;
  }
  Array.prototype.forEach.call(pills.querySelectorAll("button"), function (btn) {
    btn.addEventListener("click", function () {
      state.preset = btn.getAttribute("data-preset");
      state.from = ""; state.to = "";
      refresh();
    });
  });
  function onDateInput() {
    var f = dateFrom.value, t = dateTo.value;
    if (!f && !t) { state.preset = "all"; state.from = ""; state.to = ""; }
    else { state.preset = "custom"; state.from = f; state.to = t; }
    refresh();
  }
  dateFrom.addEventListener("change", onDateInput);
  dateTo.addEventListener("change", onDateInput);

  // ---- KPI cards (scoped to current filter) ----
  function renderCards(rows, range) {
    var i = 0, o = 0, credits = 0, billed = 0;
    var sidSet = {}, projSet = {}, sidCount = 0, projCount = 0;
    rows.forEach(function (r) {
      i += r.i; o += r.o;
      if (r.c !== null && r.c !== undefined) { credits += r.c; billed += 1; }
      if (!sidSet[r.s]) { sidSet[r.s] = 1; sidCount += 1; }
      var p = SESSIONS[r.s] ? SESSIONS[r.s].project : "unknown";
      if (!projSet[p]) { projSet[p] = 1; projCount += 1; }
    });
    var host = document.getElementById("cards");
    host.innerHTML = "";
    function addCard(label, value, sub, title) {
      var card = el("div", "card");
      card.appendChild(el("div", "label", label));
      var total = el("div", "total", value);
      if (title) total.title = title;
      card.appendChild(total);
      if (sub) card.appendChild(el("div", "meta", sub));
      host.appendChild(card);
    }
    addCard("Token 合计 · " + range.label, fmt(i + o),
      "输入 " + fmt(i) + " · 输出 " + fmt(o),
      "输入 " + fmtExact(i) + " / 输出 " + fmtExact(o));
    addCard("请求数", fmtExact(rows.length), "计费 " + fmtExact(billed) + " 次");
    addCard("活跃会话", fmtExact(sidCount), "项目 " + projCount + " 个");
    addCard("积分", fmtCredits(credits), "会话记录真实值 · 仅供参考", credits.toFixed(4));
  }

  // ---- trend (stacked SVG bars over the filtered span) ----
  function renderTrend(rows, range) {
    var host = document.getElementById("trend");
    var hint = document.getElementById("trendRange");
    host.innerHTML = "";
    if (!rows.length) {
      hint.textContent = "（" + range.label + "）";
      host.appendChild(el("div", "empty", "所选范围内暂无记录。"));
      return;
    }
    var since = range.since, until = range.until;
    if (since === null || until === null) {
      var min = null, max = null;
      rows.forEach(function (r) {
        if (min === null || r.t < min) min = r.t;
        if (max === null || r.t > max) max = r.t;
      });
      if (since === null) { var d0 = new Date(min); since = startOfDay(d0.getFullYear(), d0.getMonth(), d0.getDate()); }
      if (until === null) { var d1 = new Date(max); until = startOfDay(d1.getFullYear(), d1.getMonth(), d1.getDate() + 1); }
    }
    var byMonth = Math.round((until - since) / DAY) > 200;
    var cells = [], cellMap = {};
    if (byMonth) {
      var cm = new Date(since);
      cm = new Date(cm.getFullYear(), cm.getMonth(), 1);
      while (cm.getTime() < until) {
        var mk = cm.getFullYear() + "-" + pad2(cm.getMonth() + 1);
        var mc = { key: mk, label: mk.slice(2), i: 0, o: 0 };
        cells.push(mc); cellMap[mk] = mc;
        cm = new Date(cm.getFullYear(), cm.getMonth() + 1, 1);
      }
    } else {
      var cd = new Date(since);
      cd = new Date(cd.getFullYear(), cd.getMonth(), cd.getDate());
      while (cd.getTime() < until) {
        var dk = dayKey(cd.getTime());
        var dc = { key: dk, label: dk.slice(5), i: 0, o: 0 };
        cells.push(dc); cellMap[dk] = dc;
        cd = new Date(cd.getFullYear(), cd.getMonth(), cd.getDate() + 1);
      }
    }
    rows.forEach(function (r) {
      var c = cellMap[byMonth ? monthKey(r.t) : dayKey(r.t)];
      if (c) { c.i += r.i; c.o += r.o; }
    });
    var unit = byMonth ? " 个月" : " 天";
    hint.textContent = "（" + range.label + "） " + cells[0].label +
      (cells.length > 1 ? " ~ " + cells[cells.length - 1].label : "") +
      " · " + cells.length + unit;

    var NS = "http://www.w3.org/2000/svg";
    var W = 1000, H = 220, padB = 26, padT = 10;
    var max = 1;
    cells.forEach(function (c) { max = Math.max(max, c.i + c.o); });
    var slot = W / cells.length;
    var barW = Math.max(3, Math.min(38, slot * 0.55));
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("width", "100%");
    svg.setAttribute("role", "img");
    var grid = document.createElementNS(NS, "g");
    var labels = document.createElementNS(NS, "g");
    var step = Math.ceil(cells.length / 12);
    cells.forEach(function (c, idx) {
      var x = idx * slot + (slot - barW) / 2;
      var hIn = Math.round((c.i / max) * (H - padB - padT));
      var hOut = Math.round((c.o / max) * (H - padB - padT));
      var yIn = H - padB - hIn;
      var tip = c.key + "\\n输入 " + fmtExact(c.i) + "\\n输出 " + fmtExact(c.o) + "\\n合计 " + fmtExact(c.i + c.o);
      if (hIn > 0) {
        var r1 = document.createElementNS(NS, "rect");
        r1.setAttribute("x", x); r1.setAttribute("y", yIn);
        r1.setAttribute("width", barW); r1.setAttribute("height", hIn);
        r1.setAttribute("fill", "var(--accent)");
        var t1 = document.createElementNS(NS, "title");
        t1.textContent = tip;
        r1.appendChild(t1);
        grid.appendChild(r1);
      }
      if (hOut > 0) {
        var r2 = document.createElementNS(NS, "rect");
        r2.setAttribute("x", x); r2.setAttribute("y", yIn - hOut);
        r2.setAttribute("width", barW); r2.setAttribute("height", hOut);
        r2.setAttribute("fill", "var(--accent2)");
        var t2 = document.createElementNS(NS, "title");
        t2.textContent = tip;
        r2.appendChild(t2);
        grid.appendChild(r2);
      }
      if (idx === 0 || idx === cells.length - 1 || idx % step === 0) {
        var lab = document.createElementNS(NS, "text");
        lab.setAttribute("x", x + barW / 2); lab.setAttribute("y", H - 8);
        lab.setAttribute("text-anchor", "middle");
        lab.setAttribute("font-size", "11");
        lab.setAttribute("fill", "var(--muted)");
        lab.textContent = c.label;
        labels.appendChild(lab);
      }
    });
    var base = document.createElementNS(NS, "line");
    base.setAttribute("x1", 0); base.setAttribute("x2", W);
    base.setAttribute("y1", H - padB); base.setAttribute("y2", H - padB);
    base.setAttribute("stroke", "var(--border)");
    svg.appendChild(grid); svg.appendChild(base); svg.appendChild(labels);
    host.appendChild(svg);
  }

  // ---- rankings ----
  function paintRank(container, list, shorten) {
    container.innerHTML = "";
    if (!list.length) { container.appendChild(el("div", "empty", "暂无数据。")); return; }
    list.sort(function (a, b) { return (b.i + b.o) - (a.i + a.o); });
    var total = 0;
    list.forEach(function (r) { total += r.i + r.o; });
    list.slice(0, 8).forEach(function (r) {
      var value = r.i + r.o;
      var row = el("div", "rank-row");
      var nameCell = el("div", "rank-name", shorten ? shortProject(r.name) : r.name);
      nameCell.title = r.name;
      row.appendChild(nameCell);
      var track = el("div", "rank-track");
      var bar = el("div", "rank-bar");
      bar.style.width = (total > 0 ? Math.max(1, Math.round((value / total) * 100)) : 0) + "%";
      track.appendChild(bar);
      row.appendChild(track);
      var valEl = el("div", "rank-val", fmt(value) + " · " + (total > 0 ? ((value / total) * 100).toFixed(1) : "0.0") + "%");
      valEl.title = fmtExact(value);
      row.appendChild(valEl);
      container.appendChild(row);
    });
  }
  function renderRanks(rows) {
    var byProject = {}, byModel = {};
    rows.forEach(function (r) {
      var p = SESSIONS[r.s] ? SESSIONS[r.s].project : "unknown";
      var pb = byProject[p] || (byProject[p] = { name: p, i: 0, o: 0 });
      pb.i += r.i; pb.o += r.o;
      var mn = MODELS[r.m] || "未知";
      var mb = byModel[mn] || (byModel[mn] = { name: mn, i: 0, o: 0 });
      mb.i += r.i; mb.o += r.o;
    });
    paintRank(document.getElementById("byProject"),
      Object.keys(byProject).map(function (k) { return byProject[k]; }), true);
    paintRank(document.getElementById("byModel"),
      Object.keys(byModel).map(function (k) { return byModel[k]; }), false);
  }

  // ---- sessions table with expandable per-request detail ----
  function buildDetail(si, rows) {
    var list = rows.filter(function (r) { return r.s === si; }).sort(function (a, b) { return a.t - b.t; });
    var box = el("div");
    if (!list.length) { box.appendChild(el("div", "empty", "暂无明细。")); return box; }
    var t = el("table");
    var head = el("thead");
    var hrow = el("tr");
    [["时间", ""], ["模型", ""], ["输入 Token", "num"], ["输出 Token", "num"], ["上下文占用", "num"], ["结束", ""]].forEach(function (pair) {
      hrow.appendChild(el("th", pair[1], pair[0]));
    });
    head.appendChild(hrow); t.appendChild(head);
    var body = el("tbody");
    list.forEach(function (r) {
      var row = el("tr");
      row.appendChild(el("td", "", fmtTime(r.t)));
      row.appendChild(el("td", "", MODELS[r.m] || "未知"));
      row.appendChild(el("td", "num", fmtExact(r.i)));
      row.appendChild(el("td", "num", fmtExact(r.o)));
      var ctx = el("td", "num ctx-cell");
      if (r.x !== null && r.x !== undefined) {
        ctx.appendChild(el("span", "", (r.x * 100).toFixed(1) + "%"));
        var track = el("div", "ctx-track");
        var bar = el("div", "ctx-bar");
        bar.style.width = Math.min(100, Math.max(1, r.x * 100)) + "%";
        track.appendChild(bar);
        ctx.appendChild(track);
      } else {
        ctx.textContent = "-";
      }
      row.appendChild(ctx);
      row.appendChild(el("td", "", r.r || "-"));
      body.appendChild(row);
    });
    t.appendChild(body);
    var scroll = el("div", "detail-scroll");
    scroll.appendChild(t);
    box.appendChild(scroll);
    return box;
  }

  function renderSessions(rows) {
    var byS = {};
    rows.forEach(function (r) {
      var b = byS[r.s] || (byS[r.s] = { si: r.s, i: 0, o: 0, n: 0, last: null, models: {} });
      b.i += r.i; b.o += r.o; b.n += 1;
      if (b.last === null || r.t > b.last) b.last = r.t;
      b.models[MODELS[r.m] || "未知"] = 1;
    });
    var list = Object.keys(byS).map(function (k) { return byS[k]; });
    list.sort(function (a, b) { return (b.i + b.o) - (a.i + a.o); });

    var table = document.getElementById("sessions");
    table.innerHTML = "";
    var thead = el("thead");
    var htr = el("tr");
    ["", "最近活动", "项目", "模型", "Token 合计", "输入", "输出", "请求", "提问"].forEach(function (label, idx) {
      htr.appendChild(el("th", idx >= 4 && idx <= 7 ? "num" : "", label));
    });
    thead.appendChild(htr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);

    if (!list.length) {
      var emptyRow = el("tr");
      var emptyCell = el("td", "", "所选范围内暂无会话记录。");
      emptyCell.colSpan = 9;
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
      return;
    }

    list.forEach(function (s) {
      var meta = SESSIONS[s.si] || { id: "-", project: "", prompt: null };
      var total = s.i + s.o;
      var tr = el("tr", "srow");
      tr.dataset.sessionId = meta.id;
      var cells = [
        null,
        fmtTime(s.last),
        shortProject(meta.project),
        Object.keys(s.models).join(", "),
        fmt(total),
        fmt(s.i),
        fmt(s.o),
        String(s.n),
        meta.prompt || "-"
      ];
      cells.forEach(function (value, idx) {
        if (idx === 0) {
          var td0 = el("td");
          td0.appendChild(el("span", "expander", "▸"));
          tr.appendChild(td0);
          return;
        }
        var td = el("td", idx >= 4 && idx <= 7 ? "num" : "", value);
        if (idx === 2) td.title = String(meta.project || "");
        if (idx === 3) td.classList.add("model-cell");
        if (idx === 4) td.title = fmtExact(total);
        if (idx === 5) td.title = fmtExact(s.i);
        if (idx === 6) td.title = fmtExact(s.o);
        if (idx === 8) td.classList.add("prompt");
        tr.appendChild(td);
      });
      tbody.appendChild(tr);

      var open = false;
      var detailRow = null;
      tr.addEventListener("click", function () {
        if (open) {
          open = false;
          tr.classList.remove("open");
          if (detailRow) detailRow.style.display = "none";
          return;
        }
        open = true;
        tr.classList.add("open");
        if (!detailRow) {
          detailRow = el("tr", "drow");
          var host = el("td");
          host.colSpan = 9;
          host.appendChild(buildDetail(s.si, rows));
          detailRow.appendChild(host);
          tr.parentNode.insertBefore(detailRow, tr.nextSibling);
        }
        detailRow.style.display = "";
      });
    });
  }

  // ---- refresh everything under the current filter ----
  function refresh() {
    var range = activeRange();
    var rows = REQUESTS.filter(function (r) { return inRange(range, r.t); });
    renderCards(rows, range);
    renderTrend(rows, range);
    renderRanks(rows);
    renderSessions(rows);
    syncControls();
  }

  var generatedAt = new Date(data.generatedAt).getTime();
  document.getElementById("generatedAt").textContent = fmtTime(generatedAt);
  refresh();
})();
</script>
</body>
</html>
`;
