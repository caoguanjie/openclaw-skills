---
name: wechat-write-paiban
description: Create professionally formatted articles for WeChat Official Accounts (微信公众号) with v3.1 styling. Use this skill whenever the user wants to create, format, or convert content into WeChat article format. Triggers include requests to "format for WeChat", "create a WeChat article", "按照微信公众号格式", "用公众号排版", or any mention of converting documents/text to WeChat-ready HTML. Produces clean, professional HTML with inline styles that can be directly copied into WeChat editors.
---

# WeChat Article Formatter

This skill creates articles formatted specifically for WeChat Official Accounts using the v3.1 professional styling system.

## Output Format

Always generate an HTML file (`.html` extension) that users can:
1. Open in a browser to preview
2. Select all (Ctrl+A / Cmd+A) and copy
3. Paste directly into WeChat Official Account editor

## Styling Specifications (v3.1)

### Core Design Philosophy
- **No emojis** - Use text labels instead ("提示：", "注意：", "重点：")
- **No gradients** - Use solid colors only
- **Professional colors** - Deep green (#16a085) for headers, warm orange (#e67e22) for emphasis
- **Human-written feel** - Avoid AI-like flashy styling
- **Readable first** - Font size and spacing tuned for mobile reading comfort

### Color Palette

**Primary Colors:**
- Background: `#fff` (white)
- Text: `#2c3e50` (dark gray-blue)
- Headings: `#16a085` (deep cyan-green) - professional and stable
- Secondary text: `#7f8c8d` (medium gray)

**Accent Colors:**
- Emphasis: `#e67e22` (warm orange) - friendly but not glaring
- Links: `#16a085` (deep cyan-green)
- Success: `#27ae60` (deep green)
- Warning/Error: `#e74c3c` (deep red)

**Background Colors:**
- Code blocks: `#f4f6f8` (slightly blue-tinted light gray, cleaner than pure gray)
- Quote blocks: `#ecf8f3` (very light green)
- Table header: `#e8f6f3` (light green, stronger than ecf8f3 for better header contrast)
- Borders: `#d5d8dc` (light gray)
- Dividers: `#bdc3c7` (medium gray)
- Zebra row: `#f8f9fa` (near white for alternating table rows)

### Container Specifications

Base container must always wrap all content:

```html
<section style="margin: 20px auto; padding: 0 18px; max-width: 677px; font-size: 14px; color: #2c3e50; line-height: 1.75; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;">
    <!-- All content here -->
</section>
```

**Key changes from v3.0:**
- `font-size` reduced from `15px` → `14px` (less bulky on mobile)
- `line-height` tightened from `1.8` → `1.75` (still breathable, less loose)
- `padding` from `0 20px` → `0 18px` (slightly more content width)
- Font stack updated: Chinese fonts (`PingFang SC`, `Hiragino Sans GB`, `Microsoft YaHei`) prioritized before Latin fallbacks for better CJK rendering

### Typography

**Headings:**
- H1: `font-size: 22px; font-weight: bold; color: #16a085; margin: 32px 0 16px; line-height: 1.4;`
- H2: `font-size: 18px; font-weight: bold; color: #16a085; margin: 28px 0 12px; padding-left: 10px; border-left: 4px solid #16a085; line-height: 1.4;`
- H3: `font-size: 15px; font-weight: bold; color: #2c3e50; margin: 22px 0 10px; padding-left: 8px; border-left: 3px solid #e67e22; line-height: 1.4;`

**Key changes from v3.0:**
- H1 reduced: 24px → 22px
- H2 reduced: 20px → 18px; added left border accent for visual hierarchy
- H3 reduced: 17px → 15px; added orange left border to distinguish from H2
- All headings get `line-height: 1.4` so wrapped titles don't look too gapped

**Body Text:**
- Paragraph: `margin: 12px 0; color: #2c3e50; font-size: 14px; line-height: 1.75;`
- Strong (emphasis): `color: #e67e22; font-weight: 600;`
- Code (inline): `padding: 1px 5px; background: #f4f6f8; border-radius: 3px; font-size: 12px; color: #c0392b; border: 1px solid #e0e3e7; font-family: 'SF Mono', Monaco, Consolas, monospace;`

**Key changes from v3.0:**
- Paragraph margin tightened: `14px 0` → `12px 0`
- Inline code font size: `13px` → `12px`; color slightly deeper red `#c0392b`; border color more distinct

### Special Elements

**Quote Boxes** (use text labels, NO emojis):

Information box (green):
```html
<blockquote style="margin: 16px 0; padding: 12px 16px; background: #ecf8f3; border-left: 4px solid #16a085; border-radius: 0 4px 4px 0; color: #2c3e50;">
    <p style="margin: 0; font-size: 14px; line-height: 1.75;"><strong style="color: #16a085;">提示：</strong>Content here</p>
</blockquote>
```

Important box (darker green):
```html
<blockquote style="margin: 16px 0; padding: 12px 16px; background: #d5f4e6; border-left: 4px solid #16a085; border-radius: 0 4px 4px 0; color: #2c3e50;">
    <p style="margin: 0; font-size: 14px; line-height: 1.75;"><strong style="color: #16a085;">重点：</strong>Content here</p>
</blockquote>
```

Warning box (orange):
```html
<blockquote style="margin: 16px 0; padding: 12px 16px; background: #fef5e7; border-left: 4px solid #e67e22; border-radius: 0 4px 4px 0; color: #2c3e50;">
    <p style="margin: 0; font-size: 14px; line-height: 1.75;"><strong style="color: #e67e22;">注意：</strong>Content here</p>
</blockquote>
```

Error/Danger box (red):
```html
<blockquote style="margin: 16px 0; padding: 12px 16px; background: #fdedec; border-left: 4px solid #e74c3c; border-radius: 0 4px 4px 0; color: #2c3e50;">
    <p style="margin: 0; font-size: 14px; line-height: 1.75;"><strong style="color: #e74c3c;">警告：</strong>Content here</p>
</blockquote>
```

**Key changes from v3.0:**
- Padding tightened: `14px 18px` → `12px 16px`
- Added `border-radius: 0 4px 4px 0` for subtle polish on right side
- Added explicit `font-size` and `line-height` on inner `<p>` for consistency
- Replaced "Success box" with "Error/Danger box" (more practical)

**Code Blocks** (wrap-first, NO scrollbars):
```html
<pre style="margin: 12px 0; padding: 14px 16px; background: #f4f6f8; border-radius: 4px; border: 1px solid #dde1e7; border-left: 3px solid #16a085; font-size: 12px; line-height: 1.65; font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; word-break: break-all; color: #2c3e50;"><code>Code content here</code></pre>
```

**Key changes from v3.0 (critical fix):**
- Font size: `13px` → `12px` (narrower characters = less wrapping distortion)
- Added `word-break: break-all` — this is the KEY fix for long lines not displaying fully
- Added `border-left: 3px solid #16a085` — visually marks it as a code block at a glance
- Background: `#f8f9fa` → `#f4f6f8` (slightly cooler, more "code-like")
- Border: `#e9ecef` → `#dde1e7` (more visible separation)
- Padding tweaked: `14px` → `14px 16px` (more horizontal breathing room)

**Tables vs Card Blocks — Choose the right pattern:**

## Decision Rule

**Use a standard table when:**
- 2–3 columns maximum
- Cell content is short (a few words per cell, not sentences)
- Data is purely comparative/tabular (e.g. time+event, term+definition)

**Use card blocks instead when ANY of these apply:**
- 4+ columns → always use cards, never squeeze into a table
- Any cell contains a sentence or more of text
- The content describes distinct "options" or "types" that each have multiple sub-attributes (pros, cons, suitable for, etc.)
- A table would require `white-space: nowrap` hacks to avoid ugly text wrapping

**The golden rule: if a table would look cramped or cause vertical text on mobile, break it into cards.**

---

## Standard Table (2–3 short-content columns only)

Note: WeChat editor strips `<tr>` background/color styles. Always put styles directly on each `<th>`/`<td>`. Use light-background + colored-text headers. Alternate row backgrounds must be hardcoded on each `<td>`.

```html
<table style="margin: 16px 0; width: 100%; border-collapse: collapse; border: 1px solid #c8cdd2; font-size: 13px; line-height: 1.6;">
    <thead>
        <tr>
            <th style="padding: 10px 14px; text-align: left; border: 1px solid #c8cdd2; font-weight: bold; background-color: #e8f6f3; color: #16a085; white-space: nowrap;">列标题</th>
            <th style="padding: 10px 14px; text-align: left; border: 1px solid #c8cdd2; font-weight: bold; background-color: #e8f6f3; color: #16a085; white-space: nowrap;">列标题</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td style="padding: 9px 14px; border: 1px solid #c8cdd2; background-color: #ffffff; vertical-align: top;">数据</td>
            <td style="padding: 9px 14px; border: 1px solid #c8cdd2; background-color: #ffffff; vertical-align: top;">数据</td>
        </tr>
        <tr>
            <td style="padding: 9px 14px; border: 1px solid #c8cdd2; background-color: #f8f9fa; vertical-align: top;">数据</td>
            <td style="padding: 9px 14px; border: 1px solid #c8cdd2; background-color: #f8f9fa; vertical-align: top;">数据</td>
        </tr>
    </tbody>
</table>
```

Table rules:
- Table font size: `13px`, line-height: `1.6`
- Header background `#e8f6f3` + text `#16a085`
- Cell padding: `9px 14px`, `vertical-align: top` on all cells
- `white-space: nowrap` on header cells to prevent wrapping
- Zebra rows: odd `#ffffff`, even `#f8f9fa` — hardcode on each `<td>`

---

## Card Blocks (use for 4+ columns OR long cell content)

Card blocks stack vertically, one card per item. Each card has a colored header bar and a content body. Use color-coded labels for sub-attributes (pros = green, cons = red, suitable = gray).

**Header color guide by tone:**
- Green header (`#e8f6f3` bg + `#16a085` label): positive / recommended / easiest
- Orange header (`#fef5e7` bg + `#e67e22` label): moderate / requires effort / caution
- Light green header (`#ecf8f3` bg + `#16a085` label): neutral / professional

```html
<!-- Card 1 -->
<div style="margin: 12px 0; border: 1px solid #c8cdd2; border-radius: 6px; overflow: hidden;">
    <div style="padding: 10px 16px; background-color: #e8f6f3; border-bottom: 1px solid #c8cdd2;">
        <span style="font-size: 13px; font-weight: bold; color: #16a085;">标签</span>
        <span style="font-size: 15px; font-weight: bold; color: #2c3e50; margin-left: 10px;">卡片标题</span>
    </div>
    <div style="padding: 12px 16px; background-color: #ffffff; font-size: 13px; line-height: 1.75; color: #2c3e50;">
        <p style="margin: 0 0 8px;"><strong style="color: #27ae60;">优点：</strong>内容……</p>
        <p style="margin: 0 0 8px;"><strong style="color: #e74c3c;">缺点：</strong>内容……</p>
        <p style="margin: 0;"><strong style="color: #7f8c8d;">适合：</strong>内容……</p>
    </div>
</div>

<!-- Card 2 -->
<div style="margin: 12px 0; border: 1px solid #c8cdd2; border-radius: 6px; overflow: hidden;">
    <div style="padding: 10px 16px; background-color: #fef5e7; border-bottom: 1px solid #c8cdd2;">
        <span style="font-size: 13px; font-weight: bold; color: #e67e22;">标签</span>
        <span style="font-size: 15px; font-weight: bold; color: #2c3e50; margin-left: 10px;">卡片标题</span>
    </div>
    <div style="padding: 12px 16px; background-color: #ffffff; font-size: 13px; line-height: 1.75; color: #2c3e50;">
        <p style="margin: 0 0 8px;"><strong style="color: #27ae60;">优点：</strong>内容……</p>
        <p style="margin: 0 0 8px;"><strong style="color: #e74c3c;">缺点：</strong>内容……</p>
        <p style="margin: 0;"><strong style="color: #7f8c8d;">适合：</strong>内容……</p>
    </div>
</div>
```

**Card body label colors (use consistently):**
- `#27ae60` green — 优点、适用场景、正面属性
- `#e74c3c` red — 缺点、风险、负面属性
- `#7f8c8d` gray — 适合人群、补充说明、中性信息
- `#e67e22` orange — 注意事项、成本、需要权衡的点
- `#16a085` teal — 重点说明、核心特征

**Lists:**
```html
<ul style="margin: 12px 0; padding-left: 20px; color: #2c3e50;">
    <li style="margin: 6px 0; font-size: 14px; line-height: 1.75;">List item</li>
</ul>

<ol style="margin: 12px 0; padding-left: 20px; color: #2c3e50;">
    <li style="margin: 6px 0; font-size: 14px; line-height: 1.75;">List item</li>
</ol>
```

Note: Always specify `font-size` and `line-height` on `<li>` directly — WeChat sometimes resets list item styles.

**Flow Diagrams** (simple box style):
```html
<div style="margin: 16px 0; padding: 16px; background: #f4f6f8; border: 1px solid #dde1e7; border-radius: 4px; text-align: center; color: #2c3e50;">
    <p style="margin: 4px 0; font-size: 14px; font-weight: bold;">步骤一</p>
    <p style="margin: 4px 0; font-size: 16px; color: #16a085;">↓</p>
    <p style="margin: 4px 0; font-size: 14px; font-weight: bold;">步骤二</p>
</div>
```

**Divider:**
```html
<hr style="margin: 24px 0; border: none; border-top: 1px solid #e0e3e7;">
```

**Images:**
```html
<img src="URL" alt="Description" style="max-width: 100%; height: auto; border: 1px solid #d5d8dc; border-radius: 4px; display: block; margin: 16px auto;">
```

Note: Removed `box-shadow` from images — WeChat may strip it; simpler is safer.

**Meta info line** (date, reading time, author — place near top of article):
```html
<p style="margin: 8px 0 20px; font-size: 12px; color: #7f8c8d; line-height: 1.5;">2024年3月 · 阅读约5分钟</p>
```

## Workflow

1. **Understand content** - Review the article content or accept user's text
2. **Structure content** - Organize into logical sections with appropriate headings
3. **Apply formatting** - Use the v3.1 style specifications
4. **Generate HTML file** - Create complete HTML document with proper DOCTYPE and structure
5. **Save to outputs** - Always save to `/mnt/user-data/outputs/` directory
6. **Present file** - Use `present_files` tool to share with user

## Critical Rules

- **All styles must be inline** - No external CSS
- **NO emojis anywhere** - Use text labels ("提示：", "注意：", "重点：", "警告：")
- **NO gradients** - Only solid colors
- **Code blocks MUST use `word-break: break-all`** - This is the key fix for long lines not displaying
- **Code font size 12px** - Reduces wrapping distortion on narrow mobile screens
- **Container width: 677px, font-size: 14px** - Standard WeChat article dimensions
- **Always generate .html files** - Never output raw HTML in chat
- **Table styles on cells, not rows** - WeChat strips `<tr>` styles; put background-color/color on each `<th>` and `<td>` directly
- **No white-on-dark table headers** - Use `#e8f6f3` background + `#16a085` text for headers
- **Zebra striping: hardcode on each `<td>`** - Alternate `#ffffff` / `#f8f9fa` per row manually
- **`vertical-align: top` on all table cells** - Prevents ugly center-alignment on multi-line cells
- **4+ columns = always use card blocks, never a table** - Multi-column tables squeeze text into vertical columns on mobile; card blocks stack cleanly instead
- **Long cell content = use card blocks** - If any cell would contain a full sentence or more, switch to cards
- **List items need explicit `font-size` and `line-height`** - WeChat may reset inherited values

## Quick Reference: What Changed from v3.0

| Element | v3.0 | v3.1 |
|---|---|---|
| Body font size | 15px | 14px |
| Line height | 1.8 | 1.75 |
| Paragraph margin | 14px 0 | 12px 0 |
| H1 | 24px, no border | 22px, no border |
| H2 | 20px, no border | 18px + left green border |
| H3 | 17px, no border | 15px + left orange border |
| Code font size | 13px | 12px |
| Code wrap | pre-wrap only | pre-wrap + word-break: break-all |
| Code left accent | none | 3px green left border |
| Table font | 14px | 13px |
| Table cell padding | 10px | 9px 14px |
| Table vertical-align | (not set) | top |
| Table header bg | #ecf8f3 | #e8f6f3 (stronger) |

## Tips for Best Results

- Keep headings concise and descriptive
- Use quote boxes sparingly for truly important information
- Break long paragraphs into shorter ones (3-4 sentences max)
- Use lists for enumeration, keep items terse
- Tables work best for comparisons; keep columns ≤ 4 for mobile
- For code with very long lines, consider breaking them manually at logical points before the article stage
- Add meta info line (date/read-time) at the top if provided