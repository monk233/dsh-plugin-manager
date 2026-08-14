# dsh-plugin-manager

在 DeepSeek Harness **Web UI** 里直接管理 profile 插件的插件:

- **设置 → 插件管理** 页面列出当前 profile 组合里的全部插件行(名称、entryId、启用状态、运行状态);
- 每行 **⋮** 菜单:启用 / 禁用 / 删除;
  - **禁用/删除** 需二次确认,执行后自动刷新页面生效;
  - **启用** 直接执行并自动刷新;
- 修改写入当前 profile 的用户补丁层 `$DSH_HOME/profiles/<profile>/cordis.patch.yml`,由 DSH 的 HMR 热重载自动生效 —— **无需手改配置文件、无需重启**;
- 受保护的核心组件(include / loader / group / hmr / timer)不可切换;内置(bundle 层)插件只能禁用,不能删除。

> 本包是从动态插件固化的**静态安装版**。动态插件(`harness.handle`)仅存在于当前进程、重启即失;静态版在 Host 端注册一条 HTTP JSON 路由(`/dsh-plugin-manager-api`),浏览器端直接 `fetch` 调用,安装后**重启依然生效**。
>
> 说明:不使用 Typert Remote 通道 —— 客户端的 `ctx.remote` 命名空间是编译进 web 前端 bundle 的固定集合(`dsh-api-remotes` 在构建期聚合各包的 `/remote` 导出),运行时安装的插件无法加入。

## 结构

```
plugin-manager/
├── package.json          # dsh.client 声明 + exports(./client)
├── lib/index.js          # Host: HTTP JSON API 路由(/dsh-plugin-manager-api)
├── lib/client.js         # Browser: 设置页 + shell.overlay 下拉菜单(fetch 调用)
├── cordis.patch.yml      # bundle 补丁(插入自身组合行)
└── README.md
```

## 安装

前置:先停止动态版插件(若之前运行过 `pmgr-*`),避免同一设置页重复注册。

### 0) 准备 `dsh` 与 `pnpm` 命令(新装环境需要)

`dsh plugin` 命令只是把参数转发给 `pnpm`,两者都需要在 PATH 上:

```bash
# 全局安装 dsh(建议与运行版本一致,如 0.1.0-rc.6)与 pnpm
npm install -g @deepseek-ai/dsh@0.1.0-rc.6 pnpm
# 若 npm 提示 allow-scripts(原生模块 node-pty/koffi 等被拦),按提示放行后重装:
npm install -g --allow-scripts=@deepseek-ai/dsh-subprocess-local,koffi,node-pty,@google/genai,protobufjs @deepseek-ai/dsh@0.1.0-rc.6
# 新开一个终端验证(全局安装只对新终端生效):
dsh --version && pnpm --version
```

### 1) 方式 A:官方命令安装(推荐)

```bash
dsh plugin --profile web add <本目录绝对路径>
```

`dsh plugin add` 只负责把包装进 profile 依赖(`pnpm add`),**不会**自动写入组合行 —— 确认 `$DSH_HOME/profiles/web/cordis.patch.yml` 里有该行,没有就追加:

```yaml
- insert:
    - id: plugin-manager
      name: '@dsh-external/dsh-plugin-manager'
```

### 2) 方式 B:手动拷贝(无 pnpm / 不想装依赖时)

与既有 `@dsh-external/*` 皮肤插件同一位置直接拷贝,再追加组合行:

```powershell
Copy-Item -Recurse <plugin-manager 绝对路径> "$env:DSH_HOME\profiles\node_modules\@dsh-external\dsh-plugin-manager"
# 然后编辑 $env:DSH_HOME\profiles\web\cordis.patch.yml 追加:
# - insert:
#     - id: plugin-manager
#       name: '@dsh-external/dsh-plugin-manager'
```

### 3) 重启 DSH(必做)

**安装或修改代码后必须重启 DSH 进程。** loader 对模块 URL 有 ESM 缓存,组合热重载不会重新导入已改动的插件代码 —— 只刷新页面不会生效。重启后:

- Host 以全新进程加载(注册 HTTP 路由 `/dsh-plugin-manager-api`);
- 客户端模块由启动时的全量扫描**确定性**进入页面清单;
- 打开 **设置 → 插件管理** 即可使用。

> 排障:页面提示 "HTTP 405" / 接口 404 基本就是没重启(旧进程还在,可查 `Get-NetTCPConnection -LocalPort 3080` 的进程启动时间)。

## 使用

- 搜索插件名或 id 快速过滤;
- 服务端插件切换后热重载即时生效,客户端插件(浏览器界面)需刷新页面 —— 插件会自动刷新;
- 删除 = 从 profile 补丁的 `- insert:` 列表中移除该行(仅对用户插入的插件可用),恢复需手动重新添加。

## 开发

- Host 端逻辑在 `lib/index.js`(补丁读写、保护名单、删除语义、HTTP 路由);
- Browser 端在 `lib/client.js`(React,`fetch('/dsh-plugin-manager-api')` 调用);
- 修改后重新安装依赖即可(本包无构建步骤,浏览器端直接以 ModuleLoader 格式加载)。

## License

MIT
