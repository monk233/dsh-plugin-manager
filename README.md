# dsh-plugin-manager

[Changelogs](Changelogs.md)

在 DeepSeek Harness **Web UI** 里直接管理 profile 插件:启用 / 禁用 / 删除组合行,自动热重载生效,不用手改配置文件。

<img width="1215" height="1210" alt="image" src="https://github.com/user-attachments/assets/fa7d29cd-58a7-4d8d-856d-985a64b726c0" />


## 使用

- 设置 → 插件管理:搜索、状态徽章、⋮ 菜单(启用/禁用/删除,禁用与删除二次确认,操作后自动刷新);
- 修改写入 `cordis.patch.yml`,HMR 热重载即时生效;核心组件受保护,内置插件只能禁用。

## 重要的事说三遍, 安装后一定要重启DSH服务!,  重启DSH服务!, 重启DSH服务!

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
```

### 方案二:让 AI 安装

使用DSH创造模式, 打开会话将下面这段话发给AI:

> 安装这个插件 https://github.com/monk233/dsh-plugin-manager.git

## 禁用

禁用dsh-plugin-manager后只能手动在配置文件中修改重启启用, 或者在dsh中让AI修改

## 删除

在dsh中让AI删除dsh-plugin-manager

## License

MIT
