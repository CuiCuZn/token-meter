import { promises as fs } from "node:fs";
import path from "node:path";

const MAX_DEPTH = 4;
const SKIP_DIRS = new Set(["node_modules", ".git", "canvases", "memory"]);

export async function scanSessionFiles(rootDir) {
  const results = [];
  await walk(rootDir, rootDir, 0, results);
  results.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return results;
}

async function walk(rootDir, dir, depth, results) {
  if (depth > MAX_DEPTH) return;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (depth === 0 || !SKIP_DIRS.has(entry.name)) {
        await walk(rootDir, fullPath, depth + 1, results);
      }
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
    let stat;
    try {
      stat = await fs.stat(fullPath);
    } catch {
      continue;
    }
    const relPath = path.relative(rootDir, fullPath).split(path.sep).join("/");
    const parts = relPath.split("/");
    results.push({
      path: fullPath,
      relPath,
      project: parts.length > 1 ? parts[0] : "unknown",
      sessionId: entry.name.replace(/\.jsonl$/i, ""),
      size: stat.size,
      mtimeMs: stat.mtimeMs,
    });
  }
}
