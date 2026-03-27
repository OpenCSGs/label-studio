# CSGHub 与 1.22.0 对比：ResizeObserver 错误

## 结论：CSGHub 不触发错误的原因

CSGHub 的 Select 实现更简单，与 1.22.0 存在以下关键差异。

## 差异对比

### 1. Popover onOpenChange

| 版本 | 实现 |
|------|------|
| **CSGHub** | `onOpenChange={setIsOpen}` |
| **1.22.0** | `onOpenChange={(_isOpen) => { setIsOpen(_isOpen); _isOpen ? onOpen?.() : onClose?.(); }}` |

CSGHub 直接透传 `setIsOpen`，1.22.0 在关闭时额外调用 `onClose?.()`。

### 2. 选择后关闭时机

| 版本 | 实现 |
|------|------|
| **CSGHub** | `!multiple && setIsOpen(false)`（同步关闭） |
| **1.22.0** | `requestAnimationFrame(() => { setIsOpen(false); onClose?.(); })`（延迟关闭） |

CSGHub 为同步关闭，1.22.0 当前为延迟关闭（之前为修复尝试）。

### 3. 1.22.0 独有功能

- `isVirtualList`、`VariableSizeList`、`InfiniteLoader`、`react-window`
- `onOpen`、`onClose` 回调
- `selectedOptions` 使用 Map 去重
- Option 标签：`min-w-0 truncate`（CSGHub 为 `w-full`）
- `renderedOptions` useMemo 与条件渲染

### 4. PopoverContent

两者均为 `min-w-full`，无差异。

## 建议：对齐 CSGHub 实现

将 1.22.0 的 Select 调整为与 CSGHub 一致，以复现其不触发错误的行为：

1. **Popover**：改为 `onOpenChange={setIsOpen}`（Import 未使用 onOpen/onClose）
2. **_onChange**：改为 `!multiple && setIsOpen(false)`（同步关闭）

若 Import 页面需要 `onClose`，可在调用处自行处理，而不是在 Select 内部统一调用。
