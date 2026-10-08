#!/usr/bin/env node
// token-meter MCP server (stdio, newline-delimited JSON-RPC 2.0).
// Exposes local Qoder CN session usage (credits + estimated tokens) as MCP tools.
// All data stays local; only the files under ~/.qoder-cn/projects are read.

import readline from "node:readline";
import { refresh, loadIndexSafe } from "../core/service.mjs";
import {
  filterRequests,
  groupBy,
  groupByDay,
  listSessions,
  sessionDetail,
  totals,
  buildPanelPayload,
} from "../core/aggregate.mjs";

const SERVER_INFO = { name: "token-meter", version: "0.1.0" };
const DEFAULT_PROTOCOL_VERSION = "2025-03-26";

const RANGE_SCHEMA = {
  type: "string",
  enum: ["today", "7d", "30d", "all"],
  description: "Time range relative to today (local time). Default: 30d for summaries, all for rankings.",
};

const TOOLS = [
  {
    name: "usage_summary",
    description:
      "Qoder CN local usage summary: credits, request count, sessions, and estimated tokens for a time range. Data comes from local session transcripts; tokens are estimates unless recorded values exist.",
    inputSchema: {
      type: "object",
      properties: {
        range: RANGE_SCHEMA,
        project: { type: "string", description: "Optional project slug filter (see usage_by_project)." },
      },
    },
  },
  {
    name: "usage_by_day",
    description: "Daily credits, request count, and session count for charting a trend.",
    inputSchema: {
      type: "object",
      properties: { range: RANGE_SCHEMA, project: { type: "string" } },
    },
  },
  {
    name: "usage_by_project",
    description: "Per-project usage ranking (credits, requests, sessions, estimated tokens).",
    inputSchema: {
      type: "object",
      properties: { range: RANGE_SCHEMA },
    },
  },
  {
    name: "usage_sessions",
    description: "List sessions with per-session aggregates, sorted by credits / requests / recent.",
    inputSchema: {
      type: "object",
      properties: {
        range: RANGE_SCHEMA,
        project: { type: "string" },
        sort: { type: "string", enum: ["credits", "requests", "recent"], description: "Default: credits." },
        limit: { type: "number", description: "Default: 20." },
      },
    },
  },
  {
    name: "usage_session_detail",
    description: "Per-request detail for one session: timestamp, model, credits, tokens, context ratio, stop reason.",
    inputSchema: {
      type: "object",
      properties: { sessionId: { type: "string", description: "Session id (jsonl file name without extension)." } },
      required: ["sessionId"],
    },
  },
  {
    name: "usage_refresh",
    description:
      "Incrementally re-scan local session files and update the usage index. Use before answering when the user needs up-to-date numbers.",
    inputSchema: {
      type: "object",
      properties: { full: { type: "boolean", description: "Rebuild the index from scratch (default false)." } },
    },
  },
  {
    name: "usage_panel_data",
    description: "Ready-to-render panel payload (KPI + day trend + project/model breakdown + session list and details) for the token dashboard canvas.",
    inputSchema: {
      type: "object",
      properties: { range: { ...RANGE_SCHEMA, description: "Panel range. Default: 30d." } },
    },
  },
];

async function callTool(name, args = {}) {
  if (name === "usage_refresh") {
    return refresh({ full: args.full === true });
  }
  if (name === "usage_session_detail") {
    if (!args.sessionId) throw new Error("sessionId is required");
    const index = await loadIndexSafe();
    const detail = sessionDetail(index, String(args.sessionId));
    if (!detail) throw new Error(`session not found: ${args.sessionId}`);
    return detail;
  }
  const index = await loadIndexSafe();
  if (index.requests.length === 0) {
    const result = await refresh({ full: false });
    if (result.totalRequests === 0) {
      return { warning: "no sessions found under ~/.qoder-cn/projects", hint: "run usage_refresh after chatting with Qoder CN" };
    }
    return callTool(name, args);
  }
  const range = args.range ?? (name === "usage_summary" || name === "usage_panel_data" ? "30d" : "all");
  const records = filterRequests(index, { range, project: args.project ?? null });

  if (name === "usage_summary") {
    const t = totals(index, records);
    return { range, project: args.project ?? null, calibration: index.calibration, ...t };
  }
  if (name === "usage_by_day") {
    return { range, days: groupByDay(index, records) };
  }
  if (name === "usage_by_project") {
    return { range, projects: groupBy(index, records, "project") };
  }
  if (name === "usage_sessions") {
    return {
      range,
      sessions: listSessions(index, records, {
        sort: args.sort === "requests" || args.sort === "recent" ? args.sort : "credits",
        limit: Number.isFinite(args.limit) ? Math.max(1, Math.min(200, args.limit)) : 20,
      }),
    };
  }
  if (name === "usage_panel_data") {
    return buildPanelPayload(index, { range });
  }
  throw new Error(`unknown tool: ${name}`);
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function reply(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function replyError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

async function handleMessage(message) {
  const { id, method, params } = message;
  const isNotification = id === undefined || id === null;

  try {
    if (method === "initialize") {
      reply(id, {
        protocolVersion: params?.protocolVersion ?? DEFAULT_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions:
          "Local Qoder CN usage statistics from session transcripts. Credits are recorded values; tokens are estimates unless recorded values exist. All parsing is local.",
      });
      return;
    }
    if (method === "notifications/initialized" || method === "notifications/cancelled") return;
    if (method === "ping") {
      reply(id, {});
      return;
    }
    if (method === "tools/list") {
      reply(id, { tools: TOOLS });
      return;
    }
    if (method === "tools/call") {
      const name = params?.name;
      const args = params?.arguments ?? {};
      try {
        const result = await callTool(name, args);
        reply(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        });
      } catch (error) {
        reply(id, {
          content: [{ type: "text", text: `Error: ${String(error?.message ?? error)}` }],
          isError: true,
        });
      }
      return;
    }
    if (!isNotification) replyError(id, -32601, `method not found: ${method}`);
  } catch (error) {
    if (!isNotification) replyError(id, -32603, String(error?.message ?? error));
  }
}

const reader = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
let queue = Promise.resolve();
reader.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    return;
  }
  queue = queue.then(() => handleMessage(message)).catch((error) => {
    process.stderr.write(`token-meter: ${String(error?.stack ?? error)}\n`);
  });
});
reader.on("close", () => {
  // drain in-flight tool calls before the process exits naturally
  queue.then(
    () => {
      process.exitCode = 0;
    },
    () => {
      process.exitCode = 1;
    },
  );
});
