import { createInterface } from "node:readline/promises";
import { parseArgs, usage } from "./args.js";
import { applyFile, isHook, readExisting, sha256, writePlan } from "./install.js";
import { DEFAULT_REGISTRY, fetchFile, fetchRegistry, resolveKits } from "./registry.js";
import { loadState, saveState } from "./state.js";

function write(stream, s) {
  if (stream && stream.write) stream.write(s.endsWith("\n") ? s : s + "\n");
}

async function defaultPrompt(filePath, io) {
  if (typeof io.question === "function") return io.question(filePath);
  const stdin = io.stdin;
  const stdout = io.stdout;
  if (!stdin || !stdin.isTTY) {
    write(io.stderr, filePath + " exists and differs; skipping (not a TTY). Use --yes to overwrite or rerun in a terminal to merge.");
    return "s";
  }
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const a = (await rl.question(filePath + " exists and differs. [s]kip [o]verwrite [m]erge: ")).trim().toLowerCase();
    if (a.startsWith("o")) return "o";
    if (a.startsWith("m")) return "m";
    return "s";
  } finally {
    rl.close();
  }
}

export async function run(argv, io = {}) {
  const opts = parseArgs(argv);
  const env = io.env || {};
  const stdout = io.stdout;
  const stderr = io.stderr;
  if (opts.error) {
    write(stderr, opts.error);
    write(stderr, usage());
    return 2;
  }
  if (opts.help || !opts.cmd || opts.cmd === "help") {
    write(stdout, usage());
    return opts.cmd && opts.cmd !== "help" && !opts.help ? 2 : 0;
  }
  const dir = opts.dir || io.cwd || ".";
  const registryUrl = opts.registry || env.AGENTKIT_REGISTRY || DEFAULT_REGISTRY;
  const key = opts.key || env.AGENTKIT_KEY || "";
  const fetchImpl = io.fetch || globalThis.fetch;

  try {
    if (opts.cmd === "list") return await cmdList({ registryUrl, dir, fetchImpl, stdout, io });
    if (opts.cmd === "add") return await cmdAdd({ opts, dir, key, registryUrl, fetchImpl, stdout, stderr, io });
    if (opts.cmd === "update") return await cmdUpdate({ opts, dir, key, registryUrl, fetchImpl, stdout, stderr, io });
    write(stderr, "unknown command: " + opts.cmd);
    write(stderr, usage());
    return 2;
  } catch (e) {
    write(stderr, e.message || String(e));
    return e.status === 401 || e.status === 403 ? 1 : 1;
  }
}

async function cmdList({ registryUrl, dir, fetchImpl, stdout, io }) {
  const catalog = await fetchRegistry(registryUrl, fetchImpl);
  const state = await loadState(dir, io);
  const installed = state.kits || {};
  write(stdout, "Kits from " + registryUrl);
  write(stdout, "");
  const width = Math.max(10, ...catalog.kits.map((k) => k.id.length));
  for (const k of catalog.kits) {
    const mark = installed[k.id] ? "installed " + installed[k.id].version : (k.paid ? "paid" : "free");
    write(stdout, "  " + k.id.padEnd(width + 2) + k.name + "  " + k.version + "  " + mark);
  }
  return 0;
}

async function cmdAdd({ opts, dir, key, registryUrl, fetchImpl, stdout, stderr, io }) {
  if (!opts.kits.length) {
    write(stderr, "add needs at least one kit. Try: npx github:eli-alvarado/agentkit-drawer-cli add starter");
    return 2;
  }
  const catalog = await fetchRegistry(registryUrl, fetchImpl);
  const wanted = resolveKits(opts.kits, catalog);
  const unknown = opts.kits.filter((id) => !(catalog.kits || []).some((k) => k.id === id));
  if (unknown.length) {
    write(stderr, "unknown kit: " + unknown.join(", ") + ". Run: npx github:eli-alvarado/agentkit-drawer-cli list");
    return 2;
  }
  if (!wanted.length) {
    write(stderr, "nothing to install");
    return 2;
  }
  const paid = wanted.filter((k) => k.paid);
  if (paid.length && !key) {
    write(stderr, paid.map((k) => k.id).join(", ") + " require a license key. Pass --key or set AGENTKIT_KEY.");
    write(stderr, "Buy at https://agentkitdrawer.com — the key is on /thanks/ and in the delivery email.");
    return 1;
  }
  const state = await loadState(dir, io);
  const actions = [];
  for (const kit of wanted) {
    write(stdout, (opts.dryRun ? "Would install " : "Installing ") + kit.id + " " + kit.version);
    const files = kit.files || [];
    const hashes = { ...(state.kits[kit.id] && state.kits[kit.id].files) };
    for (const filePath of files) {
      const incoming = await fetchFile(catalog, kit, filePath, key, fetchImpl);
      const existing = await readExisting(dir, filePath, io);
      const recordedHash = hashes[filePath];
      const plan = await applyFile({
        dir, kitId: kit.id, filePath, incoming, existing,
        dryRun: opts.dryRun, yes: opts.yes,
        prompt: (p) => (io.prompt || defaultPrompt)(p, io),
        recordedHash,
      });
      plan.filePath = filePath;
      plan.kitId = kit.id;
      plan.hook = isHook(filePath);
      actions.push(plan);
      write(stdout, "  " + plan.action + "  " + filePath + (plan.reason ? " (" + plan.reason + ")" : ""));
      if (!opts.dryRun && plan.action === "write") {
        await writePlan(plan, io);
        hashes[filePath] = sha256(plan.text);
      } else if (!opts.dryRun && plan.action === "skip" && existing != null) {
        hashes[filePath] = sha256(existing);
      }
    }
    if (!opts.dryRun) {
      const when = typeof io.now === "function" ? io.now() : new Date();
      state.kits[kit.id] = { version: kit.version, installedAt: when.toISOString(), files: hashes };
    }
  }
  if (!opts.dryRun) await saveState(dir, state, io);
  const wrote = actions.filter((a) => a.action === "write").length;
  const skipped = actions.filter((a) => a.action === "skip").length;
  const conflicts = actions.filter((a) => a.action === "conflict").length;
  write(stdout, opts.dryRun
    ? `Dry run: ${actions.length} file(s), ${conflicts} conflict(s) would prompt.`
    : `Done. ${wrote} written, ${skipped} skipped.`);
  return 0;
}

async function cmdUpdate({ opts, dir, key, registryUrl, fetchImpl, stdout, stderr, io }) {
  const state = await loadState(dir, io);
  const ids = Object.keys(state.kits || {});
  if (!ids.length) {
    write(stderr, "no kits recorded in .agentkit/installed.json. Run add first.");
    return 1;
  }
  return cmdAdd({ opts: { ...opts, kits: ids }, dir, key, registryUrl, fetchImpl, stdout, stderr, io });
}
