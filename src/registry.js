export const DEFAULT_REGISTRY = "https://dl.agentkitdrawer.com/registry";

export function resolveKits(ids, catalog) {
  const byId = Object.fromEntries((catalog.kits || []).map((k) => [k.id, k]));
  const out = [];
  for (const id of ids) {
    const k = byId[id];
    if (!k) continue;
    if (Array.isArray(k.includes)) {
      for (const inner of k.includes) {
        if (!out.includes(inner)) out.push(inner);
      }
    } else if (!out.includes(id)) out.push(id);
  }
  return out.map((id) => byId[id]).filter(Boolean);
}

export async function fetchRegistry(url, fetchImpl = globalThis.fetch) {
  const r = await fetchImpl(url);
  if (!r.ok) throw new Error("registry returned " + r.status);
  const j = await r.json();
  if (!j || !j.ok || !Array.isArray(j.kits)) throw new Error("bad registry");
  return j;
}

export function fileUrl(catalog, kitId, filePath) {
  const base = String(catalog.base || "https://dl.agentkitdrawer.com").replace(/\/$/, "");
  return `${base}/kit/${encodeURIComponent(kitId)}/file?path=${encodeURIComponent(filePath)}`;
}

export async function fetchFile(catalog, kit, filePath, key, fetchImpl = globalThis.fetch) {
  const url = new URL(fileUrl(catalog, kit.id, filePath));
  const headers = {};
  if (kit.paid && key) headers["x-agentkit-key"] = key;
  const r = await fetchImpl(url, { headers });
  const text = await r.text();
  if (!r.ok) {
    let err = "download failed (" + r.status + ")";
    try {
      const j = JSON.parse(text);
      if (j.error === "key_required") err = kit.id + " is a paid kit. Pass --key or set AGENTKIT_KEY.";
      else if (j.error === "bad_key") err = "license key was rejected.";
      else if (j.error === "not_entitled") err = "this license key does not include " + kit.id + ".";
      else if (j.error) err = j.error;
    } catch (e) { /* keep status err */ }
    const e = new Error(err);
    e.status = r.status;
    throw e;
  }
  return text;
}
