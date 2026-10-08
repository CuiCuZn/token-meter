import os from "node:os";
import path from "node:path";

export function qoderHome() {
  return process.env.QODER_HOME || path.join(os.homedir(), ".qoder-cn");
}

export function projectsDir() {
  return path.join(qoderHome(), "projects");
}

export function cacheDir() {
  return path.join(qoderHome(), "token-meter");
}

export function indexFile() {
  return path.join(cacheDir(), "index.json");
}

export function lockFile() {
  return path.join(cacheDir(), ".index.lock");
}
