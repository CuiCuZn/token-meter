// Single-file HTML panel generator. Token-first, Chinese UI, zero external
// resources (all CSS/JS inlined) so the output opens directly in any browser.

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
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #15171a; --card: #1e2126; --border: #2c3037; --text: #e8eaed;
      --muted: #9aa1ab; --track: #2a2e35;
    }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text);
    font: 14px/1.6 "Segoe UI", "Microsoft YaHei", system-ui, sans-serif; padding: 28px 20px 40px; }
  .wrap { max-width: 1080px; margin: 0 auto; }
  h1 { font-size: 22px; font-weight: 600; }
  h2 { font-size: 15px; font-weight: 600; margin-bottom: 12px; }
  .sub { color: var(--muted); font-size: 12.5px; margin-top: 4px; }
  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 18px 0; }
  @media (max-width: 860px) { .cards { grid-template-columns: repeat(2, 1fr); } }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }
  .card .label { color: var(--muted); font-size: 12.5px; }
  .card .total { font-size: 26px; font-weight: 650; margin: 2px 0 4px; letter-spacing: .2px; }
  .card .io { font-size: 12.5px; color: var(--muted); }
  .card .io b { color: var(--text); font-weight: 600; }
  .card .meta { font-size: 12px; color: var(--muted); margin-top: 4px; }
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
  .table-wrap { overflow-x: auto; }
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
  .detail-scroll { max-height: 360px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; }
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

  <section class="cards" id="cards"></section>

  <section class="panel">
    <h2>近 30 天 Token 趋势</h2>
    <div class="legend"><span><span class="dot in"></span>输入 Token</span><span><span class="dot out"></span>输出 Token</span></div>
    <div id="trend"></div>
  </section>

  <div class="grid2">
    <section class="panel"><h2>按项目</h2><div id="byProject"></div></section>
    <section class="panel"><h2>按模型</h2><div id="byModel"></div></section>
  </div>

  <section class="panel">
    <h2>会话列表<span class="hint">点击任意行展开每次请求的明细</span></h2>
    <div class="table-wrap"><table id="sessions"></table></div>
  </section>

  <footer>
    Token 数为本地估算：输入按该请求之前的上下文累计、输出按回复内容（ASCII÷4、中文÷1.6），不代表账单口径。<br>
    重新生成：<code>node token-meter/core/cli.mjs html</code>（增量刷新后覆盖本文件）
  </footer>
</div>

<script id="payload" type="application/json">__PAYLOAD__</script>
<script>
(function () {
  var data = JSON.parse(document.getElementById("payload").textContent);

  function fmt(n) {
    n = Number(n) || 0;
    if (n >= 1e8) return (n / 1e8).toFixed(2) + "亿";
    if (n >= 1e4) {
      var wan = n / 1e4;
      return (wan >= 100 ? wan.toFixed(0) : wan.toFixed(1)) + "万";
    }
    return String(Math.round(n));
  }
  function fmtExact(n) { return (Number(n) || 0).toLocaleString("zh-CN"); }
  function fmtTime(iso) {
    if (!iso) return "-";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "-";
    var p = function (x) { return String(x).padStart(2, "0"); };
    return (d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
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

  document.getElementById("generatedAt").textContent = fmtTime(data.generatedAt);

  // ---- KPI cards ----
  var scopes = data.scopes || {};
  var cardDefs = [
    { key: "today", label: "今日" },
    { key: "7d", label: "近 7 天" },
    { key: "30d", label: "近 30 天" },
    { key: "all", label: "全部时间" }
  ];
  var cards = document.getElementById("cards");
  cardDefs.forEach(function (def) {
    var s = scopes[def.key];
    if (!s) return;
    var card = el("div", "card");
    card.appendChild(el("div", "label", def.label + " Token"));
    var totalEl = el("div", "total", fmt(s.tokensTotalEst));
    totalEl.title = fmtExact(s.tokensTotalEst);
    card.appendChild(totalEl);
    var io = el("div", "io");
    io.innerHTML = "输入 <b>" + fmt(s.tokensInEst) + "</b>&nbsp;&nbsp;输出 <b>" + fmt(s.tokensOutEst) + "</b>";
    io.title = "输入 " + fmtExact(s.tokensInEst) + " / 输出 " + fmtExact(s.tokensOutEst);
    card.appendChild(io);
    card.appendChild(el("div", "meta", s.requests + " 次请求 · " + s.sessions + " 个会话"));
    cards.appendChild(card);
  });

  // ---- Trend (stacked SVG bars) ----
  var days = (data.days || []).slice(-30);
  var trend = document.getElementById("trend");
  if (!days.length) {
    trend.appendChild(el("div", "empty", "最近 30 天暂无记录。"));
  } else {
    var NS = "http://www.w3.org/2000/svg";
    var W = 1000, H = 220, padB = 26, padT = 10;
    var max = 1;
    days.forEach(function (d) { max = Math.max(max, (d.tokensInEst || 0) + (d.tokensOutEst || 0)); });
    var slot = W / days.length;
    var barW = Math.max(6, Math.min(38, slot * 0.55));
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("width", "100%");
    svg.setAttribute("role", "img");
    var grid = document.createElementNS(NS, "g");
    var labels = document.createElementNS(NS, "g");
    days.forEach(function (d, i) {
      var x = i * slot + (slot - barW) / 2;
      var inV = d.tokensInEst || 0, outV = d.tokensOutEst || 0;
      var hIn = Math.round((inV / max) * (H - padB - padT));
      var hOut = Math.round((outV / max) * (H - padB - padT));
      var yIn = H - padB - hIn;
      if (hIn > 0) {
        var r1 = document.createElementNS(NS, "rect");
        r1.setAttribute("x", x); r1.setAttribute("y", yIn);
        r1.setAttribute("width", barW); r1.setAttribute("height", hIn);
        r1.setAttribute("fill", "var(--accent)");
        var t1 = document.createElementNS(NS, "title");
        t1.textContent = d.date + "\\n输入 " + fmtExact(inV) + "\\n输出 " + fmtExact(outV) + "\\n合计 " + fmtExact(inV + outV);
        r1.appendChild(t1);
        grid.appendChild(r1);
      }
      if (hOut > 0) {
        var r2 = document.createElementNS(NS, "rect");
        r2.setAttribute("x", x); r2.setAttribute("y", yIn - hOut);
        r2.setAttribute("width", barW); r2.setAttribute("height", hOut);
        r2.setAttribute("fill", "var(--accent2)");
        var t2 = document.createElementNS(NS, "title");
        t2.textContent = d.date + "\\n输入 " + fmtExact(inV) + "\\n输出 " + fmtExact(outV) + "\\n合计 " + fmtExact(inV + outV);
        r2.appendChild(t2);
        grid.appendChild(r2);
      }
      var showLabel = days.length <= 10 || i % Math.ceil(days.length / 10) === 0 || i === days.length - 1;
      if (showLabel) {
        var lab = document.createElementNS(NS, "text");
        lab.setAttribute("x", x + barW / 2); lab.setAttribute("y", H - 8);
        lab.setAttribute("text-anchor", "middle");
        lab.setAttribute("font-size", "11");
        lab.setAttribute("fill", "var(--muted)");
        lab.textContent = d.date.slice(5);
        labels.appendChild(lab);
      }
    });
    var base = document.createElementNS(NS, "line");
    base.setAttribute("x1", 0); base.setAttribute("x2", W);
    base.setAttribute("y1", H - padB); base.setAttribute("y2", H - padB);
    base.setAttribute("stroke", "var(--border)");
    svg.appendChild(grid); svg.appendChild(base); svg.appendChild(labels);
    trend.appendChild(svg);
  }

  // ---- Rankings ----
  function renderRank(container, rows, nameKey) {
    if (!rows || !rows.length) {
      container.appendChild(el("div", "empty", "暂无数据。"));
      return;
    }
    var list = rows.slice();
    list.sort(function (a, b) {
      return (b.tokensInEst + b.tokensOutEst) - (a.tokensInEst + a.tokensOutEst);
    });
    var total = 0;
    list.forEach(function (r) { total += (r.tokensInEst || 0) + (r.tokensOutEst || 0); });
    list.slice(0, 8).forEach(function (r) {
      var value = (r.tokensInEst || 0) + (r.tokensOutEst || 0);
      var full = String(r[nameKey] || "未知");
      var row = el("div", "rank-row");
      var nameCell = el("div", "rank-name", nameKey === "project" ? shortProject(full) : full);
      nameCell.title = full;
      row.appendChild(nameCell);
      var track = el("div", "rank-track");
      var bar = el("div", "rank-bar");
      bar.style.width = (total > 0 ? Math.max(1, Math.round((value / total) * 100)) : 0) + "%";
      track.appendChild(bar);
      row.appendChild(track);
      var valEl = el("div", "rank-val", fmt(value) + " · " + (total > 0 ? ((value / total) * 100).toFixed(1) : "0") + "%");
      valEl.title = fmtExact(value);
      row.appendChild(valEl);
      container.appendChild(row);
    });
  }
  renderRank(document.getElementById("byProject"), data.projects, "project");
  renderRank(document.getElementById("byModel"), data.models, "model");

  // ---- Sessions table with expandable per-request detail ----
  var sessions = (data.sessions || []).slice().sort(function (a, b) {
    return (b.tokensInEst + b.tokensOutEst) - (a.tokensInEst + a.tokensOutEst);
  });
  var details = data.details || {};
  var table = document.getElementById("sessions");
  var thead = document.createElement("thead");
  var htr = document.createElement("tr");
  ["", "最近活动", "项目", "模型", "Token 合计", "输入", "输出", "请求", "提问"].forEach(function (label, idx) {
    var th = el("th", idx >= 4 && idx <= 7 ? "num" : "", label);
    if (idx === 4 || idx === 5 || idx === 6 || idx === 7) th.className = "num";
    htr.appendChild(th);
  });
  thead.appendChild(htr);
  table.appendChild(thead);
  var tbody = document.createElement("tbody");
  table.appendChild(tbody);

  if (!sessions.length) {
    var emptyRow = document.createElement("tr");
    var emptyCell = el("td", "", "暂无会话记录。");
    emptyCell.colSpan = 9;
    emptyRow.appendChild(emptyCell);
    tbody.appendChild(emptyRow);
  }

  sessions.forEach(function (s) {
    var total = (s.tokensInEst || 0) + (s.tokensOutEst || 0);
    var tr = el("tr", "srow");
    tr.dataset.sessionId = s.sessionId;
    var cells = [
      null,
      fmtTime(s.lastTs),
      shortProject(s.project),
      (s.models || []).join(", "),
      fmt(total),
      fmt(s.tokensInEst),
      fmt(s.tokensOutEst),
      String(s.requests || 0),
      s.promptPreview || "-"
    ];
    cells.forEach(function (value, idx) {
      if (idx === 0) {
        var td = el("td");
        td.appendChild(el("span", "expander", "\\u25B8"));
        tr.appendChild(td);
        return;
      }
      var td = el("td", idx >= 4 && idx <= 7 ? "num" : "", value);
      if (idx === 2) td.title = String(s.project || "");
      if (idx === 3) td.classList.add("model-cell");
      if (idx === 4) td.title = fmtExact(total);
      if (idx === 5) td.title = fmtExact(s.tokensInEst);
      if (idx === 6) td.title = fmtExact(s.tokensOutEst);
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
        detailRow = document.createElement("tr");
        detailRow.className = "drow";
        var host = el("td");
        host.colSpan = 9;
        host.appendChild(buildDetail(s.sessionId));
        detailRow.appendChild(host);
        tr.parentNode.insertBefore(detailRow, tr.nextSibling);
      }
      detailRow.style.display = "";
    });
  });

  function buildDetail(sessionId) {
    var rows = details[sessionId];
    var box = el("div");
    if (!rows || !rows.length) {
      box.appendChild(el("div", "empty", "该会话（或更早部分的请求）暂无逐请求明细。"));
      return box;
    }
    var t = el("table");
    var head = el("thead");
    var hrow = el("tr");
    [["时间", ""], ["模型", ""], ["输入 Token", "num"], ["输出 Token", "num"], ["上下文占用", "num"], ["结束", ""]].forEach(function (pair) {
      hrow.appendChild(el("th", pair[1], pair[0]));
    });
    head.appendChild(hrow); t.appendChild(head);
    var body = el("tbody");
    rows.forEach(function (r) {
      var row = el("tr");
      row.appendChild(el("td", "", fmtTime(r.ts)));
      row.appendChild(el("td", "", String(r.model || "-")));
      row.appendChild(el("td", "num", fmtExact(r.tokensInEst)));
      row.appendChild(el("td", "num", fmtExact(r.tokensOutEst)));
      var ctx = el("td", "num ctx-cell");
      if (r.ctxRatio !== null && r.ctxRatio !== undefined) {
        var txt = el("span", "", (r.ctxRatio * 100).toFixed(1) + "%");
        ctx.appendChild(txt);
        var track = el("div", "ctx-track");
        var bar = el("div", "ctx-bar");
        bar.style.width = Math.min(100, Math.max(1, r.ctxRatio * 100)) + "%";
        track.appendChild(bar);
        ctx.appendChild(track);
      } else {
        ctx.textContent = "-";
      }
      row.appendChild(ctx);
      row.appendChild(el("td", "", r.stopReason || "-"));
      body.appendChild(row);
    });
    t.appendChild(body);
    var scroll = el("div", "detail-scroll");
    scroll.appendChild(t);
    box.appendChild(scroll);
    return box;
  }
})();
</script>
</body>
</html>
`;
