# 国际化修改未生效排查指南

当修改国际化相关代码后未看到效果时，请按以下步骤排查。

## ⚠️ 最关键：确认访问方式与构建

Label Studio 有两种运行模式，**修改未生效最常见原因是访问了静态构建版本**：

| 访问地址 | 前端来源 | 修改生效方式 |
|----------|----------|--------------|
| **http://localhost:8080** | Django 提供的**预构建静态文件** | 必须执行 `yarn build` + `collectstatic` |
| **http://localhost:8010** | Webpack 开发服务器（HMR） | 修改后热更新，或重启 `yarn dev` |

### 若你通过 8080 访问（Django 模式）

修改前端代码后**必须重新构建**：

```bash
# 1. 构建前端
cd web
yarn build
# 或仅构建 labelstudio: yarn ls:build

# 2. 收集静态文件到 Django
cd ..
python label_studio/manage.py collectstatic --no-input

# 3. 重启 Django 服务
# 然后刷新浏览器 (Cmd+Shift+R 强制刷新)
```

### 若你通过 8010 访问（HMR 开发模式）

1. 确保项目根目录有 `.env`，且包含：
   ```
   FRONTEND_HMR=true
   FRONTEND_HOSTNAME=http://localhost:8010
   ```
2. 同时运行两个进程：
   - 终端 1: `make frontend-dev` 或 `cd web && yarn dev`（前端）
   - 终端 2: `make run-dev` 或 `label-studio`（Django 后端）
3. 仅通过 **http://localhost:8010** 访问页面

## 1. 清除浏览器缓存

- **Chrome/Edge**: `Cmd+Shift+R` (Mac) 或 `Ctrl+Shift+R` (Windows) 强制刷新
- 或打开开发者工具 → Network → 勾选 "Disable cache" 后刷新

## 2. 切换语言验证

- 在界面中切换语言（如 设置 → 语言）
- 刷新页面后检查当前语言是否正确
- Data Manager 的文案会随语言切换实时更新（已修复语言切换不刷新的问题）

## 3. 检查 i18n 配置

- 确认 `apps/labelstudio/src/config/i18n.ts` 已正确配置
- 确认 `main.tsx` 中已引入 i18n 初始化
- 翻译 key 需存在于 `locales/en.json` 和 `locales/zh.json` 中

## 4. 项目结构说明

- **labelstudio** 使用 `tsconfig.base.json` 中的路径映射，直接引用 `libs/datamanager/src` 源码
- 运行 `yarn ls:dev` 时，Webpack 会打包 datamanager 源码，**无需**单独运行 `yarn dm:watch`
- 修改 datamanager 代码后，热更新 (HMR) 应自动生效；若无，请重启开发服务器

## 5. 常见问题

| 现象 | 可能原因 | 解决方式 |
|------|----------|----------|
| 修改后完全无变化 | 访问的是 8080 的静态构建 | 执行 `yarn build` + `collectstatic` 后刷新 |
| 文案仍为英文 key（如 dataManager.columns） | 翻译 key 未添加或语言未切换 | 在 `zh.json` 中添加 key，或在界面切换为中文 |
| 切换语言后 Data Manager 未更新 | 旧版本未包含语言切换修复 | 确保已应用最新代码并重新构建 |
| 控制台报 `t is not defined` | 组件未正确获取 t 函数 | 检查 inject 是否使用 `store?.t` |
