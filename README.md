# dsh-plugin-manager

在 DeepSeek Harness **Web UI** 里直接管理 profile 插件:启用 / 禁用 / 删除组合行,自动热重载生效,不用手改配置文件。

## 安装

### 方案一:官方(git clone + dsh)

```bash
# 1) 克隆仓库
git clone https://github.com/monk233/dsh-plugin-manager.git
cd dsh-plugin-manager

# 2) 准备命令(如未安装,新终端生效)
npm install -g @deepseek-ai/dsh pnpm

# 3) 安装到 web profile
dsh plugin --profile web add .

# 4) 在 $DSH_HOME/profiles/web/cordis.patch.yml 末尾追加组合行:
#    - insert:
#        - id: plugin-manager
#          name: '@dsh-external/dsh-plugin-manager'

# 5) 重启 DSH
```

### 方案二:让 AI 安装

把本仓库路径(或 URL)给任意 AI 助手,说一句:

> 按这个仓库 README 的安装步骤,把 dsh-plugin-manager 装进我的 web profile。

## 卸载

插件自带卸载功能:在 **设置 → 插件管理** 里对该行点 **⋮ → 删除** 即从组合中卸载,源码与已安装文件均保留。

## 使用

- 设置 → 插件管理:搜索、状态徽章、⋮ 菜单(启用/禁用/删除,禁用与删除二次确认,操作后自动刷新);
- 修改写入 `cordis.patch.yml`,HMR 热重载即时生效;核心组件受保护,内置插件只能禁用。

## License

MIT
