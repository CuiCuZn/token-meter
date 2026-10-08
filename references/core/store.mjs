import { promises as fs } from "node:fs";
import path from "node:path";
import { cacheDir, indexFile, lockFile } from "./paths.mjs";

const INDEX_VERSION = 1;
const LOCK_STALE_MS = 15000;
const LOCK_RETRY_MS = 120;
const LOCK_TIMEOUT_MS = 6000;

export function emptyIndex() {
  return {
    version: INDEX_VERSION,
    updatedAt: null,
    calibration: {},
    files: {},
    requests: [],
  };
}

export async function loadIndex() {
  try {
    const raw = await fs.readFile(indexFile(), "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || parsed.version !== INDEX_VERSION) {
      return emptyIndex();
    }
    parsed.files = parsed.files && typeof parsed.files === "object" ? parsed.files : {};
    parsed.calibration = parsed.calibration && typeof parsed.calibration === "object" ? parsed.calibration : {};
    parsed.requests = Array.isArray(parsed.requests) ? parsed.requests : [];
    return parsed;
  } catch {
    return emptyIndex();
  }
}

export async function saveIndex(index) {
  index.updatedAt = new Date().toISOString();
  await fs.mkdir(cacheDir(), { recursive: true });
  const tmp = path.join(cacheDir(), `index.json.tmp-${process.pid}-${Date.now()}`);
  await fs.writeFile(tmp, `${JSON.stringify(index)}\n`, "utf8");
  await fs.rename(tmp, indexFile());
}

export async function withIndexLock(fn) {
  await fs.mkdir(cacheDir(), { recursive: true });
  const started = Date.now();
  let handle = null;
  while (!handle) {
    try {
      handle = await fs.open(lockFile(), "wx");
    } catch {
      try {
        const stat = await fs.stat(lockFile());
        if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
          await fs.rm(lockFile(), { force: true });
          continue;
        }
      } catch {
        continue;
      }
      if (Date.now() - started > LOCK_TIMEOUT_MS) {
        throw new Error("token-meter: index lock timeout");
      }
      await sleep(LOCK_RETRY_MS);
    }
  }
  try {
    return await fn();
  } finally {
    try {
      await handle.close();
    } finally {
      await fs.rm(lockFile(), { force: true }).catch(() => {});
    }
  }
}

export function recomputeCalibration(index) {
  const sums = new Map();
  for (const rec of index.requests) {
    if (rec.tokensIn === null && rec.tokensOut === null) continue;
    const bucket = sums.get(rec.model) || { recIn: 0, estIn: 0, recOut: 0, estOut: 0 };
    if (rec.tokensIn !== null && rec.tokensInEst > 0) {
      bucket.recIn += rec.tokensIn;
      bucket.estIn += rec.tokensInEst;
    }
    if (rec.tokensOut !== null && rec.tokensOutEst > 0) {
      bucket.recOut += rec.tokensOut;
      bucket.estOut += rec.tokensOutEst;
    }
    sums.set(rec.model, bucket);
  }
  const calibration = {};
  for (const [model, bucket] of sums) {
    const factorIn = bucket.estIn >= 2000 && bucket.recIn > 0 ? bucket.recIn / bucket.estIn : null;
    const factorOut = bucket.estOut >= 500 && bucket.recOut > 0 ? bucket.recOut / bucket.estOut : null;
    if (factorIn !== null || factorOut !== null) {
      calibration[model] = { in: factorIn, out: factorOut };
    }
  }
  index.calibration = calibration;
  return calibration;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
