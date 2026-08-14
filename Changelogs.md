# Changelogs

## v0.1.0

- 初始版本：在 DeepSeek Harness Web UI 中管理 profile 插件（启用/禁用/删除）
- 设置 → 插件管理页面：搜索、状态徽章、操作菜单
- 内置插件保护：核心组件只能禁用，不能删除
- 操作后自动刷新页面生效

## Unreleased

- 修复操作菜单被设置面板（Settings 模态）遮挡的问题：下拉菜单改为渲染到 `document.body`（Portal）
