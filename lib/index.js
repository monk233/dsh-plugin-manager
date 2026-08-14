// plugin-manager — host half.
//
// A static dsh plugin (installed into a profile, survives restarts).
// Exposes a Typert Remote service `pluginManager` with the methods
// `list` / `setEnabled` / `deleteEntry`. The browser half calls them
// through `ctx.remote.pluginManager.*`.
//
// The methods manage the active profile's user patch layer
// ($DSH_HOME/profiles/<profile>/cordis.patch.yml):
//   - list        : current composition rows (from the Cordis Loader) + state
//   - setEnabled  : upsert `- id: <row> / disabled: true|false` (HMR hot-reloads)
//   - deleteEntry : remove a user-inserted row from the patch file entirely
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";

const PROTECTED_NAMES = [
  "cordis:include",
  "@deepseek-ai/cordis-plugin-include",
  "@deepseek-ai/cordis-plugin-loader",
  "@deepseek-ai/cordis-plugin-group",
  "@deepseek-ai/cordis-plugin-hmr",
  "@deepseek-ai/cordis-plugin-timer"
];
const START_MARKER = "# >>> BEGIN plugin-manager managed block (managed by the Plugin Manager UI) <<<";
const END_MARKER = "# >>> END plugin-manager managed block <<<";
const FIBER_PHASE = { 0: "pending", 1: "loading", 2: "active", 3: "failed", 4: null, 5: "unloading" };

/**
 * Replicate what the `Remote(name)` decorator records, without decorator
 * syntax: run the decorator with a hand-built context whose addInitializer
 * collects the initializer, then run it against the live instance so the
 * marker lands on the class prototype (consumed by the api-gateway's
 * source-mode discovery through `remoteMethods(service)`).
 */
function markRemote(instance, name) {
  const initializers = [];
  Remote(name)(undefined, {
    private: false,
    static: false,
    name,
    addInitializer(fn) {
      initializers.push(fn);
    }
  });
  for (const fn of initializers) fn.call(instance);
}

const fiberPhase = (fiber) => (fiber && typeof fiber.state === "number" ? FIBER_PHASE[fiber.state] ?? null : null);

const decodeFileUrl = (url) => {
  let p = String(url).replace(/^file:\/\//, "");
  p = p.replace(/%([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1);
  return p;
};

const guardOf = (id, name) => {
  if (id === "include" || name === "cordis:include") return "core-include";
  if (!id) return "no-id";
  const n = String(name || "");
  if (PROTECTED_NAMES.some((p) => n === p || n.endsWith("/" + p))) return "core";
  return null;
};

/** Ids of rows defined by `- insert:` children in the user patch layer. */
const insertChildIds = (content) => {
  const ids = new Set();
  const re = /^\s+- id:\s*(?:"([^"]*)"|'([^']*)'|([^\s#]+))\s*$/gm;
  let m;
  while ((m = re.exec(content)) !== null) ids.add(m[1] ?? m[2] ?? m[3]);
  return ids;
};

const parseManaged = (content) => {
  const map = new Map();
  const start = content.indexOf(START_MARKER);
  const end = content.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end <= start) return map;
  const section = content.slice(start, end);
  const re = /- id:\s*(?:"([^"]*)"|'([^']*)'|([^\s#]+))\s*\n\s*disabled:\s*(true|false)/g;
  let m;
  while ((m = re.exec(section)) !== null) map.set(m[1] ?? m[2] ?? m[3], m[4] === "true");
  return map;
};

const renderManaged = (map) => {
  const ids = [...map.keys()].filter((id) => !id.includes(":")).sort();
  if (ids.length === 0) return "";
  const lines = [START_MARKER];
  for (const id of ids) {
    const plain = /^[A-Za-z0-9._-]+$/.test(id);
    lines.push("- id: " + (plain ? id : JSON.stringify(id)));
    lines.push("  disabled: " + (map.get(id) ? "true" : "false"));
  }
  lines.push(END_MARKER);
  return lines.join("\n") + "\n";
};

const applyToggle = (content, rowId, enabled) => {
  const map = parseManaged(content);
  map.set(rowId, !enabled);
  const start = content.indexOf(START_MARKER);
  const end = content.indexOf(END_MARKER);
  let head = content;
  if (start !== -1 && end !== -1 && end > start) head = content.slice(0, start);
  if (head.length > 0 && !head.endsWith("\n")) head += "\n";
  return head + renderManaged(map);
};

/** The patch file must stay a top-level YAML array; never leave it bare. */
const ensureArray = (content) => {
  const base = content.length > 0 && !content.endsWith("\n") ? content + "\n" : content;
  return /^- /m.test(base) ? base : base + "[]\n";
};

/** Remove every patch occurrence of a row (insert children, top-level row blocks, managed rows). */
const removeRowFromPatch = (content, rowId) => {
  const esc = rowId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rowRe = new RegExp("^\\s*- id:\\s*(?:\"" + esc + "\"|'" + esc + "'|" + esc + ")\\s*$");
  const lines = content.split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^- /.test(line)) {
      const block = [line];
      let j = i + 1;
      while (j < lines.length && /^\s+\S/.test(lines[j])) {
        block.push(lines[j]);
        j++;
      }
      if (/^- insert:\s*$/.test(line)) {
        const kept = block.filter((bl) => !rowRe.test(bl));
        const hasChild = kept.some((bl) => /^\s+- id:/.test(bl));
        if (hasChild) out.push(...kept);
      } else if (rowRe.test(line)) {
        // drop this whole block (row definition or managed disable row)
      } else {
        out.push(...block);
      }
      i = j;
    } else {
      out.push(line);
      i++;
    }
  }
  return out.join("\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/\n+$/, "\n");
};

class PluginManagerGateway extends TypertRemoteService {
  static inject = ["loader", "fs", "clientModules"];

  constructor(ctx) {
    super(ctx, "pluginManager");
    for (const name of ["list", "setEnabled", "deleteEntry"]) markRemote(this, name);
  }

  /** Derive the active profile's patch file from the root include entry. */
  resolvePaths() {
    const loader = this.ctx.get("loader");
    if (loader === undefined) return null;
    let includePath = null;
    for (const entry of loader.entries()) {
      const opts = entry.options || {};
      if (entry.id === "include" || opts.name === "cordis:include") {
        if (opts.config && typeof opts.config.path === "string") includePath = decodeFileUrl(opts.config.path);
        break;
      }
    }
    if (!includePath) return null;
    const slash = Math.max(includePath.lastIndexOf("/"), includePath.lastIndexOf("\\"));
    const dir = slash >= 0 ? includePath.slice(0, slash) : includePath;
    return { patchPath: dir + "/" + "cordis.patch.yml" };
  }

  /** Package names of currently mounted `dsh.client` web modules. */
  clientModuleNames() {
    const cm = this.ctx.get("clientModules");
    if (cm === undefined || typeof cm.graph !== "function") return new Set();
    let graph;
    try {
      graph = cm.graph();
    } catch {
      return new Set();
    }
    return new Set((graph && graph.entries ? graph.entries : []).map((r) => r && r.id).filter(Boolean));
  }

  listEntries(patchContent) {
    const loader = this.ctx.get("loader");
    const rows = [];
    if (loader === undefined) return rows;
    const deletable = insertChildIds(patchContent);
    for (const entry of loader.entries()) {
      const opts = entry.options || {};
      if (opts.group) continue;
      const rowId = opts.id ?? "";
      if (rowId === "include") continue;
      const name = opts.name ?? "";
      const guard = guardOf(rowId, name);
      rows.push({
        uid: rows.length,
        entryId: rowId,
        name,
        enabled: !entry.disabled,
        state: fiberPhase(entry.fiber),
        togglable: guard === null,
        deletable: guard === null && deletable.has(rowId),
        guard
      });
    }
    return rows;
  }

  async readPatch(patchPath) {
    const fs = this.ctx.get("fs");
    if (fs === undefined) return "";
    const target = await fs.resolve(patchPath);
    const info = await fs.stat(target);
    if (!info) return "";
    return await fs.readText(target);
  }

  async writePatch(patchPath, content) {
    const fs = this.ctx.get("fs");
    if (fs === undefined) throw new Error("fs service is unavailable");
    const target = await fs.resolve(patchPath);
    await fs.writeText(target, content, undefined, undefined, { mode: "danger-full-access", workspaceRoot: "" });
  }

  /** @Remote("list") */
  list() {
    const paths = this.resolvePaths();
    return this.readPatch(paths ? paths.patchPath : "").then((content) => {
      const managed = {};
      const map = parseManaged(content);
      for (const [k, v] of map) if (!k.includes(":")) managed[k] = v;
      return {
        patchPath: paths ? paths.patchPath : null,
        entries: this.listEntries(content),
        managed
      };
    });
  }

  /** @Remote("setEnabled") */
  async setEnabled(args) {
    const input = args && typeof args === "object" ? args : {};
    const rowId = input.entryId;
    const enabled = input.enabled;
    if (typeof rowId !== "string" || rowId.length === 0) throw new Error("entryId is required");
    if (typeof enabled !== "boolean") throw new Error("enabled must be a boolean");
    if (rowId === "include") throw new Error("the include entry cannot be toggled");
    const paths = this.resolvePaths();
    if (paths === null) throw new Error("could not locate the profile patch file");
    const loader = this.ctx.get("loader");
    let found = false;
    if (loader !== undefined) {
      for (const entry of loader.entries()) {
        const opts = entry.options || {};
        if ((opts.id ?? "") === rowId) {
          found = true;
          const guard = guardOf(rowId, opts.name ?? "");
          if (guard !== null) throw new Error("entry \"" + rowId + "\" is protected (" + guard + ")");
          break;
        }
      }
    }
    if (!found) throw new Error("entry \"" + rowId + "\" not found in the current composition");
    const content = await this.readPatch(paths.patchPath);
    await this.writePatch(paths.patchPath, ensureArray(applyToggle(content, rowId, enabled)));
    return { entryId: rowId, enabled, patchPath: paths.patchPath };
  }

  /** @Remote("deleteEntry") */
  async deleteEntry(args) {
    const input = args && typeof args === "object" ? args : {};
    const rowId = input.entryId;
    if (typeof rowId !== "string" || rowId.length === 0) throw new Error("entryId is required");
    if (rowId === "include") throw new Error("the include entry cannot be deleted");
    const paths = this.resolvePaths();
    if (paths === null) throw new Error("could not locate the profile patch file");
    const loader = this.ctx.get("loader");
    let found = false;
    if (loader !== undefined) {
      for (const entry of loader.entries()) {
        const opts = entry.options || {};
        if ((opts.id ?? "") === rowId) {
          found = true;
          const guard = guardOf(rowId, opts.name ?? "");
          if (guard !== null) throw new Error("entry \"" + rowId + "\" is protected (" + guard + ")");
          break;
        }
      }
    }
    if (!found) throw new Error("entry \"" + rowId + "\" not found in the current composition");
    const content = await this.readPatch(paths.patchPath);
    const start = content.indexOf(START_MARKER);
    const userPart = start === -1 ? content : content.slice(0, start);
    if (!insertChildIds(userPart).has(rowId)) {
      throw new Error("entry \"" + rowId + "\" is not defined in this profile patch file; only user-inserted plugins can be deleted");
    }
    await this.writePatch(paths.patchPath, ensureArray(removeRowFromPatch(content, rowId)));
    return { entryId: rowId, patchPath: paths.patchPath };
  }
}

export default PluginManagerGateway;
