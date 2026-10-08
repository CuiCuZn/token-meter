// High-level service: incremental refresh over all session files + index cache.

import { promises as fs } from "node:fs";
import { projectsDir } from "./paths.mjs";
import { scanSessionFiles } from "./scan.mjs";
import { initialFileState, parseSessionChunk } from "./parse.mjs";
import { loadIndex, saveIndex, recomputeCalibration, withIndexLock } from "./store.mjs";

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

    recomputeCalibration(index);
    await saveIndex(index);

    return {
      scannedFiles: files.length,
      parsedFiles,
      skippedFiles: files.length - parsedFiles,
      newRequests,
      totalRequests: index.requests.length,
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
