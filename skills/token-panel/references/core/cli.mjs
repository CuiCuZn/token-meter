#!/usr/bin/env node
// token-meter CLI: used by the token-panel skill and for manual inspection.
//
//   node cli.mjs refresh [--full] [--json]
//   node cli.mjs summary [--range all|today|7d|30d] [--project <slug>] [--json]
//   node cli.mjs days    [--range 30d] [--json]
//   node cli.mjs projects [--range all] [--json]
//   node cli.mjs models   [--range all] [--json]
//   node cli.mjs sessions [--range all] [--sort credits|requests|recent] [--limit 20] [--json]
//   node cli.mjs detail   --session <sessionId> [--json]
//   node cli.mjs panel    [--range 30d] [--out <file>] [--json]
//   node cli.mjs html     [--out <file>] [--open] [--json]

import { promises as fs } from "node:fs";
import path from "node:path";
import { refresh, loadIndexSafe } from "./service.mjs";
import {
  buildPanelPayload,
  filterRequests,
  groupBy,
  groupByDay,
  listSessions,
  sessionDetail,
  totals,
} from "./aggregate.mjs";
import { renderPanelHtml } from "./render-html.mjs";
import { formatTokens } from "./estimate.mjs";

function parseArgs(argv) {
  const args = { _: [], full: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--full") args.full = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--open") args.open = true;
    else if (arg === "--range") args.range = argv[++i];
    else if (arg === "--project") args.project = argv[++i];
    else if (arg === "--sort") args.sort = argv[++i];
    else if (arg === "--limit") args.limit = Number(argv[++i]);
    else if (arg === "--session") args.session = argv[++i];
    else if (arg === "--out") args.out = argv[++i];
    else args._.push(arg);
  }
  return args;
}

function fmtCredits(value) {
  const num = Number(value) || 0;
  return num >= 1 ? num.toFixed(3) : num.toFixed(4);
}

function emit(args, payload, humanLines) {
  if (args.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    for (const line of humanLines) process.stdout.write(`${line}\n`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] ?? "summary";

  if (command === "refresh") {
    const result = await refresh({ full: args.full });
    emit(
      args,
      result,
      [
        `扫描 ${result.scannedFiles} 个会话文件（解析 ${result.parsedFiles}，跳过 ${result.skippedFiles}）`,
        `新增请求记录 ${result.newRequests} 条，索引共 ${result.totalRequests} 条`,
        `读取 ${(result.bytesRead / 1024).toFixed(1)} KB，耗时 ${result.durationMs} ms`,
      ],
    );
    return;
  }

  if (command === "html") {
    await refresh({ full: false });
    const freshIndex = await loadIndexSafe();
    const payload = buildPanelPayload(freshIndex, { range: "30d" });
    const html = renderPanelHtml(payload);
    const outPath = path.resolve(args.out ?? "token-panel.html");
    await fs.writeFile(outPath, html, "utf8");
    const sizeKb = Math.round(Buffer.byteLength(html, "utf8") / 1024);
    if (args.open) {
      const { spawn } = await import("node:child_process");
      // cache-busted file URL: forces a fresh tab/load so already-open tabs
      // never keep showing a stale snapshot
      const fileUrl = `file:///${encodeURI(path.resolve(outPath).replace(/\\/g, "/"))}?t=${Date.now()}`;
      const [cmd, cmdArgs] =
        process.platform === "win32"
          ? ["cmd", ["/c", "start", "", fileUrl]]
          : process.platform === "darwin"
            ? ["open", [fileUrl]]
            : ["xdg-open", [fileUrl]];
      try {
        spawn(cmd, cmdArgs, { detached: true, stdio: "ignore" }).unref();
      } catch {
        // opening the browser is best-effort
      }
    }
    const openNote = args.open ? "已尝试用默认浏览器打开。" : "用浏览器打开即可查看。";
    emit(
      args,
      { out: outPath, sizeKb, generatedAt: payload.generatedAt, opened: Boolean(args.open) },
      [`面板已生成：${outPath}（${sizeKb} KB）`, `${openNote}重新运行本命令会覆盖此文件。`],
    );
    return;
  }

  const index = await loadIndexSafe();
  if (index.requests.length === 0) {
    const hint = "索引为空，请先运行：node cli.mjs refresh";
    emit(args, { error: hint }, [hint]);
    return;
  }

  if (command === "summary") {
    const records = filterRequests(index, { range: args.range ?? "all", project: args.project });
    const t = totals(index, records);
    emit(
      args,
      { range: args.range ?? "all", project: args.project ?? null, ...t },
      [
        `范围 ${args.range ?? "all"}${args.project ? ` · 项目 ${args.project}` : ""}`,
        `积分合计 ${fmtCredits(t.credits)}（计费请求 ${t.billedRequests}/${t.requests}）`,
        `会话 ${t.sessions} · 项目 ${t.projects}`,
        t.hasRecordedTokens
          ? `Token（记录值）in ${formatTokens(t.tokensInRecorded)} / out ${formatTokens(t.tokensOutRecorded)}`
          : `Token（估算）in ≈${formatTokens(t.tokensInEst)} / out ≈${formatTokens(t.tokensOutEst)}（本机 token 字段不可用，为本地估算）`,
        `最近活动 ${t.lastTs ?? "-"}`,
      ],
    );
    return;
  }

  if (command === "days") {
    const records = filterRequests(index, { range: args.range ?? "30d" });
    const days = groupByDay(index, records);
    emit(
      args,
      { range: args.range ?? "30d", days },
      days.map((d) => `${d.date}  积分 ${fmtCredits(d.credits)}  请求 ${d.requests}  会话 ${d.sessions}`),
    );
    return;
  }

  if (command === "projects" || command === "models") {
    const records = filterRequests(index, { range: args.range ?? "all" });
    const grouped = groupBy(index, records, command === "projects" ? "project" : "model");
    emit(
      args,
      grouped,
      grouped.map(
        (row) =>
          `${row.project ?? row.model}  积分 ${fmtCredits(row.credits)}  请求 ${row.requests}  会话 ${row.sessions}  Token≈ ${formatTokens(row.tokensInEst + row.tokensOutEst)}`,
      ),
    );
    return;
  }

  if (command === "sessions") {
    const records = filterRequests(index, { range: args.range ?? "all", project: args.project });
    const sessions = listSessions(index, records, {
      sort: args.sort ?? "credits",
      limit: args.limit ?? 20,
    });
    emit(
      args,
      sessions,
      sessions.map(
        (s) =>
          `${s.sessionId}  [${s.project}]  积分 ${fmtCredits(s.credits)}  请求 ${s.requests}  ${s.lastTs ?? ""}\n    ${s.promptPreview ?? ""}`,
      ),
    );
    return;
  }

  if (command === "detail") {
    if (!args.session) throw new Error("detail 需要 --session <sessionId>");
    const detail = sessionDetail(index, args.session);
    if (!detail) throw new Error(`未找到会话 ${args.session}`);
    const rows = detail.requests.map(
      (row) =>
        `${row.ts ?? "-"}  ${row.model}  积分 ${row.credits === null ? "-" : fmtCredits(row.credits)}  in≈${formatTokens(row.tokensInEst)}  out≈${formatTokens(row.tokensOutEst)}  ctx ${row.ctxRatio === null ? "-" : (row.ctxRatio * 100).toFixed(1) + "%"}  ${row.stopReason ?? ""}`,
    );
    emit(args, detail, [
      `会话 ${detail.sessionId} [${detail.project}] 模型 ${detail.model}`,
      `首条 ${detail.firstTs} · 末条 ${detail.lastTs}`,
      `提问：${detail.promptPreview ?? "-"}`,
      ...rows,
    ]);
    return;
  }

  if (command === "panel") {
    const payload = buildPanelPayload(index, { range: args.range ?? "30d" });
    if (args.out) {
      await fs.mkdir(path.dirname(path.resolve(args.out)), { recursive: true });
      await fs.writeFile(path.resolve(args.out), JSON.stringify(payload, null, 2), "utf8");
      emit(args, { out: path.resolve(args.out) }, [`面板数据已写入 ${path.resolve(args.out)}`]);
      return;
    }
    emit(
      args,
      payload,
      [
        `面板数据（range=${payload.range}）：KPI 积分 ${fmtCredits(payload.kpi.creditsTotal)}，会话 ${payload.kpi.sessions}，天数 ${payload.days.length}`,
        `加 --out <file> 可导出 JSON 查看。`,
      ],
    );
    return;
  }

  throw new Error(`未知命令：${command}`);
}

main().catch((error) => {
  process.stderr.write(`${String(error?.message ?? error)}\n`);
  process.exit(1);
});
