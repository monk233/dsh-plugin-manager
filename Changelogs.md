# Changelogs

## v0.2.0

- 修复禁用/启用插件后 `cordis.patch.yml` 出现重复配置行的问题
- 修复删除 `- insert:` 下的插件时属性行（`name:` 等）残留导致 YAML 损坏的问题

## v0.1.0

- 初始版本：在 DeepSeek Harness Web UI 中管理 profile 插件（启用/禁用/删除）
- 设置 → 插件管理页面：搜索、状态徽章、操作菜单
- 内置插件保护：核心组件只能禁用，不能删除
- 操作后自动刷新页面生效
