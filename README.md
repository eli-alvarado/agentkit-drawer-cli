# agentkit-drawer

One-command installer for AgentKit Drawer kits. Writes `AGENTS.md`, `CLAUDE.md`, `.cursor/rules`, and `.claude/` into this repo. Merges when a file already exists. Paid kit contents are **not** in this package — the CLI downloads them from `dl.agentkitdrawer.com` after a license check.

## Installation

Free Starter (no key):

```bash
npx github:eli-alvarado/agentkit-drawer-cli add starter
```

Paid kit (key from `/thanks/` or the delivery email):

```bash
npx github:eli-alvarado/agentkit-drawer-cli add vibe-starter --key akd_…
```

Several kits, key from the environment:

```bash
export AGENTKIT_KEY=akd_…
npx github:eli-alvarado/agentkit-drawer-cli add vibe-starter claude-code
```

List available kits with `list` or refresh installed kits with `update`:

```bash
npx github:eli-alvarado/agentkit-drawer-cli list
npx github:eli-alvarado/agentkit-drawer-cli update
```

Preview without writing:

```bash
npx github:eli-alvarado/agentkit-drawer-cli add starter --dry-run
```

## What happens on add

1. Fetch `https://dl.agentkitdrawer.com/registry` (paths and versions only).
2. Free kits download immediately. Paid kits send `--key` / `AGENTKIT_KEY`; the worker rejects a missing, invalid, or wrong-product key.
3. Each file is written to its kit path (`AGENTS.md` at the repo root, Cursor rules under `.cursor/rules/`, Claude Code files under `.claude/`, Game Jam files under `godot/` and `web/`).
4. If a file already exists and differs:
   - interactive TTY: prompt `[s]kip [o]verwrite [m]erge`
   - `--yes`: overwrite
   - `--dry-run` or non-TTY: report the conflict, do not overwrite
5. Merge for Markdown appends (or replaces) a marked `<!-- agentkit-drawer:<kit> -->` section. Merge for `.json` keeps your keys and adds new ones.
6. `.claude/hooks/*.sh` are marked executable.
7. Installed kits are recorded in `.agentkit/installed.json` for `update`.

## Kits

| id | key? |
|---|---|
| `starter` | no |
| `one-file` | yes |
| `vibe-starter` | yes |
| `game-jam` | yes |
| `agent-builder` | yes |
| `claude-code` | yes |
| `fastapi` | yes |
| `supabase-nextjs` | yes |
| `bundle` | yes (unlocks vibe-starter + game-jam + agent-builder) |

Buy keys at [agentkitdrawer.com](https://agentkitdrawer.com). The Whole Cabinet key installs the three original packs, not Claude Code / FastAPI / Supabase.

## Options

- `--key <key>` — license key
- `--dry-run` — print actions only
- `--yes` — overwrite conflicts
- `--dir <path>` — target directory
- `--registry <url>` — override registry (or `AGENTKIT_REGISTRY`)

## Requirements

The CLI requires Node.js 18 or later and has no package dependencies.
