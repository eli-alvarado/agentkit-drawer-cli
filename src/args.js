export function parseArgs(argv) {
  const out = {
    cmd: "",
    kits: [],
    key: "",
    dryRun: false,
    yes: false,
    dir: "",
    registry: "",
    help: false,
  };
  const args = argv.slice();
  while (args.length) {
    const a = args.shift();
    if (a === "-h" || a === "--help") out.help = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--yes" || a === "-y") out.yes = true;
    else if (a === "--key") out.key = String(args.shift() || "");
    else if (a.startsWith("--key=")) out.key = a.slice(6);
    else if (a === "--dir") out.dir = String(args.shift() || "");
    else if (a.startsWith("--dir=")) out.dir = a.slice(6);
    else if (a === "--registry") out.registry = String(args.shift() || "");
    else if (a.startsWith("--registry=")) out.registry = a.slice(11);
    else if (a.startsWith("-") && a !== "-") {
      out.error = "unknown option: " + a;
      return out;
    } else if (!out.cmd) out.cmd = a;
    else out.kits.push(a);
  }
  return out;
}

export function usage() {
  return [
    "Usage: agentkit-drawer <command> [kits...] [options]",
    "",
    "Commands:",
    "  add <kit...>   Install kit files into this repo (merge, do not clobber)",
    "  list           Show kits from the registry",
    "  update         Re-install kits recorded in .agentkit/installed.json",
    "",
    "Options:",
    "  --key <key>        License key (or set AGENTKIT_KEY). Required for paid kits.",
    "  --dry-run          Print actions without writing files",
    "  --yes              Overwrite conflicts without prompting",
    "  --dir <path>       Target directory (default: current directory)",
    "  --registry <url>   Registry URL (default: https://dl.agentkitdrawer.com/registry)",
    "",
    "Examples:",
    "  npx github:eli-alvarado/agentkit-drawer-cli add starter",
    "  npx github:eli-alvarado/agentkit-drawer-cli add vibe-starter --key akd_…",
    "  AGENTKIT_KEY=akd_… npx github:eli-alvarado/agentkit-drawer-cli add vibe-starter claude-code",
    "  npx github:eli-alvarado/agentkit-drawer-cli list",
    "  npx github:eli-alvarado/agentkit-drawer-cli update --dry-run",
  ].join("\n");
}
