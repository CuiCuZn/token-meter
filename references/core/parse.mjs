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
    openTurn: null,
    chainTs: null,
    chainModel: null,
    chainStopReason: null,
    chainTurnId: null,
    chainEmitted: false,
  };
}

function normalizeTs(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

// New Qoder versions (0.5.12+) drop `message.usage` from transcripts; per-request
// estimates are rebuilt from content instead. One assistant fragment chain still
// equals one model request (verified against the app database's turnCount), so
// the chain is finalized at its end and carries inputSnapshot/pendingOut exactly
// like a usage-backed record would. Skipped when a usage record was already
// emitted for the chain (old-format files).
function finalizeChain(state, records, fileMeta) {
  if (state.chainEmitted) return;
  if (!state.pendingOut || state.pendingOut <= 0) return;
  if (!state.chainTs) return;
  records.push({
    id: `chain:${fileMeta.sessionId}:${state.chainTs}`,
    file: fileMeta.relPath,
    sessionId: fileMeta.sessionId,
    project: fileMeta.project,
    ts: state.chainTs,
    model: state.chainModel || state.model || "unknown",
    credits: null,
    originalCredits: null,
    billable: false,
    tokensIn: null,
    tokensOut: null,
    cacheRead: null,
    cacheCreate: null,
    tokensInEst: state.inputSnapshot ?? 0,
    tokensOutEst: state.pendingOut,
    ctxRatio: null,
    stopReason: state.chainStopReason ?? null,
    promptId: state.lastPromptId,
    turnId: state.chainTurnId ?? null,
  });
  state.chainEmitted = true;
  state.pendingOut = 0;
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
  const ts = normalizeTs(entry.timestamp);
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
    finalizeChain(state, records, fileMeta);
    const turnId = typeof entry.requestSetId === "string" ? entry.requestSetId : null;
    if (turnId && !isToolResultLine(entry) && state.openTurn?.turnId !== turnId) {
      const turnModel = (typeof entry.businessModelKey === "string" && entry.businessModelKey) || state.model || null;
      state.openTurn = { turnId, model: turnModel };
    }
    if (!isToolResultLine(entry) || contentTokens > 0) {
      state.ctxTokens += contentTokens;
    }
    return;
  }

  // assistant fragment chain
  const continuesChain = entry.parentUuid && entry.parentUuid === state.lastAssistantUuid;
  if (!continuesChain) {
    finalizeChain(state, records, fileMeta);
    state.pendingOut = 0;
    state.inputSnapshot = state.ctxTokens;
    state.chainEmitted = false;
    state.chainTurnId = state.openTurn ? state.openTurn.turnId : null;
    state.chainModel = state.openTurn?.model || state.model || null;
    state.chainStopReason = null;
  }
  state.pendingOut += contentTokens;
  state.ctxTokens += contentTokens;
  state.lastAssistantUuid = entry.uuid ?? null;
  state.chainTs = ts;
  // Newer versions write a placeholder "auto" in message.model; the resolved
  // model key lives on user entries (businessModelKey) and runtime config.
  if (typeof message.model === "string" && message.model && message.model.toLowerCase() !== "auto") {
    state.chainModel = message.model;
  }
  state.chainStopReason = typeof message.stop_reason === "string" ? message.stop_reason : null;

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
  state.chainEmitted = true;
  state.pendingOut = 0;
}
