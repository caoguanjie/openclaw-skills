# Wireframe Design Patterns

Common UI/UX layout patterns for wireframe design.

## Navigation Patterns

### Top Navigation Bar
```
┌─────────────────────────────────────────┐
│  ←  Title              Menu Icon      │
├─────────────────────────────────────────┤
│                                         │
│  Content Area                           │
│                                         │
└─────────────────────────────────────────┘
```
**Use for:** iOS, detail pages, single-level navigation

### Bottom Tab Bar
```
┌─────────────────────────────────────────┐
│                                         │
│  Content Area                           │
│                                         │
├─────────────────────────────────────────┤
│  Tab1  Tab2  Tab3  Tab4  Tab5          │
└─────────────────────────────────────────┘
```
**Use for:** iOS main navigation, 3-5 top-level sections

### Drawer Navigation
```
┌─────────────────────────────────────────┐
│  ☰  Title                               │
├─────────────────────────────────────────┤
│                                         │
│  Content Area                           │
│                                         │
└─────────────────────────────────────────┘

[Drawer slides in from left]
┌────┬───────────────────────────────────┐
│    │                                   │
│ M  │  Content Area (dimmed)            │
│ E  │                                   │
│ N  │                                   │
│ U  │                                   │
│    │                                   │
└────┴───────────────────────────────────┘
```
**Use for:** Android, complex navigation hierarchies

### Breadcrumb Navigation
```
┌─────────────────────────────────────────┐
│  Home > Category > Subcategory > Item  │
├─────────────────────────────────────────┤
│                                         │
│  Content Area                           │
│                                         │
└─────────────────────────────────────────┘
```
**Use for:** Web, deep hierarchies, e-commerce

## Component Layouts

### Form Layout
```
┌─────────────────────────────────────────┐
│  ←  Form Title                    Done │
├─────────────────────────────────────────┤
│                                         │
│  Field 1 Label                          │
│  ┌─────────────────────────────────┐   │
│  │  Input placeholder               │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Field 2 Label                          │
│  ┌─────────────────────────────────┐   │
│  │  Input placeholder               │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │     Submit Button                │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```
**Best practices:**
- Single column on mobile
- Two columns on desktop (min-width: 768px)
- Group related fields
- Align labels above inputs (mobile) or left (desktop)

### List Layout
```
┌─────────────────────────────────────────┐
│  ←  List Title                    +     │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐ │
│  │  Icon  Title       Date      >    │ │
│  │        Subtitle                   │ │
│  └───────────────────────────────────┘ │
│  ┌───────────────────────────────────┐ │
│  │  Icon  Title       Date      >    │ │
│  │        Subtitle                   │ │
│  └───────────────────────────────────┘ │
│  ┌───────────────────────────────────┐ │
│  │  Icon  Title       Date      >    │ │
│  │        Subtitle                   │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```
**Best practices:**
- 44px minimum touch target (mobile)
- Clear visual separation between items
- Show key info at a glance
- Chevron indicator for navigation

### Card Layout
```
┌─────────────────────────────────────────┐
│  Cards Title                             │
├─────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐            │
│  │          │  │          │            │
│  │  Image   │  │  Image   │            │
│  │          │  │          │            │
│  ├──────────┤  ├──────────┤            │
│  │  Title   │  │  Title   │            │
│  │  Desc    │  │  Desc    │            │
│  └──────────┘  └──────────┘            │
│  ┌──────────┐  ┌──────────┐            │
│  │  Image   │  │  Image   │            │
│  ├──────────┤  ├──────────┤            │
│  │  Title   │  │  Title   │            │
│  │  Desc    │  │  Desc    │            │
│  └──────────┘  └──────────┘            │
└─────────────────────────────────────────┘
```
**Best practices:**
- 1 column on mobile
- 2 columns on tablet (768px+)
- 3-4 columns on desktop (1024px+)
- Consistent aspect ratio
- Clear hierarchy (image > title > description)

### Grid Layout
```
┌─────────────────────────────────────────┐
│  Grid Title                              │
├─────────────────────────────────────────┤
│  ┌────┐┌────┐┌────┐┌────┐             │
│  │    ││    ││    ││    │             │
│  │ I1 ││ I2 ││ I3 ││ I4 │             │
│  │    ││    ││    ││    │             │
│  └────┘└────┘└────┘└────┘             │
│  ┌────┐┌────┐┌────┐┌────┐             │
│  │    ││    ││    ││    │             │
│  │ I5 ││ I6 ││ I7 ││ I8 │             │
│  │    ││    ││    ││    │             │
│  └────┘└────┘└────┘└────┘             │
└─────────────────────────────────────────┘
```
**Best practices:**
- Fixed number of columns (2, 3, 4, 6)
- Equal width and height cells
- Consistent gaps (8-16px)
- Responsive: fewer columns on mobile

## Platform-Specific Elements

### iOS Status Bar
```
┌─────────────────────────────────────────┐
│  9:41                        📶 🔋     │  ← 44px height
├─────────────────────────────────────────┤
│  Content                                 │
└─────────────────────────────────────────┘
```
**Always include in iOS wireframes**

### iOS Navigation Bar
```
┌─────────────────────────────────────────┐
│  ←  Title                   Action     │  ← 44px height
├─────────────────────────────────────────┤
│  Content                                 │
└─────────────────────────────────────────┘
```
**Blue tint by default, transparent on scroll**

### iOS Tab Bar
```
┌─────────────────────────────────────────┐
│  Content                                 │
├─────────────────────────────────────────┤
│  Tab1  Tab2  Tab3  Tab4  Tab5          │  ← 49px height
└─────────────────────────────────────────┘
```
**5 tabs maximum, active tab highlighted**

### Android Status Bar
```
┌─────────────────────────────────────────┐
│  ⋮  12:00                              │  ← 24dp height
├─────────────────────────────────────────┤
│  Content                                 │
└─────────────────────────────────────────┘
```
**Transparent, overlays content**

### Android Toolbar
```
┌─────────────────────────────────────────┐
│  ←  Title               ⋮               │  ← 56dp height
├─────────────────────────────────────────┤
│  Content                                 │
└─────────────────────────────────────────┘
```
**Elevation 4dp, can scroll off**

### Android Bottom Navigation
```
┌─────────────────────────────────────────┐
│  Content                                 │
├─────────────────────────────────────────┤
│  Tab1  Tab2  Tab3                      │  ← 56dp height
└─────────────────────────────────────────┘
```
**3-5 tabs, labeled with icon + text**

### Android FAB (Floating Action Button)
```
┌─────────────────────────────────────────┐
│                                         │
│  Content                                │
│                                         │
│                                         │
│                                    ┌───┐│
│                                    │ + ││
│                                    └───┘│
└─────────────────────────────────────────┘
```
**56×56dp minimum, 16px from edge**

## Responsive Breakpoints

### Mobile First
```
320px   →  Single column, full-width elements
375px   →  iPhone standard
414px   →  iPhone Plus
768px   →  Tablet portrait, 2 columns
1024px  →  Tablet landscape, 2-3 columns
1440px  →  Desktop, 3-4 columns
1920px  →  Large desktop, max-width containers
```

### Layout Adjustments
- **320-767px**: Stack everything vertically
- **768-1023px**: 2-column grid, collapsible navigation
- **1024px+**: 3-4 column grid, persistent navigation

## Screen Templates

### Mobile (iPhone) - 375×812
```
┌─────────────────────────────────────────┐  ← Status Bar (44px)
│  9:41                        📶 🔋     │
├─────────────────────────────────────────┤  ← Nav Bar (44px)
│  ←  Page Title                           │
├─────────────────────────────────────────┤
│                                         │
│  Safe Area Content                      │  ← Scrollable
│  (starts at y=88)                        │
│                                         │
│                                         │
├─────────────────────────────────────────┤  ← Tab Bar (49px)
│  Tab1  Tab2  Tab3  Tab4                │  ← Optional
├─────────────────────────────────────────┤  ← Home Indicator (34px)
│                    ━━━━━                │
└─────────────────────────────────────────┘  ← Total: 812px
```

### Tablet (iPad) - 768×1024
```
┌─────────────────────────────────────────────────────────┐
│  Status Bar (24px)                                      │
├─────────────────────────────────────────────────────────┤
│  Sidebar (280px)  │  Main Content Area                  │
│  ────────────     │                                     │
│  Nav Item 1       │                                     │
│  Nav Item 2       │                                     │
│  Nav Item 3       │                                     │
│                   │                                     │
└─────────────────────────────────────────────────────────┘
```

### Desktop - 1440×900
```
┌──────────────────────────────────────────────────────────────────────┐
│  Logo    Nav1  Nav2  Nav3  Nav4                Search  Login       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Content (max-width: 1200px, centered)                              │
│                                                                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐               │
│  │         │  │         │  │         │  │         │               │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘               │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│  Footer                                                               │
└──────────────────────────────────────────────────────────────────────┘
```

## Touch Target Guidelines

### Minimum Sizes
- **Mobile**: 44×44pt (iOS), 48×48dp (Android)
- **Desktop**: 32×32px
- **Tablet**: 44×44pt

### Spacing Rules
- **Between touch targets**: 8px minimum
- **From screen edge**: 16px minimum
- **Between related items**: 4px acceptable
