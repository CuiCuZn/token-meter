// Heuristic token estimation, zero dependencies.
// ASCII ~ 4 chars/token, CJK ~ 1.6 chars/token. Calibration factors learned
// from recorded usage (when a Qoder version provides real token counts) are
// applied later, at aggregation time.

const CJK_RE = /[\u2e80-\u2eff\u3000-\u303f\u3040-\u30ff\u31c0-\u31ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef\uac00-\ud7af]/;

export function estimateTokens(text) {
  if (!text) return 0;
  let cjk = 0;
  let ascii = 0;
  for (const char of text) {
    if (CJK_RE.test(char)) cjk += 1;
    else ascii += 1;
  }
  const tokens = ascii / 4 + cjk / 1.6;
  return Math.max(tokens > 0 ? 1 : 0, Math.round(tokens));
}

function collectText(content, parts) {
  if (content == null) return;
  if (typeof content === "string") {
    parts.push(content);
    return;
  }
  if (Array.isArray(content)) {
    for (const block of content) collectText(block, parts);
    return;
  }
  if (typeof content !== "object") return;
  if (typeof content.text === "string") parts.push(content.text);
  if (typeof content.thinking === "string") parts.push(content.thinking);
  if (content.input !== undefined) {
    try {
      parts.push(JSON.stringify(content.input));
    } catch {
      // ignore unserializable tool input
    }
  }
  if (content.type === "tool_result" && content.content !== undefined) {
    collectText(content.content, parts);
  }
  if (Array.isArray(content.content) && content.type !== "tool_result") {
    collectText(content.content, parts);
  }
}

export function extractText(content) {
  const parts = [];
  collectText(content, parts);
  return parts.join("\n");
}

export function applyCalibrationFactor(factor) {
  const value = Number(factor);
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(2, Math.max(0.5, value));
}

export function formatTokens(value) {
  const num = Number(value) || 0;
  if (num >= 1e8) return `${(num / 1e8).toFixed(2)}亿`;
  if (num >= 1e4) {
    const wan = num / 1e4;
    return `${wan >= 100 ? wan.toFixed(0) : wan.toFixed(1)}万`;
  }
  return String(Math.round(num));
}
