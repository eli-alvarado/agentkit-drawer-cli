import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export function stateFile(dir) {
  return join(dir, ".agentkit", "installed.json");
}

export async function loadState(dir, io = {}) {
  const read = io.readFile || readFile;
  try {
    return JSON.parse(await read(stateFile(dir), "utf8"));
  } catch (e) {
    return { kits: {} };
  }
}

export async function saveState(dir, state, io = {}) {
  const write = io.writeFile || writeFile;
  const mk = io.mkdir || mkdir;
  const file = stateFile(dir);
  await mk(dirname(file), { recursive: true });
  await write(file, JSON.stringify(state, null, 2) + "\n", "utf8");
}
