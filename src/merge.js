export function beginMark(kitId) {
  return `<!-- agentkit-drawer:${kitId} -->`;
}

export function endMark(kitId) {
  return `<!-- /agentkit-drawer:${kitId} -->`;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function mergeText(existing, incoming, kitId) {
  const begin = beginMark(kitId);
  const end = endMark(kitId);
  const block = `${begin}\n${String(incoming).replace(/\s+$/, "")}\n${end}`;
  const re = new RegExp(`${escapeRe(begin)}[\\s\\S]*?${escapeRe(end)}`);
  if (re.test(existing)) return existing.replace(re, block);
  const head = String(existing).replace(/\s+$/, "");
  return (head ? head + "\n\n" : "") + block + "\n";
}

export function isJsonPath(p) {
  return String(p).endsWith(".json");
}

function isObj(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

export function mergeJsonValues(existing, incoming, path = "") {
  const conflicts = [];
  if (Array.isArray(existing) && Array.isArray(incoming)) {
    const extra = incoming.filter((x) => !existing.some((y) => JSON.stringify(y) === JSON.stringify(x)));
    return { value: existing.concat(extra), conflicts };
  }
  if (isObj(existing) && isObj(incoming)) {
    const value = { ...existing };
    for (const [k, v] of Object.entries(incoming)) {
      const p = path ? path + "." + k : k;
      if (!(k in value)) value[k] = v;
      else if (isObj(value[k]) && isObj(v) || Array.isArray(value[k]) && Array.isArray(v)) {
        const inner = mergeJsonValues(value[k], v, p);
        value[k] = inner.value;
        conflicts.push(...inner.conflicts);
      } else if (JSON.stringify(value[k]) !== JSON.stringify(v)) {
        conflicts.push({ path: p, existing: value[k], incoming: v });
      }
    }
    return { value, conflicts };
  }
  if (JSON.stringify(existing) !== JSON.stringify(incoming)) {
    conflicts.push({ path: path || ".", existing, incoming });
  }
  return { value: existing, conflicts };
}

export function mergeJson(existingStr, incomingStr) {
  const existing = JSON.parse(existingStr);
  const incoming = JSON.parse(incomingStr);
  const m = mergeJsonValues(existing, incoming);
  return { text: JSON.stringify(m.value, null, 2) + "\n", conflicts: m.conflicts };
}
