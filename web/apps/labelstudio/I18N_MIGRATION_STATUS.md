# 前端国际化迁移状态

## 已完成

### API 与系统配置
- **ApiConfig.js**: 已添加 `publicList`、`datasetBranches`、`systemConfig` 端点
- **Menubar.jsx**: 动态 logo（`systemConfig`）、语言切换按钮、菜单文案 i18n

### 创建项目与模板
- **CreateProject.jsx**: 步骤标题、表单项、按钮（createProject.*）
- **Config/Config.jsx**: 空配置占位、Label、ConfigureControl、Configurator（labelingConfig.*）、Template 传入 `t`
- **Config/TemplatesList.jsx**: 模板标题/分组翻译、自定义模板按钮
- **Config/Preview.jsx**: “UI Preview” 标题
- **Config/tags.js**: getOBJECTS/getCONTROLS 支持翻译键，DEFAULT_TITLES 回退
- **Import/ImportModal.jsx**: 标题、取消/导入按钮
- **ExportPage/ExportPage.jsx**: 标题、格式说明、导出按钮、反馈文案（export.*）

### 项目与首页
- **Projects.jsx**: 页面标题、上下文按钮（projects.title, menu.newProject）
- **ProjectsList.jsx**: 分页 label、空状态标题与按钮
- **HomePage.tsx**: 页面标题、欢迎文案、操作按钮（home.*, projects.*）

### 公共组件
- **Menubar.jsx**: 首页/项目/组织、固定菜单、快捷键、切换语言、账户/退出等（menu.*）
- **locales**: en.json、zh.json 已从 csghub 复制，含 login/menu/projects/home/organization/settings/labelingConfig/createProject/export/dataManager 等

## 已完成（本次迁移 + 第二轮）

### 预测 (Predictions)
- **PredictionsSettings.jsx**: 标题、预测列表、空状态、Learn more
- **PredictionsList.jsx**: 删除确认、最后创建时间、模型版本提示、Delete
- **ModelVersionSelector.jsx**: 选择提示、占位符、Models/Predictions 分组

### 存储 (Storage)
- **StorageSettings.jsx**: 云存储标题、描述、源/目标存储、添加按钮、云服务商名称
- **StorageForm.jsx**: 存储类型、连接成功/失败、检查连接、保存/添加
- **StorageSet.jsx**: 编辑/连接、源/目标、删除确认
- **StorageSummary.jsx**: 错误日志、See docs、状态、关闭、复制、未同步

### 机器学习表单
- **Forms.jsx**: 名称、URL、认证方式、基本认证、额外参数、交互式预标注、验证保存、错误提示

### Webhook
- **WebhookDeleteModal.jsx**: 删除确认标题、正文、取消、删除按钮

### 未保存更改
- **UnsavedChanges.tsx**: 保存并离开、标题、正文、取消、放弃并离开

### 数据管理
- **DataManager.jsx**: 崩溃提示、返回按钮、Settings/Labeling/Instructions 链接、错误消息（dataManager.*）

### 设置
- **GeneralSettings.jsx**: 标题、表单项、采样选项、保存按钮（settings.*）
- **AnnotationSettings.jsx**: 标题、标注说明、预标注、保存（settings.*）
- **DangerZone.jsx**: 危险区域标题、操作按钮、确认弹窗、成功提示（settings.*）
- **StorageCard.jsx**: 编辑/删除、同步存储、同步提示（storage.*）
- **MachineLearningSettings.jsx**: 模型标题、空状态、连接说明、配置、保存（machineLearning.*）
- **MachineLearningList.jsx**: 菜单项、状态标签、删除确认（machineLearning.*）

### 组织与人员
- **PeoplePage.jsx**: API令牌、添加成员按钮（organization.*）
- **PeopleList.jsx**: 列标题 Email/Name/Last Activity、User ID（organization.*）
- **InviteLink.tsx**: 邀请标题、描述、重置/复制按钮（organization.*）
- **SelectedUser.jsx**: 创建的项目、参与的项目、最后活动（organization.*）
- **EmptyList.tsx**: 创建模型标题与描述（models.*）

### Webhook
- **WebhookList.jsx**: 标题、描述、添加/编辑/删除、创建时间（webhooks.*）
- **WebhookDetail.jsx**: 表单标签、按钮、新建/编辑标题（webhooks.*）

## 待补全（可选）

### 其他组件
- `components/Breadcrumbs/Breadcrumbs.jsx`：面包屑文案若来自配置可保留，否则用 t()
- `components/SidebarMenu/SidebarMenu.jsx`：若有硬编码菜单项可改为 t()

### 导入页（可选细化）
- `pages/CreateProject/Import/Import.jsx`：大量文案（拖拽提示、文件类型、样本等），可逐步替换为 createProject.* / dataManager.*

## 使用方式

- 在组件中：`import { useTranslation } from "react-i18next";`，再 `const { t } = useTranslation();`，文案用 `t("key")` 或 `t("namespace.key")`。
- 新文案需在 `src/locales/en.json` 与 `src/locales/zh.json` 中补充对应 key。
- 语言切换在顶部菜单右侧地球图标，中/英切换会同步到 sessionStorage 与 URL 参数。
