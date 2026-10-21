import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { isJsonPath, mergeJson, mergeText } from "./merge.js";

export function sha256(s) {
  return createHash("sha256").update(s).digest("hex");
}

export function destPath(dir, filePath) {
  const s = String(filePath || "");
  const parts = s.split("/");
  if (!s || s.startsWith("/") || s.includes("\\") || /^[a-zA-Z]:/.test(s) || parts.some((x) => x === ".." || x === "." || x === "")) {
    throw new Error("refusing unsafe path from registry: " + s);
  }
  return join(dir, ...parts);
}

export function isHook(filePath) {
  return filePath.startsWith(".claude/hooks/") && filePath.endsWith(".sh");
}

async function existsRead(file, io) {
  try {
    return await (io.readFile || readFile)(file, "utf8");
  } catch (e) {
    if (e && e.code === "ENOENT") return null;
    throw e;
  }
}

export async function applyFile({ dir, kitId, filePath, incoming, existing, dryRun, yes, prompt, recordedHash }) {
  const dest = destPath(dir, filePath);
  if (existing == null) {
    return { dest, action: "write", text: incoming, reason: "new" };
  }
  if (existing === incoming) {
    return { dest, action: "skip", text: existing, reason: "identical" };
  }
  if (recordedHash && sha256(existing) === recordedHash) {
    return { dest, action: "write", text: incoming, reason: "unchanged-from-last-install" };
  }
  if (yes) return { dest, action: "write", text: incoming, reason: "overwrite" };
  if (dryRun) return { dest, action: "conflict", text: existing, reason: "would-prompt" };
  const choice = prompt ? await prompt(filePath) : "s";
  if (choice === "o" || choice === "overwrite") return { dest, action: "write", text: incoming, reason: "overwrite" };
  if (choice === "m" || choice === "merge") {
    if (isJsonPath(filePath)) {
      try {
        const m = mergeJson(existing, incoming);
        return { dest, action: "write", text: m.text, reason: "merge-json", conflicts: m.conflicts };
      } catch (e) {
        return { dest, action: "write", text: mergeText(existing, incoming, kitId), reason: "merge" };
      }
    }
    return { dest, action: "write", text: mergeText(existing, incoming, kitId), reason: "merge" };
  }
  return { dest, action: "skip", text: existing, reason: "conflict-skip" };
}

export async function writePlan(plan, io = {}) {
  if (plan.action !== "write") return;
  const mk = io.mkdir || mkdir;
  const write = io.writeFile || writeFile;
  const ch = io.chmod || chmod;
  await mk(dirname(plan.dest), { recursive: true });
  await write(plan.dest, plan.text, "utf8");
  if (plan.hook) {
    try { await ch(plan.dest, 0o755); } catch (e) { /* ignore on platforms without chmod */ }
  }
}

export async function readExisting(dir, filePath, io = {}) {
  return existsRead(destPath(dir, filePath), io);
}
