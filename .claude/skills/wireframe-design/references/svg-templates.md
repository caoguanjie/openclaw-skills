# SVG 模板库

## 概述

本文档提供可复用的 SVG 模板片段，用于快速构建线框图。所有模板使用 `svg-constants.md` 中定义的常量，确保一致性。

**使用方法：**
1. 复制所需模板片段
2. 根据实际需求调整 Y 坐标
3. 修改文字内容
4. 保持数值常量不变

---

## 1. 基础页面模板

### iOS 完整页面模板（375×812）
```xml
<svg width="375" height="812" xmlns="http://www.w3.org/2000/svg">
  <!-- 定义样式 -->
  <style>
    text {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 16px;
      fill: #000;
    }
  </style>

  <!-- 状态栏 (44px) -->
  <rect x="0" y="0" width="375" height="44" fill="none" stroke="#000" stroke-width="1"/>
  <text x="20" y="28" font-size="12">9:41</text>
  <text x="355" y="28" font-size="12" text-anchor="end">100%</text>

  <!-- 导航栏 (44px) -->
  <rect x="0" y="44" width="375" height="44" fill="none" stroke="#000" stroke-width="1"/>
  <text x="187.5" y="73" font-size="17" text-anchor="middle">页面标题</text>

  <!-- 内容区域 (从 y=88 开始) -->
  <!-- 在这里添加页面内容 -->

  <!-- 底部指示器 (可选) -->
  <rect x="127.5" y="778" width="120" height="5" rx="2.5" fill="none" stroke="#000" stroke-width="1"/>
</svg>
```

**使用说明：**
- 直接复制作为新页面的起始模板
- 修改导航栏标题文字
- 在 `<!-- 内容区域 -->` 注释后添加具体内容
- 内容起始 Y 坐标 = 88px（`SAFE_AREA_TOP`）

---

## 2. 系统组件模板

### 2.1 状态栏（44px）
```xml
<!-- 状态栏 -->
<rect x="0" y="0" width="375" height="44" fill="none" stroke="#000" stroke-width="1"/>
<text x="20" y="28" font-size="12">9:41</text>
<text x="355" y="28" font-size="12" text-anchor="end">100%</text>
```

**常量说明：**
- 高度：`STATUS_BAR_HEIGHT = 44px`
- 文字 Y 坐标：`STATUS_BAR_TEXT_Y = 28px`
- 字体大小：`FONT_SIZE_CAPTION = 12px`

### 2.2 导航栏（带返回按钮）
```xml
<!-- 导航栏（带返回按钮） -->
<rect x="0" y="44" width="375" height="44" fill="none" stroke="#000" stroke-width="1"/>
<!-- 返回按钮 -->
<polyline points="30,56 20,66 30,76" fill="none" stroke="#000" stroke-width="2"/>
<text x="35" y="73" font-size="17">返回</text>
<!-- 标题 -->
<text x="187.5" y="73" font-size="17" text-anchor="middle">页面标题</text>
```

**常量说明：**
- 高度：`NAV_BAR_HEIGHT = 44px`
- 标题 Y 坐标：`NAV_BAR_TITLE_Y = 73px`
- 返回按钮 X 坐标：`NAV_BAR_BACK_BTN_X = 20px`
- 字体大小：`FONT_SIZE_H3 = 17px`

### 2.3 导航栏（无返回按钮）
```xml
<!-- 导航栏（无返回按钮） -->
<rect x="0" y="44" width="375" height="44" fill="none" stroke="#000" stroke-width="1"/>
<text x="187.5" y="73" font-size="17" text-anchor="middle">页面标题</text>
```

### 2.4 底部指示器（iPhone X 系列）
```xml
<!-- 底部指示器 -->
<rect x="127.5" y="778" width="120" height="5" rx="2.5" fill="none" stroke="#000" stroke-width="1"/>
```

**位置计算：**
- Y 坐标 = `CANVAS_HEIGHT_IOS - SAFE_AREA_BOTTOM = 812 - 34 = 778px`
- 居中 X 坐标 = `(375 - 120) / 2 = 127.5px`

---

## 3. 表单组件模板

### 3.1 文本输入框（标准）
```xml
<!-- 文本输入框（Y_BASE 为起始位置，如 112） -->
<!-- 标签 -->
<text x="20" y="Y_BASE" font-size="14">标签文字</text>
<!-- 输入框 -->
<rect x="20" y="Y_BASE+8" width="335" height="48" rx="8" fill="none" stroke="#000" stroke-width="1"/>
<!-- 占位符文字 -->
<text x="36" y="Y_BASE+42" font-size="14" fill="#999">请输入内容</text>
```

**模板变量：**
- `Y_BASE`：标签起始 Y 坐标（如 112, 200, 288...）
- `Y_BASE+8`：输入框 Y 坐标 = `Y_BASE + LABEL_SPACING`
- `Y_BASE+42`：文字 Y 坐标 = `Y_BASE + 8 + INPUT_TEXT_Y`

**常量说明：**
- 输入框宽度：`CONTENT_WIDTH = 335px`
- 输入框高度：`INPUT_HEIGHT = 48px`
- 圆角：`INPUT_BORDER_RADIUS = 8px`
- 左边距：`MARGIN_SCREEN = 20px`
- 文字内边距：`INPUT_PADDING_X = 16px`（所以文字 x = 20 + 16 = 36）

**使用示例：**
```xml
<!-- 用户名输入框（Y_BASE = 112） -->
<text x="20" y="112" font-size="14">用户名</text>
<rect x="20" y="120" width="335" height="48" rx="8" fill="none" stroke="#000" stroke-width="1"/>
<text x="36" y="154" font-size="14" fill="#999">请输入用户名</text>
```

### 3.2 密码输入框（带眼睛图标）
```xml
<!-- 密码输入框（Y_BASE 为起始位置） -->
<!-- 标签 -->
<text x="20" y="Y_BASE" font-size="14">密码</text>
<!-- 输入框 -->
<rect x="20" y="Y_BASE+8" width="335" height="48" rx="8" fill="none" stroke="#000" stroke-width="1"/>
<!-- 占位符文字 -->
<text x="36" y="Y_BASE+42" font-size="14" fill="#999">••••••••</text>
<!-- 眼睛图标（右侧） -->
<circle cx="330" cy="Y_BASE+32" r="8" fill="none" stroke="#000" stroke-width="1"/>
<circle cx="330" cy="Y_BASE+32" r="4" fill="#000"/>
```

**图标位置计算：**
- 眼睛圆心 X = `20 + 335 - 25 = 330px`（距离右边 25px）
- 眼睛圆心 Y = `Y_BASE + 8 + INPUT_HEIGHT/2 = Y_BASE + 32px`

**使用示例：**
```xml
<!-- 密码输入框（Y_BASE = 200） -->
<text x="20" y="200" font-size="14">密码</text>
<rect x="20" y="208" width="335" height="48" rx="8" fill="none" stroke="#000" stroke-width="1"/>
<text x="36" y="242" font-size="14" fill="#999">••••••••</text>
<circle cx="330" cy="232" r="8" fill="none" stroke="#000" stroke-width="1"/>
<circle cx="330" cy="232" r="4" fill="#000"/>
```

### 3.3 手机号输入框（带国家代码）
```xml
<!-- 手机号输入框（Y_BASE 为起始位置） -->
<!-- 标签 -->
<text x="20" y="Y_BASE" font-size="14">手机号</text>
<!-- 输入框 -->
<rect x="20" y="Y_BASE+8" width="335" height="48" rx="8" fill="none" stroke="#000" stroke-width="1"/>
<!-- 国家代码 -->
<text x="36" y="Y_BASE+42" font-size="14">+86</text>
<!-- 分隔线 -->
<line x1="75" y1="Y_BASE+18" x2="75" y2="Y_BASE+46" stroke="#000" stroke-width="1"/>
<!-- 占位符文字 -->
<text x="85" y="Y_BASE+42" font-size="14" fill="#999">请输入手机号</text>
```

**使用示例：**
```xml
<!-- 手机号输入框（Y_BASE = 112） -->
<text x="20" y="112" font-size="14">手机号</text>
<rect x="20" y="120" width="335" height="48" rx="8" fill="none" stroke="#000" stroke-width="1"/>
<text x="36" y="154" font-size="14">+86</text>
<line x1="75" y1="130" x2="75" y2="158" stroke="#000" stroke-width="1"/>
<text x="85" y="154" font-size="14" fill="#999">请输入手机号</text>
```

### 3.4 验证码输入框（带发送按钮）⚠️ 关键对齐点
```xml
<!-- 验证码输入框（Y_BASE 为起始位置） -->
<!-- 标签 -->
<text x="20" y="Y_BASE" font-size="14">验证码</text>

<!-- 输入框（235px 宽） -->
<rect x="20" y="Y_BASE+8" width="235" height="48" rx="8" fill="none" stroke="#000" stroke-width="1"/>
<!-- 输入框占位符文字（关键：Y 坐标必须 = Y_BASE+42） -->
<text x="36" y="Y_BASE+42" font-size="14" fill="#999">请输入验证码</text>

<!-- 发送按钮（95px 宽，起始 x=260） -->
<rect x="260" y="Y_BASE+8" width="95" height="48" rx="24" fill="none" stroke="#000" stroke-width="1"/>
<!-- 按钮文字（关键：Y 坐标必须 = Y_BASE+42，与输入框文字对齐） -->
<text x="307.5" y="Y_BASE+42" font-size="14" text-anchor="middle">获取验证码</text>
```

**⚠️ 对齐关键点：**
- 输入框文字 Y 坐标 = `Y_BASE + 42`
- 按钮文字 Y 坐标 = `Y_BASE + 42`（**必须相同！**）
- 两个文字的 Y 坐标必须一致，确保视觉对齐

**常量说明：**
- 输入框宽度：`VERIFY_INPUT_WIDTH = 235px`
- 按钮起始位置：`VERIFY_BTN_X = 260px`
- 按钮宽度：`VERIFY_BTN_WIDTH = 95px`
- 间距：`VERIFY_GAP = 5px`
- 验证：`235 + 5 + 95 = 335px` ✓

**使用示例：**
```xml
<!-- 验证码输入框（Y_BASE = 288） -->
<text x="20" y="288" font-size="14">验证码</text>
<rect x="20" y="296" width="235" height="48" rx="8" fill="none" stroke="#000" stroke-width="1"/>
<text x="36" y="330" font-size="14" fill="#999">请输入验证码</text>
<rect x="260" y="296" width="95" height="48" rx="24" fill="none" stroke="#000" stroke-width="1"/>
<text x="307.5" y="330" font-size="14" text-anchor="middle">获取验证码</text>
```

### 3.5 复选框（带文字）
```xml
<!-- 复选框（Y_BASE 为起始位置） -->
<!-- 复选框 -->
<rect x="20" y="Y_BASE" width="18" height="18" rx="3" fill="none" stroke="#000" stroke-width="1"/>
<!-- 复选框文字 -->
<text x="46" y="Y_BASE+14" font-size="12">记住密码</text>
```

**常量说明：**
- 复选框大小：`CHECKBOX_SIZE = 18px`
- 文字间距：`CHECKBOX_TEXT_SPACING = 8px`（所以文字 x = 20 + 18 + 8 = 46）
- 文字 Y 偏移：`CHECKBOX_TEXT_Y = 14px`

**使用示例：**
```xml
<!-- 记住密码复选框（Y_BASE = 400） -->
<rect x="20" y="400" width="18" height="18" rx="3" fill="none" stroke="#000" stroke-width="1"/>
<text x="46" y="414" font-size="12">记住密码</text>
```

---

## 4. 按钮模板

### 4.1 主按钮（全宽 335px）
```xml
<!-- 主按钮（Y_BASE 为起始位置） -->
<rect x="20" y="Y_BASE" width="335" height="48" rx="24" fill="none" stroke="#000" stroke-width="2"/>
<text x="187.5" y="Y_BASE+30" font-size="16" text-anchor="middle">按钮文字</text>
```

**常量说明：**
- 按钮宽度：`BTN_FULL_WIDTH = 335px`
- 按钮高度：`BTN_HEIGHT = 48px`
- 圆角：`BTN_BORDER_RADIUS = 24px`（完全圆角）
- 文字 Y 偏移：`BTN_TEXT_Y = 30px`
- 文字水平居中 X = `375 / 2 = 187.5px`

**使用示例：**
```xml
<!-- 登录按钮（Y_BASE = 400） -->
<rect x="20" y="400" width="335" height="48" rx="24" fill="none" stroke="#000" stroke-width="2"/>
<text x="187.5" y="430" font-size="16" text-anchor="middle">登录</text>
```

### 4.2 半宽按钮（160px）
```xml
<!-- 半宽按钮（Y_BASE 为起始位置，X_BASE 为起始位置） -->
<rect x="X_BASE" y="Y_BASE" width="160" height="48" rx="24" fill="none" stroke="#000" stroke-width="1"/>
<text x="X_BASE+80" y="Y_BASE+30" font-size="16" text-anchor="middle">按钮文字</text>
```

**常量说明：**
- 按钮宽度：`BTN_HALF_WIDTH = 160px`
- 文字水平居中 X = `X_BASE + 80px`

**使用示例（两个半宽按钮）：**
```xml
<!-- 两个半宽按钮（Y_BASE = 500） -->
<!-- 左按钮 -->
<rect x="20" y="500" width="160" height="48" rx="24" fill="none" stroke="#000" stroke-width="1"/>
<text x="100" y="530" font-size="16" text-anchor="middle">取消</text>
<!-- 右按钮 -->
<rect x="195" y="500" width="160" height="48" rx="24" fill="none" stroke="#000" stroke-width="1"/>
<text x="275" y="530" font-size="16" text-anchor="middle">确定</text>
```

### 4.3 小按钮（100px）
```xml
<!-- 小按钮（Y_BASE 为起始位置，X_BASE 为起始位置） -->
<rect x="X_BASE" y="Y_BASE" width="100" height="48" rx="24" fill="none" stroke="#000" stroke-width="1"/>
<text x="X_BASE+50" y="Y_BASE+30" font-size="14" text-anchor="middle">按钮文字</text>
```

**常量说明：**
- 按钮宽度：`BTN_SMALL_WIDTH = 100px`
- 文字水平居中 X = `X_BASE + 50px`

---

## 5. 布局模板

### 5.1 标准表单布局（88px 间距）
```xml
<!-- 标准表单布局示例 -->

<!-- 第一个输入框（Y_BASE = 112） -->
<text x="20" y="112" font-size="14">用户名</text>
<rect x="20" y="120" width="335" height="48" rx="8" fill="none" stroke="#000" stroke-width="1"/>
<text x="36" y="154" font-size="14" fill="#999">请输入用户名</text>

<!-- 第二个输入框（Y_BASE = 112 + 88 = 200） -->
<text x="20" y="200" font-size="14">密码</text>
<rect x="20" y="208" width="335" height="48" rx="8" fill="none" stroke="#000" stroke-width="1"/>
<text x="36" y="242" font-size="14" fill="#999">请输入密码</text>

<!-- 第三个输入框（Y_BASE = 200 + 88 = 288） -->
<text x="20" y="288" font-size="14">手机号</text>
<rect x="20" y="296" width="335" height="48" rx="8" fill="none" stroke="#000" stroke-width="1"/>
<text x="36" y="330" font-size="14" fill="#999">请输入手机号</text>

<!-- 按钮（Y_BASE = 288 + 88 + 24 = 400，额外增加 24px 间距） -->
<rect x="20" y="400" width="335" height="48" rx="24" fill="none" stroke="#000" stroke-width="2"/>
<text x="187.5" y="430" font-size="16" text-anchor="middle">提交</text>
```

**间距计算规则：**
- 表单项之间间距：`GAP_FORM = 88px`
- 最后一个输入框到按钮：`88px + 24px = 112px`（增加额外间距）

**Y 坐标计算公式：**
```
Y1 = 112
Y2 = Y1 + 88 = 200
Y3 = Y2 + 88 = 288
Y_BTN = Y3 + 88 + 24 = 400
```

### 5.2 两列布局
```xml
<!-- 两列布局示例（Y_BASE 为起始位置） -->

<!-- 左列输入框 -->
<text x="20" y="Y_BASE" font-size="14">姓</text>
<rect x="20" y="Y_BASE+8" width="160" height="48" rx="8" fill="none" stroke="#000" stroke-width="1"/>
<text x="36" y="Y_BASE+42" font-size="14" fill="#999">姓</text>

<!-- 右列输入框 -->
<text x="195" y="Y_BASE" font-size="14">名</text>
<rect x="195" y="Y_BASE+8" width="160" height="48" rx="8" fill="none" stroke="#000" stroke-width="1"/>
<text x="211" y="Y_BASE+42" font-size="14" fill="#999">名</text>
```

**常量说明：**
- 第一列起始位置：`COL_1_X = 20px`
- 第一列宽度：`COL_1_WIDTH = 160px`
- 列间距：`COL_GAP = 15px`
- 第二列起始位置：`COL_2_X = 195px`（= 20 + 160 + 15）
- 第二列宽度：`COL_2_WIDTH = 160px`
- 验证：`160 + 15 + 160 = 335px` ✓

---

## 6. 快速参考

### 常用模板速查表

| 组件类型 | 高度 | 宽度 | Y 坐标计算 |
|---------|------|------|-----------|
| 状态栏 | 44px | 375px | y=0 |
| 导航栏 | 44px | 375px | y=44 |
| 标准输入框 | 48px | 335px | label_y + 8 |
| 验证码输入框 | 48px | 235px | label_y + 8 |
| 验证码按钮 | 48px | 95px | label_y + 8 |
| 全宽按钮 | 48px | 335px | - |
| 半宽按钮 | 48px | 160px | - |
| 小按钮 | 48px | 100px | - |
| 复选框 | 18px | 18px | - |

### 文字 Y 坐标速查表

| 容器类型 | 文字 Y 偏移 | 计算公式 |
|---------|-----------|---------|
| 状态栏文字 | 28px | 固定值 |
| 导航栏标题 | 73px | 固定值 |
| 输入框文字 | +42px | container_y + 42 |
| 按钮文字 | +30px | container_y + 30 |
| 复选框文字 | +14px | container_y + 14 |

### Y 坐标计算器

**标准表单 Y 坐标序列：**
```
起始位置 = 88 + 24 = 112
第 1 项 = 112
第 2 项 = 112 + 88 = 200
第 3 项 = 200 + 88 = 288
第 4 项 = 288 + 88 = 376
第 5 项 = 376 + 88 = 464
按钮位置 = 最后一项 + 88 + 24
```

---

## 7. 使用示例

### 示例 1：完整登录页面
```xml
<svg width="375" height="812" xmlns="http://www.w3.org/2000/svg">
  <style>
    text {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 16px;
      fill: #000;
    }
  </style>

  <!-- 状态栏 -->
  <rect x="0" y="0" width="375" height="44" fill="none" stroke="#000" stroke-width="1"/>
  <text x="20" y="28" font-size="12">9:41</text>
  <text x="355" y="28" font-size="12" text-anchor="end">100%</text>

  <!-- 导航栏 -->
  <rect x="0" y="44" width="375" height="44" fill="none" stroke="#000" stroke-width="1"/>
  <text x="187.5" y="73" font-size="17" text-anchor="middle">登录</text>

  <!-- 用户名输入框（Y_BASE = 112） -->
  <text x="20" y="112" font-size="14">用户名</text>
  <rect x="20" y="120" width="335" height="48" rx="8" fill="none" stroke="#000" stroke-width="1"/>
  <text x="36" y="154" font-size="14" fill="#999">请输入用户名</text>

  <!-- 密码输入框（Y_BASE = 200） -->
  <text x="20" y="200" font-size="14">密码</text>
  <rect x="20" y="208" width="335" height="48" rx="8" fill="none" stroke="#000" stroke-width="1"/>
  <text x="36" y="242" font-size="14" fill="#999">请输入密码</text>
  <circle cx="330" cy="232" r="8" fill="none" stroke="#000" stroke-width="1"/>
  <circle cx="330" cy="232" r="4" fill="#000"/>

  <!-- 记住密码复选框（Y_BASE = 276） -->
  <rect x="20" y="276" width="18" height="18" rx="3" fill="none" stroke="#000" stroke-width="1"/>
  <text x="46" y="290" font-size="12">记住密码</text>

  <!-- 登录按钮（Y_BASE = 324） -->
  <rect x="20" y="324" width="335" height="48" rx="24" fill="none" stroke="#000" stroke-width="2"/>
  <text x="187.5" y="354" font-size="16" text-anchor="middle">登录</text>

  <!-- 底部指示器 -->
  <rect x="127.5" y="778" width="120" height="5" rx="2.5" fill="none" stroke="#000" stroke-width="1"/>
</svg>
```

---

## 8. 版本历史

- **v1.0** (2026-01-19): 初始版本，提供核心组件和布局模板
