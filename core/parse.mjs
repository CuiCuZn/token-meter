// Incremental session JSONL parser.
// A session file is append-only. The caller reads from the stored byte offset
// to EOF and hands the chunk to parseSessionChunk together with the previous
// per-file state; the returned state continues the rolling token accumulator.
//
// One API request is stored as a chain of assistant entries (thinking / text /
// tool_use fragments linked by parentUuid); only the last entry of the chain
// carries message.usage. A request record is created from that entry, with the
// output estimate summed over the whole chain and the input estimate snapshotted
// before the chain's first fragment.

import { estimateTokens, extractText } from "./estimate.mjs";

export function initialFileState() {
  return {
    offset: 0,
    ctxTokens: 0,
    pendingOut: 0,
    inputSnapshot: 0,
    lastAssistantUuid: null,
    lastPromptId: null,
    model: null,
    contextWindow: null,
    firstPromptPreview: null,
    lastPromptPreview: null,
    firstTs: null,
    lastTs: null,
    requests: 0,
  };
}

function positiveOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function isToolResultLine(record) {
  return Boolean(record.toolUseResult) || Boolean(record.sourceToolAssistantUUID);
}

export function parseSessionChunk(chunkText, prevState, fileMeta) {
  const state = { ...initialFileState(), ...prevState };
  const records = [];

  let consumed = 0;
  let lineStart = 0;
  while (lineStart < chunkText.length) {
    const newlineIndex = chunkText.indexOf("\n", lineStart);
    if (newlineIndex === -1) break;
    const rawLine = chunkText.slice(lineStart, newlineIndex);
    lineStart = newlineIndex + 1;
    consumed = lineStart;
    const line = rawLine.trim();
    if (!line) continue;

    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    try {
      processEntry(entry, state, records, fileMeta);
    } catch {
      // tolerate per-line schema drift
    }
  }

  state.offset = (prevState?.offset ?? 0) + consumed;
  return { records, state };
}

function processEntry(entry, state, records, fileMeta) {
  const type = entry.type;

  if (type === "runtime-config") {
    if (typeof entry.model === "string" && entry.model) state.model = entry.model;
    if (Number.isFinite(entry.contextWindow)) state.contextWindow = entry.contextWindow;
    return;
  }

  if (type !== "assistant" && type !== "user") return;

  const message = entry.message;
  if (!message || typeof message !== "object") return;

  const contentText = extractText(message.content);
  const contentTokens = estimateTokens(contentText);
  const ts = typeof entry.timestamp === "string" ? entry.timestamp : null;
  if (ts) {
    if (!state.firstTs) state.firstTs = ts;
    state.lastTs = ts;
  }

  if (type === "user") {
    if (typeof entry.promptId === "string" && entry.promptId) {
      state.lastPromptId = entry.promptId;
      const preview = contentText.replace(/\s+/g, " ").trim().slice(0, 160);
      if (preview) {
        if (!state.firstPromptPreview) state.firstPromptPreview = preview;
        state.lastPromptPreview = preview;
      }
    }
    if (!isToolResultLine(entry) || contentTokens > 0) {
      state.ctxTokens += contentTokens;
    }
    return;
  }

  // assistant fragment chain
  const continuesChain = entry.parentUuid && entry.parentUuid === state.lastAssistantUuid;
  if (!continuesChain) {
    state.pendingOut = 0;
    state.inputSnapshot = state.ctxTokens;
  }
  state.pendingOut += contentTokens;
  state.ctxTokens += contentTokens;
  state.lastAssistantUuid = entry.uuid ?? null;

  const usage = message.usage && typeof message.usage === "object" ? message.usage : null;
  if (!usage) return;

  const tokensIn = positiveOrNull(usage.input_tokens);
  const tokensOut = positiveOrNull(usage.output_tokens);
  const hasRecordedTokens = tokensIn !== null || tokensOut !== null;

  records.push({
    id: typeof entry.uuid === "string" ? entry.uuid : `${fileMeta.sessionId}:${state.offset}:${records.length}`,
    file: fileMeta.relPath,
    sessionId: fileMeta.sessionId,
    project: fileMeta.project,
    ts,
    model: (typeof message.model === "string" && message.model) || state.model || "unknown",
    credits: Number.isFinite(usage.credits) ? usage.credits : null,
    originalCredits: Number.isFinite(usage.original_credits) ? usage.original_credits : null,
    billable: usage.billable !== false,
    tokensIn: hasRecordedTokens ? tokensIn : null,
    tokensOut: hasRecordedTokens ? tokensOut : null,
    cacheRead: positiveOrNull(usage.cache_read_input_tokens),
    cacheCreate: positiveOrNull(usage.cache_creation_input_tokens),
    tokensInEst: state.inputSnapshot ?? state.ctxTokens - state.pendingOut,
    tokensOutEst: state.pendingOut,
    ctxRatio: Number.isFinite(usage.context_usage_ratio) ? usage.context_usage_ratio : null,
    stopReason: typeof message.stop_reason === "string" ? message.stop_reason : null,
    promptId: state.lastPromptId,
  });
  state.requests += 1;
  state.pendingOut = 0;
}
