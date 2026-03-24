# SVG 常量定义系统

## 概述

本文档定义了 wireframe-design 技能生成 SVG 时使用的所有常量值。这些常量确保所有线框图的一致性和可维护性。

**使用原则：**
- ✅ 所有数值必须来自本文档定义的常量
- ✅ 不得手动计算或猜测数值
- ✅ 需要新常量时，先添加到本文档，再使用

---

## 1. 画布尺寸

### iOS 设备
```
CANVAS_WIDTH_IOS = 375px
CANVAS_HEIGHT_IOS = 812px
```
- 基于 iPhone X/11/12/13/14 标准尺寸
- 适用于所有 iOS 线框图

### Android 设备
```
CANVAS_WIDTH_ANDROID = 360dp
CANVAS_HEIGHT_ANDROID = 640dp
```
- 基于 Android 标准尺寸
- 适用于大部分 Android 设备

### Web 应用
```
CANVAS_WIDTH_WEB = 375px
CANVAS_HEIGHT_WEB = 667px
```
- 基于移动端 Web 标准视口
- 适用于响应式设计

---

## 2. iOS 系统元素常量

### 状态栏（Status Bar）
```
STATUS_BAR_HEIGHT = 44px
STATUS_BAR_Y = 0px
STATUS_BAR_TEXT_Y = 28px        # 文字基线位置
STATUS_BAR_TEXT_SIZE = 12px
```

**完整状态栏片段：**
```xml
<!-- 状态栏 (44px) -->
<rect x="0" y="0" width="375" height="44" fill="none" stroke="#000" stroke-width="1"/>
<text x="20" y="28" font-size="12">9:41</text>
<text x="355" y="28" font-size="12" text-anchor="end">100%</text>
```

### 导航栏（Navigation Bar）
```
NAV_BAR_HEIGHT = 44px
NAV_BAR_Y = 44px                # 紧接状态栏
NAV_BAR_TITLE_Y = 73px          # 标题文字基线位置
NAV_BAR_TITLE_SIZE = 17px
NAV_BAR_BACK_BTN_X = 20px
NAV_BAR_BACK_BTN_Y = 56px
```

**计算说明：**
- 标题 Y 坐标 = STATUS_BAR_HEIGHT + NAV_BAR_HEIGHT / 2 + NAV_BAR_TITLE_SIZE * 0.35
- 73 = 44 + 44/2 + 17*0.35 = 44 + 22 + 5.95 ≈ 73

### 安全区（Safe Area）
```
SAFE_AREA_TOP = 88px            # STATUS_BAR_HEIGHT + NAV_BAR_HEIGHT
SAFE_AREA_BOTTOM = 34px         # iPhone X 底部指示器区域
CONTENT_START_Y = 88px          # 内容起始位置
CONTENT_WIDTH = 335px           # 375 - 20*2 (左右边距)
```

---

## 3. 表单元素常量

### 文本输入框（Input）
```
INPUT_HEIGHT = 48px
INPUT_PADDING_X = 16px          # 内边距
INPUT_TEXT_Y = 42px             # 文字基线位置（相对于输入框顶部）
INPUT_TEXT_SIZE = 16px
INPUT_PLACEHOLDER_SIZE = 14px
INPUT_PLACEHOLDER_COLOR = #999
INPUT_BORDER_RADIUS = 8px
```

**计算公式：**
```
INPUT_TEXT_Y = INPUT_HEIGHT / 2 + INPUT_TEXT_SIZE * 0.35
42 = 48/2 + 16*0.35 = 24 + 5.6 ≈ 42
```

### 标签文字（Label）
```
LABEL_HEIGHT = 20px
LABEL_TEXT_Y = 16px             # 文字基线位置（相对于标签顶部）
LABEL_TEXT_SIZE = 14px
LABEL_SPACING = 8px             # 标签和输入框之间的间距
```

### 按钮（Button）
```
BTN_HEIGHT = 48px
BTN_TEXT_Y = 30px               # 文字基线位置（相对于按钮顶部）
BTN_TEXT_SIZE = 16px
BTN_BORDER_RADIUS = 24px        # 完全圆角
BTN_SMALL_WIDTH = 100px         # 小按钮宽度（如验证码按钮）
BTN_HALF_WIDTH = 160px          # 半宽按钮
BTN_FULL_WIDTH = 335px          # 全宽按钮
```

**计算公式：**
```
BTN_TEXT_Y = BTN_HEIGHT / 2 + BTN_TEXT_SIZE * 0.35
30 = 48/2 + 16*0.35 = 24 + 5.6 ≈ 30
```

### 复选框（Checkbox）
```
CHECKBOX_SIZE = 18px
CHECKBOX_TEXT_Y = 14px          # 文字基线位置（相对于复选框顶部）
CHECKBOX_TEXT_SIZE = 12px
CHECKBOX_TEXT_SPACING = 8px     # 复选框和文字之间的间距
```

**计算公式：**
```
CHECKBOX_TEXT_Y = CHECKBOX_SIZE / 2 + CHECKBOX_TEXT_SIZE * 0.35
14 = 18/2 + 12*0.35 = 9 + 4.2 ≈ 14
```

---

## 4. 间距系统

### 屏幕边距
```
MARGIN_SCREEN = 20px            # 屏幕左右边距
MARGIN_TOP = 24px               # 内容区顶部边距
MARGIN_BOTTOM = 24px            # 内容区底部边距
```

### 垂直间距
```
SPACING_XS = 4px                # 极小间距（如图标和文字）
SPACING_SM = 8px                # 小间距（如标签和输入框）
SPACING_MD = 16px               # 中等间距（如段落之间）
SPACING_LG = 24px               # 大间距（如区块之间）
SPACING_XL = 32px               # 超大间距（如主要内容区块）
```

### 表单专用间距
```
GAP_FORM = 88px                 # 标准表单项之间的间距
GAP_LABEL_INPUT = 8px           # 标签和输入框之间的间距
GAP_INPUT_HINT = 4px            # 输入框和提示文字之间的间距
```

**GAP_FORM 计算说明：**
```
GAP_FORM = LABEL_HEIGHT + LABEL_SPACING + INPUT_HEIGHT + SPACING_MD
88 = 20 + 8 + 48 + 12
```

**使用示例：**
```xml
<!-- 第一个输入框 -->
<text x="20" y="112">用户名</text>                      <!-- 标签 -->
<rect x="20" y="120" width="335" height="48"/>        <!-- 输入框 -->
<text x="36" y="162">请输入用户名</text>                <!-- 占位符 -->

<!-- 第二个输入框（Y 坐标 = 112 + 88 = 200） -->
<text x="20" y="200">密码</text>                        <!-- 标签 -->
<rect x="20" y="208" width="335" height="48"/>        <!-- 输入框 -->
<text x="36" y="250">请输入密码</text>                  <!-- 占位符 -->
```

---

## 5. 布局常量

### 两列布局
```
COL_GAP = 15px                  # 列间距
COL_1_X = 20px                  # 第一列起始位置
COL_1_WIDTH = 160px             # 第一列宽度
COL_2_X = 195px                 # 第二列起始位置 (20 + 160 + 15)
COL_2_WIDTH = 160px             # 第二列宽度
```

**验证公式：**
```
COL_1_WIDTH + COL_GAP + COL_2_WIDTH = 160 + 15 + 160 = 335px ✓
```

### 验证码输入框布局
```
VERIFY_INPUT_WIDTH = 235px      # 验证码输入框宽度
VERIFY_BTN_X = 260px            # 验证码按钮起始位置 (20 + 235 + 5)
VERIFY_BTN_WIDTH = 95px         # 验证码按钮宽度
VERIFY_GAP = 5px                # 输入框和按钮之间的间距
```

**验证公式：**
```
VERIFY_INPUT_WIDTH + VERIFY_GAP + VERIFY_BTN_WIDTH = 235 + 5 + 95 = 335px ✓
```

---

## 6. 字体和排版

### 字体大小
```
FONT_SIZE_H1 = 28px             # 大标题
FONT_SIZE_H2 = 22px             # 副标题
FONT_SIZE_H3 = 17px             # 小标题 / 导航栏标题
FONT_SIZE_BODY = 16px           # 正文 / 输入框文字 / 按钮文字
FONT_SIZE_LABEL = 14px          # 标签文字
FONT_SIZE_CAPTION = 12px        # 辅助文字 / 状态栏文字
FONT_SIZE_SMALL = 10px          # 极小文字
```

### 行高
```
LINE_HEIGHT_H1 = 36px
LINE_HEIGHT_H2 = 28px
LINE_HEIGHT_BODY = 24px
LINE_HEIGHT_CAPTION = 18px
```

---

## 7. 核心计算公式

### 公式 1：文字垂直居中
```
text_y = container_y + container_height / 2 + font_size * 0.35
```

**适用场景：** 在矩形容器（如输入框、按钮）中垂直居中文字

**示例：**
```
输入框文字 Y 坐标 = 120 + 48/2 + 16*0.35 = 120 + 24 + 5.6 = 149.6 ≈ 150
按钮文字 Y 坐标 = 300 + 48/2 + 16*0.35 = 300 + 24 + 5.6 = 329.6 ≈ 330
```

### 公式 2：小字体垂直居中
```
text_y = container_y + container_height / 2 + font_size * 0.33
```

**适用场景：** 字体小于 14px 时（如复选框文字、辅助文字）

**示例：**
```
复选框文字 Y 坐标 = 400 + 18/2 + 12*0.33 = 400 + 9 + 3.96 = 412.96 ≈ 413
```

### 公式 3：下一个表单项 Y 坐标
```
next_y = current_label_y + LABEL_HEIGHT + LABEL_SPACING + INPUT_HEIGHT + SPACING_MD
next_y = current_label_y + 20 + 8 + 48 + 12 = current_label_y + 88
```

**适用场景：** 计算表单中下一个输入框的位置

**示例：**
```
第一个标签 y=112
第二个标签 y=112 + 88 = 200
第三个标签 y=200 + 88 = 288
```

---

## 8. 使用指南

### 快速查找常量

**需要状态栏？**
→ `STATUS_BAR_HEIGHT = 44px`, `STATUS_BAR_TEXT_Y = 28px`

**需要导航栏？**
→ `NAV_BAR_HEIGHT = 44px`, `NAV_BAR_TITLE_Y = 73px`

**需要输入框？**
→ `INPUT_HEIGHT = 48px`, `INPUT_TEXT_Y = 42px`

**需要按钮？**
→ `BTN_HEIGHT = 48px`, `BTN_TEXT_Y = 30px`

**需要计算表单间距？**
→ `GAP_FORM = 88px`

### 常见任务速查表

| 任务 | 常量 | 值 |
|------|------|-----|
| 创建 iOS 画布 | `CANVAS_WIDTH_IOS` × `CANVAS_HEIGHT_IOS` | 375×812 |
| 添加状态栏 | `STATUS_BAR_HEIGHT` | 44px |
| 添加导航栏 | `NAV_BAR_HEIGHT` | 44px |
| 内容起始位置 | `SAFE_AREA_TOP` | 88px |
| 内容宽度 | `CONTENT_WIDTH` | 335px |
| 屏幕边距 | `MARGIN_SCREEN` | 20px |
| 输入框高度 | `INPUT_HEIGHT` | 48px |
| 按钮高度 | `BTN_HEIGHT` | 48px |
| 表单间距 | `GAP_FORM` | 88px |

### 检查命令

**检查状态栏高度是否一致：**
```bash
grep -E '<rect.*y="0".*height="44"' *.svg
```

**检查输入框高度是否一致：**
```bash
grep -E 'height="48"' *.svg
```

**检查文字 Y 坐标分布：**
```bash
grep -oE 'y="[0-9]+"' *.svg | sort | uniq -c
```

---

## 9. 版本历史

- **v1.0** (2026-01-19): 初始版本，定义核心常量和计算公式
