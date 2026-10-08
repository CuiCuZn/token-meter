// Canvas data bridge for the token dashboard.
// The Canvas host runs this script with QODER_CANVAS_DATA pointing at the
// canvas state file; we refresh the local usage index (incremental) and write
// the panel payload back into that state file. The .canvas.tsx reads the same
// key through useCanvasState.

import { promises as fs } from "node:fs";
import path from "node:path";
import { refresh, loadIndexSafe } from "../../../core/service.mjs";
import { buildPanelPayload } from "../../../core/aggregate.mjs";
import { cacheDir } from "../../../core/paths.mjs";

const dataPath = process.env.QODER_CANVAS_DATA || path.resolve("index.canvas.data.json");
const PANEL_KEY = "tokenmeter.panel.v1";

const existing = await readJson(dataPath);

let payload;
try {
  await refresh({ full: false });
  const index = await loadIndexSafe();
  payload = buildPanelPayload(index, { range: "30d" });
} catch (error) {
  payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    error: String(error?.message ?? error),
  };
}

existing[PANEL_KEY] = payload;
existing["tokenmeter.panel.status"] = {
  ok: !payload.error,
  updatedAt: payload.generatedAt,
};

await writeJsonAtomic(dataPath, existing);
await writeDebugCopy(payload).catch(() => {});

async function writeDebugCopy(data) {
  await fs.mkdir(cacheDir(), { recursive: true });
  await writeJsonAtomic(path.join(cacheDir(), "panel.json"), data);
}

async function readJson(file) {
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function writeJsonAtomic(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(tmp, file);
}
