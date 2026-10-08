// Model display-name resolution.
// Qoder CN caches the model catalog with human-readable labels locally; we read
// it at runtime so new models map automatically. Falls back to a small static
// map, then to the internal key.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const APP_ID = "com.qodercn.app.stable";

const STATIC_FALLBACK = new Map([
  ["dfmodel", "DeepSeek-V4-Flash"],
  ["dmodel", "DeepSeek-V4-Pro"],
  ["gfmodel", "GLM-5.3-Flash"],
  ["gm51model", "GLM-5.2"],
  ["gmodel", "GLM-5.3"],
  ["kmodel_latest", "Kimi-K3"],
  ["kmodel", "Kimi-K2.7-Code"],
  ["mmodel", "MiniMax-M3"],
  ["qfmodel", "Qwen3.8-Flash"],
  ["qmodel_38max", "Qwen3.8-Max"],
  ["qmodel_latest", "Qwen3.7-Max"],
  ["qmodel", "Qwen3.7-Plus"],
]);

let labelCache = null;

function candidateFiles() {
  const files = [];
  if (process.platform === "win32" && process.env.APPDATA) {
    files.push(path.join(process.env.APPDATA, APP_ID, "dynamic-text", "qoder.v1.json"));
  } else if (process.platform === "darwin") {
    files.push(path.join(os.homedir(), "Library", "Application Support", APP_ID, "dynamic-text", "qoder.v1.json"));
  } else {
    files.push(path.join(os.homedir(), ".config", APP_ID, "dynamic-text", "qoder.v1.json"));
  }
  const qoderHome = process.env.QODER_HOME || path.join(os.homedir(), ".qoder-cn");
  files.push(path.join(qoderHome, ".auth", "dynamic-texts.json"));
  return files;
}

export function loadModelLabels() {
  if (labelCache) return labelCache;
  const labels = {};
  for (const file of candidateFiles()) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      const zh = parsed?.data?.zh;
      if (zh && typeof zh === "object") {
        for (const key of Object.keys(zh)) {
          const match = key.match(/^model\.([a-z0-9_]+)\.label$/i);
          if (match && typeof zh[key] === "string" && zh[key]) labels[match[1]] = zh[key];
        }
      }
      for (const key of Object.keys(parsed ?? {})) {
        const match = key.match(/^modelSelector\.item\.([a-z0-9_]+)$/i);
        if (match && typeof parsed[key] === "string" && parsed[key]) labels[match[1]] = parsed[key];
      }
      if (Object.keys(labels).length > 0) break;
    } catch {
      // try next candidate
    }
  }
  labelCache = labels;
  return labels;
}

export function resolveModelName(internal) {
  if (!internal) return "unknown";
  const labels = loadModelLabels();
  if (labels[internal]) return labels[internal];
  if (STATIC_FALLBACK.has(internal)) return STATIC_FALLBACK.get(internal);
  return internal;
}
