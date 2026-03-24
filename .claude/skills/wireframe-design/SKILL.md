---
name: wireframe-design
description: Generate wireframe designs in SVG format for UI/UX layouts. Analyze requirements and provide multiple wireframe scheme options with basic layout and functionality visualization. Use for wireframe design for web/mobile interfaces, layout sketches for apps/pages, basic structure visualization without styling, or multiple design scheme comparisons. Supports iOS, Android, and Web platforms. Outputs to fixed path /wireframe-design. Depends on ui-ux-pro-max skill or frontend-design skill for design specifications.
---

# Wireframe Design Skill

Generate professional wireframe designs that focus on layout structure and functionality, without visual styling.

## Quick Start

1. **Analyze requirements** - Identify product type, platform, and core features
2. **Propose schemes** - Present 2-3 design approaches with pros/cons
3. **Search specifications** - Use `/ui-ux-pro-max` to find design guidelines
4. **Generate wireframes** - Create SVG files for each screen
5. **Document design** - Write README.md with layout explanations

**Output directory:** `/wireframe-design` (fixed path in project root or temp/)

## When to Use This Skill

Trigger this skill when user asks for:
- Wireframe designs for web/mobile interfaces
- Layout sketches without styling
- Basic UI structure visualization
- Multiple design scheme comparisons
- Screen mockups for development reference

**Do NOT use** for: High-fidelity visual designs, styled UI components, branding work.

## Workflow

### Step 1: Requirement Analysis

Extract key information:
- **Platform**: iOS, Android, Web, or Cross-platform
- **Product type**: Login, dashboard, form, list, detail page, etc.
- **Core features**: Required components and interactions
- **Constraints**: Screen sizes, navigation patterns, platform guidelines

### Step 2: Design Scheme Proposals

Present **2-3 different approaches** with:

**Scheme 1: [Name]**
- Layout: [describe arrangement]
- Pros: [advantages]
- Cons: [disadvantages]
- Best for: [use cases]

**Scheme 2: [Name]**
- Layout: [describe arrangement]
- Pros: [advantages]
- Cons: [disadvantages]
- Best for: [use cases]

Ask user to choose or combine schemes.

### Step 3: Search Design Specifications

Use `/ui-ux-pro-max` skill to find platform-specific guidelines:

```bash
# For iOS designs
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "ios mobile layout" --stack html-tailwind

# For component-specific
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<component-type>" --domain ux

# For typography
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<style-keyword>" --domain typography
```

**Fallback:** If `/ui-ux-pro-max` unavailable, use `/frontend-design`.

### Step 4: Generate SVG Wireframes

**IMPORTANT:** Before creating SVG files, review:
- [SVG 常量定义](references/svg-constants.md) - 所有数值常量和计算公式
- [SVG 模板库](references/svg-templates.md) - 可复用的组件模板片段
- [对齐规则](references/alignment-rules.md) - 对齐计算规则和常见错误

**CRITICAL: Minimal Wireframe Style - Pure Lines Only**

```xml
<!-- Use ONLY these SVG styles -->
<style>
  .stroke { fill: none; stroke: #333; stroke-width: 1.5; }
  .stroke-thin { fill: none; stroke: #999; stroke-width: 1; }
  .text { font-family: sans-serif; font-size: 14px; fill: #666; }
  .text-title { font-size: 18px; font-weight: bold; fill: #333; }
</style>
```

**Wireframe Rules:**
- **NO fills** - Remove all `fill="white"`, `fill="#f5f5f5"`, etc. Use `fill="none"` only
- **NO colors** - Only #333 (black) and #999 (gray) for strokes
- **NO icons** - Use text labels like [图标], [头像], [按钮] instead
- **NO decorations** - Remove circles, emojis, fancy shapes
- **Simple rectangles** - Use `<rect>` for all UI elements
- **Thin lines** - 1px for separators, 1.5px for main borders
- **Text labels** - Label everything clearly in Chinese

**Minimal SVG Template:**
```svg
<svg width="360" height="640" viewBox="0 0 360 640" xmlns="http://www.w3.org/2000/svg">
  <style>
    .stroke { fill: none; stroke: #333; stroke-width: 1.5; }
    .stroke-thin { fill: none; stroke: #999; stroke-width: 1; }
    .text { font-family: sans-serif; font-size: 14px; fill: #666; }
    .text-title { font-size: 18px; font-weight: bold; fill: #333; }
  </style>

  <!-- Screen border -->
  <rect class="stroke" x="0" y="0" width="360" height="640"/>

  <!-- Status bar -->
  <line class="stroke-thin" x1="0" y1="24" x2="360" y2="24"/>
  <text class="text" x="16" y="18">9:41</text>

  <!-- Content areas as rectangles -->
  <rect class="stroke" x="16" y="60" width="328" height="56"/>
  <text class="text" x="32" y="95">[按钮文字]</text>
</svg>
```

**File naming:** `01-screen-name.svg`, `02-screen-name.svg` (numbered for order)

### Step 5: Quality Checks

在生成 SVG 后，必须进行以下质量检查：

**常量一致性检查：**
- [ ] 状态栏高度 = 44px，文字 y = 28px
- [ ] 导航栏高度 = 44px，标题 y = 73px
- [ ] 输入框高度 = 48px，文字 y 偏移 = +42px
- [ ] 按钮高度 = 48px，文字 y 偏移 = +30px
- [ ] 屏幕边距 = 20px，内容宽度 = 335px

**对齐一致性检查：**
- [ ] 同行元素的文字 y 坐标相同（特别是验证码输入框和按钮）
- [ ] 所有输入框左边距统一（x = 20px）
- [ ] 所有输入框内文字左边距统一（x = 36px）
- [ ] 所有输入框宽度统一（width = 335px）

**间距一致性检查：**
- [ ] 表单项之间间距 = 88px（标签 y 坐标：112, 200, 288...）
- [ ] 最后一个输入框到按钮间距 ≥ 100px
- [ ] 内容起始位置 = 88px（状态栏 + 导航栏）

**自动检查命令（可选）：**
```bash
# 检查状态栏高度
grep -E '<rect.*y="0".*height="44"' *.svg

# 检查输入框高度
grep -E 'height="48"' *.svg | grep 'rect'

# 检查文字 y 坐标分布
grep -oE 'y="[0-9]+"' *.svg | sort | uniq -c
```

### Step 6: Document Output

Create **README.md** with:
- File list and screen descriptions
- Layout structure explanation
- Component breakdown
- Interaction flow
- Platform-specific notes

**For multiple schemes**, create `SCHEMES.md` comparing approaches.

## Output Format

```
/wireframe-design/
├── 01-main-screen.svg
├── 02-secondary-screen.svg
├── README.md (required)
└── SCHEMES.md (if multiple schemes)
```

## Common Patterns

See [patterns.md](references/patterns.md) for:
- Navigation patterns (tabs, headers, drawers)
- Component layouts (forms, lists, cards)
- Platform-specific elements (iOS bars, Android FAB)
- Responsive breakpoints

## Reference Case Study

See [case-study.md](references/case-study.md) for complete example:
- **Project**: iOS login interface with 5 auth methods
- **Schemes**: Card-based vs Step-based layouts
- **Output**: 7 SVG wireframes
- **Process**: From requirement to final delivery

## Best Practices

1. **Keep it simple** - Wireframes should be minimal and clear
2. **Focus on structure** - Show layout, not visual design
3. **Number screens** - Use 01-, 02-, 03- prefix for flow clarity
4. **Label everything** - Use text labels to explain components
5. **Show interactions** - Indicate touch targets and clickable areas
6. **Think responsive** - Consider different screen sizes
7. **Follow platform conventions** - Respect iOS/Android/Web patterns
8. **Document decisions** - Explain why layouts are arranged this way
9. **使用常量定义** - 所有数值必须来自 [svg-constants.md](references/svg-constants.md)
10. **使用模板片段** - 复用 [svg-templates.md](references/svg-templates.md) 中的组件
11. **遵循对齐规则** - 参考 [alignment-rules.md](references/alignment-rules.md) 避免对齐错误
12. **执行质量检查** - 生成后必须检查常量、对齐、间距一致性

## Troubleshooting

**Issue**: SVG looks too detailed
- **Fix**: Remove colors, shadows, gradients; simplify icons

**Issue**: File size too large
- **Fix**: Use simpler paths, reduce detail level

**Issue**: Layout doesn't match platform
- **Fix**: Search platform-specific guidelines using ui-ux-pro-max

## Dependencies

- **Primary**: `/ui-ux-pro-max` for design specifications
- **Fallback**: `/frontend-design` if ui-ux-pro-max unavailable
- **Tools**: Python 3, SVG viewer/browser
