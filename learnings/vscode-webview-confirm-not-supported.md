# VS Code Webview 中 `confirm()` 不可用

## 问题
在 VS Code 的 Webview 环境中，`confirm()` 函数被沙盒禁用，调用时不会显示弹窗，后续代码也不会执行。

## 解决方案
不能用 `confirm()`，需要在 webview 内自建一个确认弹窗：
1. 添加确认弹窗的 HTML（overlay + dialog）
2. 用 `classList.add('show')` 控制显示
3. 点击确认按钮后执行删除操作，点击遮罩/取消关闭

## 关键代码模式
```html
<!-- 确认弹窗 HTML -->
<div class="confirm-overlay" id="confirmOverlay">
  <div class="confirm-box">
    <p>确定要删除吗？</p>
    <div class="confirm-actions">
      <button class="btn-cancel" id="confirmCancel">取消</button>
      <button class="btn-danger" id="confirmDelete">确认删除</button>
    </div>
  </div>
</div>
```

```javascript
// 记录待删除 ID
let pendingDeleteId = null;

// 显示确认弹窗
pendingDeleteId = btn.dataset.id;
confirmOverlay.classList.add('show');

// 确认删除
confirmDelete.addEventListener('click', () => {
  if (pendingDeleteId) {
    // 执行删除逻辑
  }
  confirmOverlay.classList.remove('show');
  pendingDeleteId = null;
});
```
