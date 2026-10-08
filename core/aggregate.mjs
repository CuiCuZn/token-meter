// Aggregations over request records. All functions take the loaded index.

import { applyCalibrationFactor } from "./estimate.mjs";
import { resolveModelName } from "./models.mjs";

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseRange(range) {
  const now = new Date();
  if (!range || range === "all") return { label: "all", since: null, until: null };
  if (range === "today") return { label: "today", since: startOfDay(now).getTime(), until: null };
  if (range === "7d") return { label: "7d", since: startOfDay(new Date(now.getTime() - 6 * DAY_MS)).getTime(), until: null };
  if (range === "30d") return { label: "30d", since: startOfDay(new Date(now.getTime() - 29 * DAY_MS)).getTime(), until: null };
  if (typeof range === "object") {
    return {
      label: "custom",
      since: range.since ? new Date(range.since).getTime() : null,
      until: range.until ? new Date(range.until).getTime() : null,
    };
  }
  return { label: "all", since: null, until: null };
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function localDayKey(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function inRange(iso, range) {
  if (!range.since && !range.until) return true;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return false;
  if (range.since !== null && time < range.since) return false;
  if (range.until !== null && time > range.until) return false;
  return true;
}

function factorFor(index, model, direction) {
  const cal = index.calibration?.[model];
  return applyCalibrationFactor(cal?.[direction] ?? 1);
}

export function calibratedEstimate(index, record) {
  return {
    tokensInEst: Math.round(record.tokensInEst * factorFor(index, record.model, "in")),
    tokensOutEst: Math.round(record.tokensOutEst * factorFor(index, record.model, "out")),
  };
}

export function filterRequests(index, { range = "all", project = null } = {}) {
  const parsed = typeof range === "object" ? parseRange(range) : parseRange(range);
  return index.requests.filter((rec) => {
    if (project && rec.project !== project) return false;
    if (rec.ts && !inRange(rec.ts, parsed)) return false;
    return Boolean(rec.ts) || parsed.label === "all";
  });
}

export function totals(index, records) {
  const out = {
    requests: 0,
    billedRequests: 0,
    credits: 0,
    sessions: new Set(),
    projects: new Set(),
    tokensInEst: 0,
    tokensOutEst: 0,
    tokensInRecorded: 0,
    tokensOutRecorded: 0,
    hasRecordedTokens: false,
    lastTs: null,
  };
  for (const rec of records) {
    out.requests += 1;
    if (rec.credits !== null) {
      out.billedRequests += 1;
      out.credits += rec.credits;
    }
    out.sessions.add(rec.sessionId);
    out.projects.add(rec.project);
    const est = calibratedEstimate(index, rec);
    out.tokensInEst += est.tokensInEst;
    out.tokensOutEst += est.tokensOutEst;
    if (rec.tokensIn !== null || rec.tokensOut !== null) {
      out.hasRecordedTokens = true;
      out.tokensInRecorded += rec.tokensIn ?? 0;
      out.tokensOutRecorded += rec.tokensOut ?? 0;
    }
    if (rec.ts && (!out.lastTs || rec.ts > out.lastTs)) out.lastTs = rec.ts;
  }
  out.sessions = out.sessions.size;
  out.projects = out.projects.size;
  return out;
}

export function groupByDay(index, records) {
  const buckets = new Map();
  for (const rec of records) {
    const key = localDayKey(rec.ts);
    if (!key) continue;
    const bucket = buckets.get(key) || {
      date: key,
      credits: 0,
      requests: 0,
      sessions: new Set(),
      tokensInEst: 0,
      tokensOutEst: 0,
    };
    bucket.credits += rec.credits ?? 0;
    bucket.requests += 1;
    bucket.sessions.add(rec.sessionId);
    const est = calibratedEstimate(index, rec);
    bucket.tokensInEst += est.tokensInEst;
    bucket.tokensOutEst += est.tokensOutEst;
    buckets.set(key, bucket);
  }
  return [...buckets.values()]
    .map((bucket) => ({ ...bucket, sessions: bucket.sessions.size }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function groupBy(index, records, keyName) {
  const buckets = new Map();
  for (const rec of records) {
    const key = keyName === "model" ? resolveModelName(rec.model) : (rec[keyName] ?? "unknown");
    const bucket = buckets.get(key) || { [keyName]: key, credits: 0, requests: 0, sessions: new Set(), tokensInEst: 0, tokensOutEst: 0 };
    bucket.credits += rec.credits ?? 0;
    bucket.requests += 1;
    bucket.sessions.add(rec.sessionId);
    const est = calibratedEstimate(index, rec);
    bucket.tokensInEst += est.tokensInEst;
    bucket.tokensOutEst += est.tokensOutEst;
    buckets.set(key, bucket);
  }
  const out = [...buckets.values()].map((bucket) => ({ ...bucket, sessions: bucket.sessions.size }));
  out.sort((a, b) => b.credits - a.credits || b.requests - a.requests);
  return out;
}

export function listSessions(index, records, { sort = "credits", limit = 100 } = {}) {
  const buckets = new Map();
  for (const rec of records) {
    const bucket = buckets.get(rec.sessionId) || {
      sessionId: rec.sessionId,
      project: rec.project,
      credits: 0,
      requests: 0,
      tokensInEst: 0,
      tokensOutEst: 0,
      models: new Set(),
      firstTs: null,
      lastTs: null,
    };
    bucket.credits += rec.credits ?? 0;
    bucket.requests += 1;
    const est = calibratedEstimate(index, rec);
    bucket.tokensInEst += est.tokensInEst;
    bucket.tokensOutEst += est.tokensOutEst;
    bucket.models.add(resolveModelName(rec.model));
    if (rec.ts) {
      if (!bucket.firstTs || rec.ts < bucket.firstTs) bucket.firstTs = rec.ts;
      if (!bucket.lastTs || rec.ts > bucket.lastTs) bucket.lastTs = rec.ts;
    }
    buckets.set(rec.sessionId, bucket);
  }
  const out = [...buckets.values()].map((bucket) => {
    const meta = index.files[`${bucket.project}/${bucket.sessionId}.jsonl`];
    return {
      ...bucket,
      models: [...bucket.models],
      promptPreview: meta?.firstPromptPreview ?? null,
    };
  });
  const comparators = {
    credits: (a, b) => b.credits - a.credits,
    requests: (a, b) => b.requests - a.requests,
    tokens: (a, b) => b.tokensInEst + b.tokensOutEst - (a.tokensInEst + a.tokensOutEst),
    recent: (a, b) => String(b.lastTs).localeCompare(String(a.lastTs)),
  };
  out.sort(comparators[sort] ?? comparators.credits);
  return out.slice(0, limit);
}

export function sessionDetail(index, sessionId) {
  const records = index.requests
    .filter((rec) => rec.sessionId === sessionId)
    .sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  if (records.length === 0) return null;
  const meta = index.files[`${records[0].project}/${sessionId}.jsonl`] ?? null;
  const displayModel = resolveModelName(meta?.model ?? records[0].model);
  return {
    sessionId,
    project: records[0].project,
    model: displayModel,
    contextWindow: meta?.contextWindow ?? null,
    firstTs: records[0].ts,
    lastTs: records[records.length - 1].ts,
    promptPreview: meta?.firstPromptPreview ?? null,
    requests: records.map((rec) => {
      const est = calibratedEstimate(index, rec);
      return {
        ts: rec.ts,
        model: resolveModelName(rec.model),
        credits: rec.credits,
        tokensIn: rec.tokensIn,
        tokensOut: rec.tokensOut,
        tokensInEst: est.tokensInEst,
        tokensOutEst: est.tokensOutEst,
        ctxRatio: rec.ctxRatio,
        stopReason: rec.stopReason,
      };
    }),
  };
}

function scopesTotals(index) {
  const scopes = {};
  for (const key of ["today", "7d", "30d", "all"]) {
    const t = totals(index, filterRequests(index, { range: key }));
    scopes[key] = {
      credits: t.credits,
      requests: t.requests,
      sessions: t.sessions,
      projects: t.projects,
      tokensInEst: t.tokensInEst,
      tokensOutEst: t.tokensOutEst,
      tokensTotalEst: t.tokensInEst + t.tokensOutEst,
      hasRecordedTokens: t.hasRecordedTokens,
      tokensInRecorded: t.tokensInRecorded,
      tokensOutRecorded: t.tokensOutRecorded,
    };
  }
  return scopes;
}

export function buildPanelPayload(index, { range = "30d", sessionLimit = 60, detailLimit = 30 } = {}) {
  const records = filterRequests(index, { range });
  const kpi = totals(index, records);
  const todayRecords = filterRequests(index, { range: "today" });
  const todayCredits = totals(index, todayRecords).credits;
  const days = groupByDay(index, filterRequests(index, { range: "30d" }));
  const projects = groupBy(index, records, "project").slice(0, 12);
  const models = groupBy(index, records, "model").slice(0, 12);
  const sessions = listSessions(index, records, { sort: "credits", limit: sessionLimit });
  const details = {};
  for (const session of sessions.slice(0, detailLimit)) {
    const detail = sessionDetail(index, session.sessionId);
    if (detail) {
      details[session.sessionId] = detail.requests.map((row) => ({
        ts: row.ts,
        model: row.model,
        credits: row.credits,
        tokensIn: row.tokensIn,
        tokensOut: row.tokensOut,
        tokensInEst: row.tokensInEst,
        tokensOutEst: row.tokensOutEst,
        ctxRatio: row.ctxRatio,
        stopReason: row.stopReason,
      }));
    }
  }
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    range,
    scopes: scopesTotals(index),
    kpi: {
      creditsToday: todayCredits,
      creditsTotal: kpi.credits,
      requests: kpi.requests,
      sessions: kpi.sessions,
      projects: kpi.projects,
      tokensInEst: kpi.tokensInEst,
      tokensOutEst: kpi.tokensOutEst,
      hasRecordedTokens: kpi.hasRecordedTokens,
      tokensInRecorded: kpi.tokensInRecorded,
      tokensOutRecorded: kpi.tokensOutRecorded,
      lastTs: kpi.lastTs,
    },
    days,
    projects,
    models,
    sessions,
    details,
  };
}
