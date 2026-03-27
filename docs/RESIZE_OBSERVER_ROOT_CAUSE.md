# ResizeObserver 错误根因分析

## 问题现象

在「选择数据集 → 点击分支下拉框」时，会触发 **ResizeObserver loop completed with undelivered notifications** 错误，并弹出带遮罩的错误弹窗。

## 调用链与根因

### 1. 触发链路

```
用户点击分支 Select
  → Popover 打开
  → Radix Popover 使用 @radix-ui/react-popper
  → Popper 使用 @floating-ui/react-dom 的 autoUpdate
  → autoUpdate 创建 ResizeObserver 观察 reference（触发器）和 floating（下拉内容）
  → 用户布局/样式导致 ResizeObserver 回调内触发布局变化
  → 布局变化产生新的 ResizeObserver 通知
  → 当前回调尚未结束，新通知无法在本帧交付
  → 浏览器抛出 "ResizeObserver loop completed with undelivered notifications"
```

### 2. 关键代码位置

#### floating-ui autoUpdate（`node_modules/@floating-ui/dom/dist/floating-ui.dom.esm.js`）

```javascript
// 第 410-422 行
resizeObserver = new ResizeObserver(_ref => {
  let [firstEntry] = _ref;
  if (firstEntry && firstEntry.target === referenceEl && resizeObserver) {
    // 防止 size middleware 导致的更新循环
    resizeObserver.unobserve(floating);
    cancelAnimationFrame(reobserveFrame);
    reobserveFrame = requestAnimationFrame(() => {
      resizeObserver && resizeObserver.observe(floating);
    });
  }
  update();  // 同步调用！会触发 computePosition → size middleware
});
```

- `update()` 在 ResizeObserver 回调中**同步**执行
- `update()` 会执行 `computePosition`，进而执行 `size` middleware

#### Radix Popper size middleware（`node_modules/@radix-ui/react-popper`）

```javascript
size({
  apply: ({ elements, rects }) => {
    contentStyle.setProperty("--radix-popper-available-width", ...);
    contentStyle.setProperty("--radix-popper-anchor-width", `${anchorWidth}px`);
    // ...
  }
})
```

- 在 floating 元素上设置 CSS 变量
- 会触发布局重算

#### PopoverContent（`web/libs/ui/src/shad/components/ui/popover.tsx`）

```tsx
className={cn("... min-w-full", className)}
```

- `min-w-full` 使内容最小宽度为父元素的 100%
- 父元素是 floating 容器，其宽度由内容决定
- 形成：**父宽度 ← 内容宽度 ← 内容 min-width(100% 父宽)**
- 在 ResizeObserver 回调中执行 `update()` → size middleware 改样式 → 布局变化 → 再次触发 ResizeObserver → 循环

### 3. 根因总结

| 层级 | 组件/库 | 作用 |
|------|---------|------|
| 1 | floating-ui `autoUpdate` | 用 ResizeObserver 观察 reference 和 floating，回调中同步调用 `update()` |
| 2 | Radix Popper `size` middleware | `update()` 中设置 floating 的 CSS 变量，触发布局 |
| 3 | PopoverContent `min-w-full` | 与父宽形成循环依赖，在布局变化时放大 ResizeObserver 循环 |

**本质**：ResizeObserver 回调内的同步布局修改，导致新的 ResizeObserver 通知在同一帧内产生，浏览器无法完成交付，从而报错。

## 修复方案

将 `min-w-full` 替换为 `min-w-[var(--radix-popper-anchor-width)]`：

- 使用 Popper 已设置的 `--radix-popper-anchor-width`（触发器宽度）
- 不再依赖 floating 元素自身宽度，打破循环依赖
- 仍保证下拉至少与触发器同宽

## 补充：单选项选择时的触发（数据集仅一个分支）

当**数据集只有一个分支**时，选择该分支会更容易触发错误，原因：

1. **同步更新**：`setValue(val)` 与 `setIsOpen(false)` 在同一回调中执行，React 会批量更新
2. **触发器立即变化**：触发器从 placeholder 变为选中值，触发 reference 的 ResizeObserver
3. **Popover 同时关闭**：floating 元素开始关闭动画，但 autoUpdate 仍在监听
4. **cmdk CommandList 的 ResizeObserver**：监听列表高度，选中态变化（如 `bg-primary-emphasis`）可能改变列表尺寸
5. **时序重叠**：reference 变化、floating 关闭、CommandList 高度变化在同一帧内触发多个 ResizeObserver 回调，形成循环

**修复**：将 `setIsOpen(false)` 延迟到下一帧执行，使触发器更新与 Popover 关闭分离，避免同一帧内多个 ResizeObserver 回调叠加。

## 其他 ResizeObserver 来源

- **cmdk CommandList**：监听 `cmdk-list-sizer`，设置 `--cmdk-list-height`（已用 rAF）
- `@radix-ui/react-use-size`：Popper 的 arrow 尺寸
- `rc-resize-observer`、`rc-virtual-list`：rc 组件
- 项目内：Dropdown、Typography、ImageView、SidePanels 等
