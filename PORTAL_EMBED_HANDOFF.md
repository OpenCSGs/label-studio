# Label Studio Portal 嵌入改造交接

## 目标

将 Label Studio 嵌入 Portal 的 iframe：隐藏 LS 顶部全局菜单，保留项目页面必要操作，将主色调整为金色 `#C7921C`。现阶段沿用既有 Portal → Dataflow → LS 模拟登录链路，不修改 Dataflow 和 LS 登录接口。

## 仓库与分支

- 仓库：`https://github.com/OpenCSGs/label-studio.git`
- 分支：`wl/portal-embed`
- 功能提交：`5b539c6 feat: adapt Label Studio UI for portal embedding`
- 当前功能分支基于 `origin/zk-from-v2.2.1`（`f3c3090`）重放 Portal 相关提交，不引入 main 独有的改动。

## 已完成修改

1. `web/apps/labelstudio/src/app/RootPage.jsx`
   - 禁用全局 Menubar。
   - 不再读取或保存侧栏展开、固定状态。

2. `web/apps/labelstudio/src/components/Menubar/Menubar.jsx`
   - Menubar 隐藏时，在页面内容区域渲染右侧上下文操作。
   - “新建”“设置”等操作保留并统一居右。
   - 不渲染左侧面包屑/标题操作区。

3. `web/apps/labelstudio/src/app/App.scss`
   - 页面头部高度设为 `0px`。
   - 主色以及 hover、active、border、focus 等相关颜色切换为金色系，主色为 `#C7921C`。
   - 增加 `.portal-page-actions`，操作按钮右对齐。

## 登录链路约定

登录功能没有修改，继续使用现有接口：

1. Portal 调用 Dataflow，获取 LS 地址和现有用户信息/Token。
2. Portal 浏览器调用 LS 的 `POST /user/login_verfy/` 建立 Session。
3. iframe 加载 `/user/login_reques/`，随后进入 `/projects/`。

Dataflow 保持原逻辑。本次不要改造为一次性票据，也不要把长期 Token 放进 iframe URL。

## 跨域注意事项

本地联调通过同源反向代理验证，正式跨域尚未完成验证。

最快且最稳定的部署方式是由 Portal 网关将 LS 暴露为 Portal 同域子路径，例如：

- Portal：`https://portal.example.com/`
- LS：`https://portal.example.com/-/label-studio/`

如果测试环境必须使用不同站点，需要检查：

- `SESSION_COOKIE_SAMESITE=None`
- `SESSION_COOKIE_SECURE=1`
- `CSRF_COOKIE_SAMESITE=None`
- `CSRF_COOKIE_SECURE=1`
- `CORS_ALLOWED_ORIGINS` 包含 Portal 地址
- `CSRF_TRUSTED_ORIGINS` 包含 Portal 地址
- 增加/确认 `CORS_ALLOW_CREDENTIALS=True`
- 网关不能返回阻止 iframe 的 `X-Frame-Options`，CSP `frame-ancestors` 应允许 Portal

完全跨站 iframe 仍可能被浏览器第三方 Cookie 策略阻止，因此优先使用同域反向代理。

## 已完成验证

- 已执行 Label Studio 前端 production build。
- Nx 构建成功，仅有项目原有的 Browserslist、Sass 弃用和本地 yarn PATH 警告。
- 本地验证过模拟登录、Session 校验和 iframe 加载。
- 日志文件、Nx 缓存和本地联调工具未纳入正式提交。

## 后续工作

1. 在 Windows 开发机拉取 `wl/portal-embed`。
2. 运行前端构建并启动 LS，复核项目列表、新建项目和项目设置页的操作按钮位置。
3. 使用真实测试 Portal/Dataflow 地址验证现有登录链路。
4. 根据部署域名决定使用同域反向代理，或补充跨域 Cookie/CORS 配置。
5. 验证完成后创建 PR 合并到目标分支。

## 本轮补充：iframe 跨域支持

- 新增 `PORTAL_ALLOWED_ORIGINS` 配置，填写 Portal 的完整 Origin（协议、域名、端口，不含路径），多个值以逗号分隔。
- 配置后自动启用携带凭据的 CORS、CSRF 可信来源、`SameSite=None; Secure` Session/CSRF Cookie。
- 新增 iframe 白名单中间件，设置强制执行的 CSP `frame-ancestors`，保留其他 CSP 指令，并移除应用生成的冲突 X-Frame-Options。
- 未设置时保持原有行为；目前 Portal 地址未确认，尚未在当前服务启用。
- 部署参数示例：`deploy/portal-embed.env.example`；Docker Compose 通过 `PORTAL_ALLOWED_ORIGINS` 配置来源。
- 不修改现有 Dataflow/LS 登录接口。真实 Portal、网关响应头及浏览器第三方 Cookie 策略仍需联调。
