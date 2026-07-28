# 补充修改：数据透视表文字过小，必须明显放大

当前"数据透视表"区域内的文字太小，阅读困难。请重点修改这个表格区域的字体、行高和单元格内边距，让它在桌面端清晰易读。

## 一、必须放大的内容

以下内容都要放大，不要只放大局部：

1. 表格标题区域：
   - "数据视图"
   - "数据透视表"
   - "复制表格"
   - "导出 CSV"

2. 表头文字：
   - "维度"
   - 各年份，如"1894年、1896年、1897年……"
   - "合计"

3. 表格正文文字：
   - 左侧人名 / 维度名称，如"易培基、吴庆坻、叶昌炽"等
   - 单元格中的数字
   - 单元格中的破折号"—"

4. 表格底部合计行：
   - "合计"
   - 各列总数
   - 右下角总数"306"

## 二、明确字号要求

不要模糊处理，直接按下面的级别修改：

```css
.data-view-label {
  font-size: 18px;
  line-height: 1.5;
}

.data-view-title {
  font-size: 28px;
  line-height: 1.4;
  font-weight: 600;
}

.data-view-action-btn {
  font-size: 18px;
  line-height: 1.4;
  min-height: 56px;
  padding: 0 24px;
}

.pivot-table {
  font-size: 18px;
  line-height: 1.5;
}

.pivot-table th {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.5;
}

.pivot-table td {
  font-size: 18px;
  line-height: 1.5;
}

.pivot-table .row-label {
  font-size: 18px;
  font-weight: 600;
}

.pivot-table .total-row td,
.pivot-table .total-row th {
  font-size: 18px;
  font-weight: 600;
}
```

如果当前页面整体字号偏小，也可以适当再提高到：

- 标题"数据透视表"：`30px`
- 表格文字：`18px ~ 20px`

但不要低于以下标准：

- 表头最小 `18px`
- 正文最小 `18px`

## 三、同步调整行高和内边距

仅仅把字体调大还不够，否则会显得拥挤。

请同步修改：

```css
.pivot-table th,
.pivot-table td {
  padding: 22px 24px;
  vertical-align: middle;
  white-space: nowrap;
}

.pivot-table tr {
  min-height: 72px;
}
```

要求：

1. 每一行高度明显增加，不要还是现在这种又密又挤的效果。
2. 文字必须垂直居中。
3. 左侧"维度/人名列"与数字列保持统一节奏。
4. 表头高度也要增加，不能只放大字、表头却还是很矮。

## 四、第一列和合计列要更清楚

当前左侧名称列和右侧合计列需要更清晰：

```css
.pivot-table th:first-child,
.pivot-table td:first-child {
  min-width: 220px;
  font-size: 18px;
  font-weight: 600;
}

.pivot-table th:last-child,
.pivot-table td:last-child {
  min-width: 90px;
  font-size: 18px;
  font-weight: 600;
}
```

要求：

1. 第一列不要太窄，避免名字显得局促。
2. "合计"列要清晰，不要显得比中间数字还弱。
3. 最后一列数字和"306"要更醒目，但不要破坏整体古典风格。

## 五、保持现有风格，不要乱改样式

请注意：

1. 保留当前米白色背景、灰褐色边框、深蓝/深灰文字的整体风格。
2. 不要改成现代高饱和表格。
3. 不要删掉表格边框。
4. 不要改变表格结构和数据逻辑。
5. 不要把"复制表格 / 导出 CSV"改成很夸张的大按钮，只需要和整体字号协调即可。

## 六、验收标准

修改完成后，必须满足以下标准：

1. 用户在 100% 缩放下能明显看清表格内容。
2. 表头年份不再显得过小。
3. 左侧人名 / 维度名称清晰易读。
4. 数字和破折号不再显得细小。
5. 合计行和右侧总数更清楚。
6. 放大后不出现文字重叠、行高塌陷、列宽错位。
7. 保持横向滚动功能正常。
8. 视觉上仍然保持当前古典、克制、干净的风格。
