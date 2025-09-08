# Tab切换测试指南

## 修复内容
1. **FileSessionProvider**：添加了localStorage持久化，确保在tab切换时保持状态
2. **upload-optimized.tsx**：
   - 区分页面刷新和tab切换
   - 页面刷新时清除数据
   - tab切换时恢复数据
   - 保持FileSessionProvider的状态

## 测试步骤

### 1. 基础功能测试
- 打开 http://localhost:3000
- 上传 Detail_report.csv
- 等待分析完成
- 验证分析结果显示正常

### 2. Tab切换测试
- 在"上传数据"tab看到文件和分析结果
- 切换到"数据分析"tab
- 验证数据显示正常
- 切换到"高级分析"tab
- 验证数据显示正常
- 切换回"上传数据"tab
- **验证**：文件和分析结果应该仍然显示

### 3. 页面刷新测试
- 在任何tab按F5刷新页面
- **验证**：所有数据应该被清除，显示初始状态

### 4. 重新上传测试
- 上传新文件
- **验证**：旧数据被清除，新数据分析结果显示

## 关键修复点
- 使用 `performance.getEntriesByType('navigation')` 检测页面刷新
- FileSessionProvider 的状态独立持久化
- upload组件的状态在tab切换时保持，页面刷新时清除