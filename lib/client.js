// plugin-manager — browser half.
//
// dsh.client web module in the dsh ModuleLoader format. Registers:
//   - settings.section "plugin-manager": the plugin list page
//   - shell.overlay "plugin-manager-menu": the row action dropdown
//
// Deliberately declares NO inject (like the shipped skins): the module
// activates unconditionally so it can never park or fail the page load.
// The host half is reached lazily at call time through the Typert Remote
// service `remote.pluginManager` (methods list / setEnabled / deleteEntry);
// when that service is not yet available the UI degrades to an in-page
// message instead of throwing.
window.__ModuleLoader__.load({
  id: "@dsh-external/dsh-plugin-manager",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");
    const h = React.createElement;

    const CSS = `
.dsh-pmgr { display: flex; flex-direction: column; gap: 10px; padding: 4px 2px 16px; font-size: 13px; color: var(--dsw-alias-label-primary); }
.dsh-pmgr-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dsh-pmgr-title { font-size: 15px; font-weight: 600; }
.dsh-pmgr-search { flex: 1 1 180px; min-width: 140px; padding: 5px 8px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px; background: var(--dsw-alias-bg-layer-1); color: inherit; }
.dsh-pmgr-btn { padding: 4px 12px; border-radius: 6px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); cursor: pointer; font-size: 12px; }
.dsh-pmgr-btn:hover:not(:disabled) { border-color: var(--dsw-alias-brand-primary); }
.dsh-pmgr-btn:disabled { opacity: .5; cursor: default; }
.dsh-pmgr-btn.danger { color: var(--dsw-alias-state-error-primary); border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 45%, transparent); }
.dsh-pmgr-list { list-style: none; margin: 0; padding: 0; max-height: 52vh; overflow-y: auto; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-layer-1); }
.dsh-pmgr-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.dsh-pmgr-row:last-child { border-bottom: none; }
.dsh-pmgr-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-pmgr-id { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.dsh-pmgr-chip { font-size: 11px; padding: 1px 7px; border-radius: 999px; white-space: nowrap; }
.dsh-pmgr-chip.on { background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 18%, transparent); color: var(--dsw-alias-state-success-primary); }
.dsh-pmgr-chip.off { background: color-mix(in srgb, var(--dsw-alias-label-secondary) 15%, transparent); color: var(--dsw-alias-label-secondary); }
.dsh-pmgr-chip.err { background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 18%, transparent); color: var(--dsw-alias-state-error-primary); }
.dsh-pmgr-chip.warn { background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 18%, transparent); color: var(--dsw-alias-state-warn-primary); }
.dsh-pmgr-note { font-size: 12px; color: var(--dsw-alias-label-secondary); }
.dsh-pmgr-err { color: var(--dsw-alias-state-error-primary); font-size: 12px; }
.dsh-pmgr-empty { padding: 14px; text-align: center; color: var(--dsw-alias-label-secondary); }
.dsh-pmgr-more { padding: 2px 9px; border-radius: 6px; border: 1px solid transparent; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; font-size: 15px; line-height: 1.2; }
.dsh-pmgr-more:hover { border-color: var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.dsh-pmgr-menu { min-width: 190px; background: var(--dsw-alias-bg-overlay); border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; box-shadow: 0 8px 24px rgba(0, 0, 0, .25); overflow: hidden; }
.dsh-pmgr-menu-item { display: block; width: 100%; text-align: left; padding: 8px 12px; border: none; background: transparent; color: var(--dsw-alias-label-primary); cursor: pointer; font-size: 12px; }
.dsh-pmgr-menu-item:hover { background: var(--dsw-alias-bg-layer-2); }
.dsh-pmgr-menu-item.danger { color: var(--dsw-alias-state-error-primary); }
.dsh-pmgr-menu-hint { display: block; padding: 7px 12px; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.dsh-pmgr-menu-confirm { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; }
.dsh-pmgr-menu-confirm-row { display: flex; gap: 6px; }
`;

    const STATUS = {
      active: { label: "运行中", cls: "on" },
      failed: { label: "启动失败", cls: "err" },
      pending: { label: "等待依赖", cls: "warn" },
      loading: { label: "加载中", cls: "warn" },
      unloading: { label: "卸载中", cls: "warn" }
    };
    const STATUS_NULL = { label: "未加载", cls: "off" };
    const MENU_EST_H = 150;
    const MENU_W = 200;

    // Shared store between the settings page and the frame-level overlay.
    let snapshot = { menu: null, confirm: null, busy: {}, notice: "" };
    const listeners = new Set();
    const getSnapshot = () => snapshot;
    const subscribe = (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    };
    const update = (patch) => {
      snapshot = { ...snapshot, ...patch };
      for (const fn of [...listeners]) fn();
    };

    const name = "plugin-manager";
    const inject = [];

    function apply(ctx) {
      const slots = ctx.get ? ctx.get("slots") : undefined;
      if (slots === undefined) return;

      ctx.effect(() => {
        const tag = document.createElement("style");
        tag.dataset.plugin = name;
        tag.textContent = CSS;
        document.head.appendChild(tag);
        return () => {
          tag.remove();
        };
      }, "plugin-manager styles");

      // Lazy remote access: never fails activation, degrades to an in-page message.
      const pluginManager = () => {
        const face = (ctx.get ? ctx.get("remote") : undefined) || ctx.remote;
        return face && face.pluginManager ? face.pluginManager : undefined;
      };
      const remoteCall = async (method, args) => {
        const pm = pluginManager();
        if (pm === undefined) throw new Error("插件管理服务未就绪:host 端 pluginManager 服务暂不可用");
        const result = args === undefined ? await pm[method]() : await pm[method](args);
        if (!result.ok) {
          const detail = result.error && (result.error.message || result.error.code);
          throw new Error(detail || "remote call failed");
        }
        return result.value;
      };

      const reloadSoon = (text) => {
        update({ notice: text + " —— 正在自动刷新页面…" });
        window.setTimeout(() => {
          window.location.reload();
        }, 1500);
      };

      const toggle = (entry, target) => {
        update({ busy: { ...snapshot.busy, [entry.uid]: true }, menu: null, confirm: null, notice: "" });
        remoteCall("setEnabled", { entryId: entry.entryId, enabled: target }).then((res) => {
          reloadSoon((target ? "已启用" : "已禁用") + " " + entry.name + " —— 已写入 " + (res.patchPath || ""));
        }).catch((error) => {
          update({ notice: "操作失败:" + String((error && error.message) || error) });
        }).finally(() => {
          const b = { ...snapshot.busy };
          delete b[entry.uid];
          update({ busy: b });
        });
      };

      const remove = (entry) => {
        update({ busy: { ...snapshot.busy, [entry.uid]: true }, menu: null, confirm: null, notice: "" });
        remoteCall("deleteEntry", { entryId: entry.entryId }).then((res) => {
          reloadSoon("已删除 " + entry.name + " —— 已从 " + (res.patchPath || "") + " 移除");
        }).catch((error) => {
          update({ notice: "操作失败:" + String((error && error.message) || error) });
        }).finally(() => {
          const b = { ...snapshot.busy };
          delete b[entry.uid];
          update({ busy: b });
        });
      };

      const openMenu = (e, entry) => {
        const rect = e.currentTarget.getBoundingClientRect();
        let top = rect.bottom + 4;
        if (top + MENU_EST_H > window.innerHeight) top = Math.max(8, rect.top - MENU_EST_H - 4);
        const left = Math.max(8, Math.min(rect.right - MENU_W, window.innerWidth - MENU_W - 8));
        update({ menu: { uid: entry.uid, entry, top, left }, confirm: null });
      };

      const onMenuAction = (entry, kind) => {
        if (kind === "enable") {
          toggle(entry, true);
          return;
        }
        update({ confirm: { uid: entry.uid, kind } });
      };

      const Section = () => {
        const [state, setState] = React.useState({ loading: true, data: null, error: null });
        const [query, setQuery] = React.useState("");
        const snap = React.useSyncExternalStore(subscribe, getSnapshot);
        const refresh = React.useCallback(() => {
          setState((s) => ({ ...s, loading: true }));
          remoteCall("list").then((data) => {
            setState({ loading: false, data, error: null });
          }).catch((error) => {
            setState({ loading: false, data: null, error: String((error && error.message) || error) });
          });
        }, []);
        React.useEffect(() => {
          refresh();
        }, [refresh]);
        React.useEffect(() => () => {
          update({ menu: null, confirm: null });
        }, []);
        const q = query.trim().toLowerCase();
        const entries = (state.data && state.data.entries ? state.data.entries : [])
          .filter((e) => !q || String(e.name || "").toLowerCase().includes(q) || String(e.entryId || "").toLowerCase().includes(q));
        const total = state.data && state.data.entries ? state.data.entries.length : 0;
        return h("div", { className: "dsh-pmgr" },
          h("div", { className: "dsh-pmgr-head" },
            h("span", { className: "dsh-pmgr-title" }, "插件管理"),
            h("input", { className: "dsh-pmgr-search", placeholder: "搜索插件名或 id…", value: query, onChange: (e) => setQuery(e.target.value) }),
            h("button", { className: "dsh-pmgr-btn", disabled: state.loading, onClick: () => refresh() }, "刷新")
          ),
          h("div", { className: "dsh-pmgr-note" },
            state.data && state.data.patchPath
              ? "修改写入 " + state.data.patchPath + " ;点击行尾 ⋮ 选择操作,禁用/删除需二次确认,执行后自动刷新页面生效。内置插件只能禁用,不能删除。"
              : "未能定位补丁文件(profile 组合根缺失)。"
          ),
          snap.notice ? h("div", { className: "dsh-pmgr-note" }, snap.notice) : null,
          state.error ? h("div", { className: "dsh-pmgr-err" }, "错误:" + state.error) : null,
          state.loading && !state.data ? h("div", { className: "dsh-pmgr-empty" }, "加载中…") : null,
          h("ul", { className: "dsh-pmgr-list" },
            entries.length === 0 && !state.loading ? h("li", { className: "dsh-pmgr-empty" }, "没有匹配的插件(共 " + total + " 个)") : null,
            entries.map((entry) => {
              const st = STATUS[entry.state] || STATUS_NULL;
              const chip = entry.enabled ? { label: "已启用", cls: "on" } : { label: "已禁用", cls: "off" };
              const isBusy = !!snap.busy[entry.uid];
              const menuOpen = snap.menu !== null && snap.menu.uid === entry.uid;
              return h("li", { key: entry.uid, className: "dsh-pmgr-row" },
                h("span", { className: "dsh-pmgr-chip " + chip.cls }, chip.label),
                h("span", { className: "dsh-pmgr-chip " + st.cls }, st.label),
                h("span", { className: "dsh-pmgr-name", title: entry.name }, entry.name),
                h("span", { className: "dsh-pmgr-id" }, entry.entryId),
                h("div", { className: "dsh-pmgr-action" },
                  h("button", { className: "dsh-pmgr-more", disabled: isBusy, title: "操作", onClick: (e) => {
                    if (menuOpen) {
                      update({ menu: null, confirm: null });
                      return;
                    }
                    openMenu(e, entry);
                  } }, isBusy ? "…" : "⋮")
                )
              );
            })
          )
        );
      };

      const MenuOverlay = () => {
        const snap = React.useSyncExternalStore(subscribe, getSnapshot);
        React.useEffect(() => {
          if (snap.menu === null) return;
          const close = () => update({ menu: null, confirm: null });
          const onDown = (e) => {
            if (e.target && e.target.closest && (e.target.closest(".dsh-pmgr-menu") || e.target.closest(".dsh-pmgr-action"))) return;
            close();
          };
          document.addEventListener("mousedown", onDown);
          window.addEventListener("scroll", close, true);
          window.addEventListener("resize", close);
          return () => {
            document.removeEventListener("mousedown", onDown);
            window.removeEventListener("scroll", close, true);
            window.removeEventListener("resize", close);
          };
        }, [snap.menu]);
        if (snap.menu === null) return null;
        const { entry, top, left } = snap.menu;
        const isBusy = !!snap.busy[entry.uid];
        const confirming = snap.confirm !== null && snap.confirm.uid === entry.uid;
        let content = null;
        if (confirming && snap.confirm.kind === "disable") {
          content = h("div", { className: "dsh-pmgr-menu-confirm" },
            h("span", { className: "dsh-pmgr-menu-hint" }, "确认禁用 " + entry.name + " ?"),
            h("div", { className: "dsh-pmgr-menu-confirm-row" },
              h("button", { className: "dsh-pmgr-btn danger", disabled: isBusy, onClick: () => toggle(entry, false) }, isBusy ? "…" : "确认禁用"),
              h("button", { className: "dsh-pmgr-btn", disabled: isBusy, onClick: () => update({ confirm: null }) }, "取消")
            )
          );
        } else if (confirming && snap.confirm.kind === "delete") {
          content = h("div", { className: "dsh-pmgr-menu-confirm" },
            h("span", { className: "dsh-pmgr-menu-hint" }, "确认删除 " + entry.name + " ?将从此 profile 配置中移除,恢复需手动重新添加。"),
            h("div", { className: "dsh-pmgr-menu-confirm-row" },
              h("button", { className: "dsh-pmgr-btn danger", disabled: isBusy, onClick: () => remove(entry) }, isBusy ? "…" : "确认删除"),
              h("button", { className: "dsh-pmgr-btn", disabled: isBusy, onClick: () => update({ confirm: null }) }, "取消")
            )
          );
        } else {
          content = h("div", null,
            h("button", { className: "dsh-pmgr-menu-item", onClick: () => onMenuAction(entry, entry.enabled ? "disable" : "enable") }, entry.enabled ? "禁用" : "启用"),
            entry.deletable
              ? h("button", { className: "dsh-pmgr-menu-item danger", onClick: () => onMenuAction(entry, "delete") }, "删除")
              : h("span", { className: "dsh-pmgr-menu-hint" }, "删除不可用:内置插件只能禁用")
          );
        }
        return h("div", { className: "dsh-pmgr-menu", style: { position: "fixed", top, left, zIndex: 2147483000, pointerEvents: "auto" } }, content);
      };

      slots.inject("settings.section", () => slots.register(
        { name: "settings.section", id: "plugin-manager", order: 16, label: "插件管理" },
        (props) => React.createElement(Section, props)
      ));
      slots.inject("shell.overlay", () => slots.register(
        { name: "shell.overlay", id: "plugin-manager-menu", order: 100 },
        (props) => React.createElement(MenuOverlay, props)
      ));
    }

    exports.name = name;
    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  }
});
