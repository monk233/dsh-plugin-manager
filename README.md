# dsh-plugin-manager

在 DeepSeek Harness **Web UI** 里直接管理 profile 插件:启用 / 禁用 / 删除组合行,自动热重载生效,**不用手改配置文件**。

- **设置 → 插件管理**:搜索、状态徽章、行尾 ⋮ 菜单(启用/禁用/删除,禁用/删除二次确认,操作后自动刷新页面);
- 修改写入 `$DSH_HOME/profiles/<profile>/cordis.patch.yml`,由 HMR 热重载即时生效;
- 核心组件(include/loader/hmr/timer 等)受保护不可切换;内置插件只能禁用,不能删除。

## 安装

### 🐌 懒人方案(推荐,不需要 dsh/pnpm)

```powershell
# 1) 拷贝到 profile 依赖区(与皮肤插件同位置)
Copy-Item -Recurse <本目录> "$env:DSH_HOME\profiles\node_modules\@dsh-external\dsh-plugin-manager"

# 2) 在 $env:DSH_HOME\profiles\web\cordis.patch.yml 末尾追加组合行
# - insert:
#     - id: plugin-manager
#       name: '@dsh-external/dsh-plugin-manager'

# 3) 重启 DSH
```

### 标准方案(官方 `dsh plugin`)

```bash
# 0) 准备命令(新终端生效)
npm install -g @deepseek-ai/dsh pnpm

# 1) 安装依赖
dsh plugin --profile web add <本目录>

# 2) 确认组合行存在(见上),没有就追加
# 3) 重启 DSH
```

> ⚠️ **安装或修改代码后必须重启 DSH** —— loader 对模块有 ESM 缓存,只刷新页面不会加载新代码。
> 排障:页面提示 "HTTP 405" / 接口 404 基本就是没重启(查 `Get-NetTCPConnection -LocalPort 3080` 的进程启动时间)。

## 卸载

1. 在 插件管理 里对该行点 **⋮ → 删除**,或手动从 `cordis.patch.yml` 移除组合行;
2. 可选:删除安装副本
   ```powershell
   Remove-Item -Recurse "$env:DSH_HOME\profiles\node_modules\@dsh-external\dsh-plugin-manager"
   ```
   源码仓库不受影响。

## 开发

```
plugin-manager/
├── lib/index.js     # Host:补丁读写 + HTTP JSON 路由 /dsh-plugin-manager-api
├── lib/client.js    # Browser:设置页 + shell.overlay 下拉菜单(fetch 调用)
├── cordis.patch.yml # bundle 补丁(自身组合行)
└── package.json     # dsh.client 声明 + exports ./client
```

- Host 与浏览器端通过 HTTP 路由通信(客户端 `ctx.remote` 命名空间是构建期固定的,运行时插件用不了);
- 修改后重新拷贝到安装位置 + 重启 DSH。

## License

MIT
