// Turn-credit adapter for Qoder CN app database.
//
// Qoder 0.5.12+ (2026-11-13) stopped writing `message.usage` into session
// transcripts. Actual charged credits per turn now live in the desktop app's
// local database (`chat_session_messages.turn_credits`). We read it read-only
// through Node's built-in sqlite (Node 22.5+); any failure degrades to an
// empty result so older environments keep working from transcripts alone.

import os from "node:os";
import path from "node:path";

const APP_ID = "com.qodercn.app.stable";

function databaseFile() {
  if (process.platform === "win32" && process.env.APPDATA) {
    return path.join(process.env.APPDATA, APP_ID, "main.sqlite");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", APP_ID, "main.sqlite");
  }
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(configHome, APP_ID, "main.sqlite");
}

let databaseModule;

async function loadDatabaseClass() {
  if (databaseModule !== undefined) return databaseModule;
  try {
    // node:sqlite emits an ExperimentalWarning on import; keep CLI output clean
    const originalEmitWarning = process.emitWarning;
    process.emitWarning = () => {};
    try {
      const sqlite = await import("node:sqlite");
      databaseModule = sqlite.DatabaseSync ?? null;
    } finally {
      process.emitWarning = originalEmitWarning;
    }
  } catch {
    databaseModule = null;
  }
  return databaseModule;
}

export async function loadTurnCredits() {
  const DatabaseSync = await loadDatabaseClass();
  if (!DatabaseSync) return [];
  let db = null;
  try {
    db = new DatabaseSync(databaseFile(), { readOnly: true });
    const rows = db
      .prepare(
        `SELECT m.session_id AS sessionId,
                m.turn_id AS turnId,
                m.created_at AS createdAt,
                m.turn_credits AS credits,
                s.cwd AS cwd,
                s.model AS sessionModel
         FROM chat_session_messages m
         LEFT JOIN chat_sessions s ON s.session_id = m.session_id
         WHERE m.turn_credits IS NOT NULL AND m.turn_id IS NOT NULL`,
      )
      .all();
    return rows.map((row) => ({
      sessionId: String(row.sessionId),
      turnId: String(row.turnId),
      createdAt: Number(row.createdAt),
      credits: Number(row.credits),
      cwd: row.cwd ?? null,
      sessionModel: row.sessionModel ?? null,
    }));
  } catch {
    return [];
  } finally {
    try {
      db?.close();
    } catch {
      // best-effort close
    }
  }
}
