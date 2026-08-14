# dsh-plugin-manager

在 DeepSeek Harness **Web UI** 里直接管理 profile 插件的插件:

- **设置 → 插件管理** 页面列出当前 profile 组合里的全部插件行(名称、entryId、启用状态、运行状态);
- 每行 **⋮** 菜单:启用 / 禁用 / 删除;
  - **禁用/删除** 需二次确认,执行后自动刷新页面生效;
  - **启用** 直接执行并自动刷新;
- 修改写入当前 profile 的用户补丁层 `$DSH_HOME/profiles/<profile>/cordis.patch.yml`,由 DSH 的 HMR 热重载自动生效 —— **无需手改配置文件、无需重启**;
- 受保护的核心组件(include / loader / group / hmr / timer)不可切换;内置(bundle 层)插件只能禁用,不能删除。

> 本包是从动态插件固化的**静态安装版**。动态插件(`harness.handle`)仅存在于当前进程、重启即失;静态版通过 Typert Remote 服务(`pluginManager`)与浏览器端通信,安装后**重启依然生效**。

## 结构

```
plugin-manager/
├── package.json          # dsh.client 声明 + exports(./client)
├── lib/index.js          # Host: Typert Remote 服务(pluginManager)
├── lib/client.js         # Browser: 设置页 + shell.overlay 下拉菜单
├── cordis.patch.yml      # bundle 补丁(插入自身组合行)
└── README.md
```

## 安装

前置:先停止动态版插件(若之前运行过 `pmgr-*`),避免同一设置页重复注册。

```bash
# 1) 把本包加入 web profile 的依赖(转发给 pnpm)
dsh plugin --profile web add <本目录绝对路径>

# 2) 确认组合行存在;若 dsh plugin add 未自动挂载,手动追加到
#    $DSH_HOME/profiles/web/cordis.patch.yml:
#    - insert:
#        - id: plugin-manager
#          name: '@dsh-external/dsh-plugin-manager'
```

组合变化会触发 HMR 热重载(或重启 `dsh web`)。安装完成后打开 **设置 → 插件管理**。

## 使用

- 搜索插件名或 id 快速过滤;
- 服务端插件切换后热重载即时生效,客户端插件(浏览器界面)需刷新页面 —— 插件会自动刷新;
- 删除 = 从 profile 补丁的 `- insert:` 列表中移除该行(仅对用户插入的插件可用),恢复需手动重新添加。

## 开发

- Host 端逻辑在 `lib/index.js`(补丁读写、保护名单、删除语义);
- Browser 端在 `lib/client.js`(React,`ctx.remote.pluginManager.*` 调用);
- 修改后重新安装依赖即可(本包无构建步骤,浏览器端直接以 ModuleLoader 格式加载)。

## License

MIT
