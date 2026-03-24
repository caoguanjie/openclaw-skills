# Case Study: iOS Login Interface Wireframe Design

Complete example of wireframe design process using this skill.

## Project Overview

**User Request:** Design an iOS login interface with multiple authentication methods

**Platform:** iOS (iPhone)

**Screen Size:** 375 × 812pt (iPhone X/11/12/13 standard)

**Output Format:** SVG wireframes

**Output Location:** `/temp/design/`

## Requirements Analysis

### Core Features
1. Password login (account/email + password)
2. Phone login (phone number + verification code)
3. WeChat login
4. Biometric login (Face ID / Touch ID)
5. Gesture password login

### Platform Constraints
- iOS design guidelines
- 44pt minimum touch targets
- Safe areas for notched devices
- Home indicator at bottom

## Design Scheme Proposals

### Scheme 1: Card-Based Unified Login

**Layout:** Single screen showing all login options

```
┌─────────────────────────────────────────┐
│  Logo & Title                           │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Account/Password Login         │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │  Phone Login                    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ─────── Other Methods ────────        │
│                                         │
│     WeChat    Biometric    Gesture     │
│     [微信]    [指纹]       [手势]       │
└─────────────────────────────────────────┘
```

**Pros:**
- All options visible at once
- Fewer taps to reach any method
- Good for first-time users

**Cons:**
- Cluttered interface
- May overwhelm users
- Requires scrolling on smaller screens

**Best for:** Apps where users frequently switch login methods

### Scheme 2: Step-Based Separate Screens

**Layout:** Main login → separate screens for each method

```
Main Screen → [Selected Method] → Specific Screen

┌─────────────────┐     ┌─────────────────┐
│  Logo           │     │  Password Form  │
│  Title          │  →  │  Phone Form     │
│                 │     │  Biometric      │
│  Select Method: │     │  Gesture        │
│  • Password     │     │  WeChat Auth    │
│  • Phone        │     │                 │
│  • WeChat       │     │                 │
│  • Biometric    │     │                 │
│  • Gesture      │     │                 │
└─────────────────┘     └─────────────────┘
```

**Pros:**
- Clean, focused screens
- Better for complex forms
- Easier to add new methods
- Follows iOS navigation patterns

**Cons:**
- More taps required
- More screens to maintain
- Users may get lost in navigation

**Best for:** Apps with complex login flows or many form fields

### Scheme 3: Hybrid Approach (Selected)

**Layout:** Main screen with 2 primary methods, secondary methods as icons

```
┌─────────────────────────────────────────┐
│  Logo & Title                           │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Account/Password Login         │   │  ← Primary
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │  Phone Login                    │   │  ← Primary
│  └─────────────────────────────────┘   │
│                                         │
│  ─────── Quick Login ─────────────      │
│                                         │
│     WeChat    Biometric    Gesture     │  ← Secondary
│     [图标]    [图标]       [图标]       │
└─────────────────────────────────────────┘
```

**Pros:**
- Balances simplicity and functionality
- Clear hierarchy (primary vs secondary)
- Fits well on screen without scrolling
- Follows iOS design patterns

**Cons:**
- Requires careful prioritization
- Some methods less prominent

**Best for:** Most iOS apps (chosen for this project)

## Design Specification Search

Used `/ui-ux-pro-max` skill to find guidelines:

```bash
# iOS layout guidelines
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "ios mobile layout" --stack html-tailwind

# Touch targets
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "touch targets" --domain ux

# Authentication UX
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "authentication" --domain ux
```

**Key findings:**
- Minimum touch target: 44pt on mobile
- Safe area top: 44pt (status bar + nav bar)
- Safe area bottom: 34pt (home indicator)
- Input height: 48pt recommended
- Button height: 48pt minimum

## Wireframe Generation

Created 7 SVG wireframes with consistent style:

### Style Guidelines Applied
- **Stroke width:** 1.5px (main), 1px (secondary)
- **Colors:** Grayscale only (#333, #666, #999, #f5f5f5)
- **Fonts:** System fonts (San Francisco equivalent)
- **No:** Gradients, shadows, colors, icons (use text labels)

### Screen List

1. **01-main-login.svg** - Main login with all options
2. **02-password-login.svg** - Account/password form
3. **03-phone-login.svg** - Phone + verification code
4. **04-gesture-login.svg** - Gesture pattern unlock
5. **05-gesture-setup.svg** - Gesture pattern creation
6. **06-biometric-login.svg** - Face ID / Touch ID
7. **07-wechat-login.svg** - WeChat authorization

## Final Output Structure

```
/temp/design/
├── 01-main-login.svg
├── 02-password-login.svg
├── 03-phone-login.svg
├── 04-gesture-login.svg
├── 05-gesture-setup.svg
├── 06-biometric-login.svg
├── 07-wechat-login.svg
└── README.md
```

## Key Design Decisions

### 1. Navigation Pattern
- Chose: Push navigation (each method has own screen)
- Reason: Follows iOS patterns, supports complex forms

### 2. Information Hierarchy
- Primary: Password and Phone login (full buttons)
- Secondary: WeChat, Biometric, Gesture (circular icons)
- Footer: Help links (forgot password, register)

### 3. Screen Layout
```
Safe Area Top: 88px (44 status + 44 nav)
Content Area: Variable (scrolls if needed)
Safe Area Bottom: 34px (home indicator)
```

### 4. Form Design
- Stacked single column (mobile best practice)
- Input height: 48pt
- Button height: 48pt
- Spacing: 16pt between elements

### 5. Visual Hierarchy
- Title: 20pt, 600 weight
- Body text: 14pt, 400 weight
- Small text: 12pt, 400 weight
- Input text: 16pt, 400 weight

## Results

**Files created:** 7 SVG wireframes + 1 README
**Time to complete:** ~15 minutes
**Design iterations:** 2 schemes proposed, 1 selected
**Documentation:** Complete README with layout explanations

## Lessons Learned

1. **Start with scheme proposals** - Saves time by getting alignment early
2. **Use ui-ux-pro-max first** - Platform guidelines prevent rework
3. **Number screens** - Makes flow and ordering clear
4. **Document decisions** - Helps developers understand design rationale
5. **Keep wireframes minimal** - Don't add visual design elements

## Next Steps for Developers

1. Review wireframes in `/temp/design/`
2. Create Vue components for each screen
3. Implement navigation flow
4. Add form validation
5. Integrate authentication APIs
6. Add visual styling (colors, shadows, gradients)

## Files Generated

All files available in `/temp/design/`:
- 7 SVG wireframe files
- README.md with complete documentation
- ASCII-vs-SVG comparison document
