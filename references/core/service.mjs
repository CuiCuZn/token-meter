// High-level service: incremental refresh over all session files + index cache.

import { promises as fs } from "node:fs";
import { projectsDir } from "./paths.mjs";
import { scanSessionFiles } from "./scan.mjs";
import { initialFileState, parseSessionChunk } from "./parse.mjs";
import { loadIndex, saveIndex, recomputeCalibration, withIndexLock } from "./store.mjs";
import { loadTurnCredits } from "./usage-db.mjs";

function projectSlugFromCwd(cwd) {
  if (!cwd) return null;
  const slug = String(cwd).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || null;
}

// Attach per-turn credits from the app database to the transcript-derived
// request records. One turn spans several request chains; the turn's credit
// value goes on the LAST request of that turn (so totals sum correctly), and
// all other chains of the turn stay credit-free. A standalone fallback record
// is created only when the transcript has no chain for that turn yet.
function mergeTurnCredits(index, turns) {
  const metaBySession = new Map();
  for (const [relPath, meta] of Object.entries(index.files)) {
    if (meta?.sessionId) metaBySession.set(meta.sessionId, { relPath, meta });
  }
  const recordsByTurn = new Map();
  for (const rec of index.requests) {
    if (!rec.turnId) continue;
    const list = recordsByTurn.get(rec.turnId) || [];
    list.push(rec);
    recordsByTurn.set(rec.turnId, list);
  }
  let newTurnRecords = 0;
  const staleFallbacks = [];
  for (const turn of turns) {
    if (!turn.sessionId || !turn.turnId || !Number.isFinite(turn.createdAt)) continue;
    const ts = new Date(turn.createdAt).toISOString();
    const credits = Number.isFinite(turn.credits) ? Math.round(turn.credits * 10000) / 10000 : null;
    let list = recordsByTurn.get(turn.turnId);
    if (!list) {
      list = [];
      recordsByTurn.set(turn.turnId, list);
    }
    for (const rec of list) {
      rec.credits = null;
      rec.originalCredits = null;
      rec.billable = false;
    }
    const chainRecords = list.filter((rec) => !rec.fallbackTurn && rec.sessionId === turn.sessionId);
    if (chainRecords.length > 0) {
      for (const rec of list) {
        if (rec.fallbackTurn) staleFallbacks.push(rec);
      }
      const target = chainRecords.reduce((a, b) => (String(b.ts) >= String(a.ts) ? b : a));
      target.credits = credits;
      target.originalCredits = credits;
      target.billable = true;
      continue;
    }
    const known = metaBySession.get(turn.sessionId);
    const project = known?.meta.slug ?? projectSlugFromCwd(turn.cwd) ?? "unknown";
    const sessionModel = known?.meta.model
      || (turn.sessionModel && turn.sessionModel !== "auto" ? turn.sessionModel : null);
    const record = {
      id: `turn:${turn.sessionId}:${turn.turnId}`,
      file: known?.relPath ?? null,
      sessionId: turn.sessionId,
      project,
      ts,
      model: sessionModel || "unknown",
      credits,
      originalCredits: credits,
      billable: true,
      tokensIn: null,
      tokensOut: null,
      cacheRead: null,
      cacheCreate: null,
      tokensInEst: 0,
      tokensOutEst: 0,
      ctxRatio: null,
      stopReason: null,
      promptId: turn.turnId,
      turnId: turn.turnId,
      fallbackTurn: true,
    };
    index.requests.push(record);
    list.push(record);
    newTurnRecords += 1;
  }
  if (staleFallbacks.length > 0) {
    const stale = new Set(staleFallbacks);
    index.requests = index.requests.filter((rec) => !stale.has(rec));
  }
  return newTurnRecords;
}

export async function refresh({ full = false } = {}) {
  return withIndexLock(async () => {
    const startedAt = Date.now();
    const files = await scanSessionFiles(projectsDir());
    const index = await loadIndex();
    if (full) {
      index.requests = [];
      index.files = {};
    }
    let parsedFiles = 0;
    let newRequests = 0;
    let bytesRead = 0;
    let parseErrors = 0;

    const seen = new Set();
    for (const file of files) {
      seen.add(file.relPath);
      const prev = index.files[file.relPath];
      const unchanged = !full && prev && prev.size === file.size && prev.mtimeMs === file.mtimeMs;
      if (unchanged) continue;

      let startOffset = full || !prev ? 0 : prev.offset;
      let state = full || !prev ? initialFileState() : prev;
      if (prev && file.size < prev.offset) {
        // file was rewritten/rotated: reparse from scratch, drop stale records
        startOffset = 0;
        state = initialFileState();
        index.requests = index.requests.filter((rec) => rec.file !== file.relPath);
      }

      let handle;
      try {
        handle = await fs.open(file.path, "r");
        const length = file.size - startOffset;
        if (length > 0) {
          const buffer = Buffer.alloc(length);
          const { bytesRead: read } = await handle.read(buffer, 0, length, startOffset);
          bytesRead += read;
          const chunk = buffer.subarray(0, read).toString("utf8");
          const result = parseSessionChunk(chunk, state, file);
          index.requests.push(...result.records);
          newRequests += result.records.length;
          state = result.state;
        }
      } catch (error) {
        parseErrors += 1;
        continue;
      } finally {
        await handle?.close().catch(() => {});
      }

      index.files[file.relPath] = {
        ...state,
        slug: file.project,
        sessionId: file.sessionId,
        size: file.size,
        mtimeMs: file.mtimeMs,
      };
      parsedFiles += 1;
    }

    for (const relPath of Object.keys(index.files)) {
      if (!seen.has(relPath)) {
        delete index.files[relPath];
        index.requests = index.requests.filter((rec) => rec.file !== relPath);
      }
    }

    let dbTurns = 0;
    let newTurnRecords = 0;
    try {
      const turns = await loadTurnCredits();
      dbTurns = turns.length;
      if (turns.length > 0) newTurnRecords = mergeTurnCredits(index, turns);
    } catch {
      // transcript-only mode remains valid if the app database is unreadable
    }

    recomputeCalibration(index);
    await saveIndex(index);

    return {
      scannedFiles: files.length,
      parsedFiles,
      skippedFiles: files.length - parsedFiles,
      newRequests,
      totalRequests: index.requests.length,
      dbTurns,
      newTurnRecords,
      turnRecords: index.requests.filter((rec) => rec.turnId).length,
      bytesRead,
      parseErrors,
      durationMs: Date.now() - startedAt,
      updatedAt: index.updatedAt,
    };
  });
}

export async function loadIndexSafe() {
  return loadIndex();
}
