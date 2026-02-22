# Theme & Navigation Design System

**Date:** February 22, 2025  
**Theme:** Tangerine (from tweakcn.com)

---

## Theme: Tangerine

### Installation
```bash
pnpm dlx shadcn@latest add https://tweakcn.com/r/themes/tangerine.json
```

### Theme Colors (OKLCH)

#### Light Mode
- **Primary:** `oklch(0.6397 0.1720 36.4421)` - Warm orange/tangerine
- **Background:** `oklch(0.9383 0.0042 236.4993)` - Light warm gray
- **Foreground:** `oklch(0.3211 0 0)` - Dark text
- **Card:** `oklch(1.0000 0 0)` - Pure white
- **Border:** `oklch(0.9022 0.0052 247.8822)` - Subtle border
- **Accent:** `oklch(0.9119 0.0222 243.8174)` - Light accent
- **Destructive:** `oklch(0.6368 0.2078 25.3313)` - Red/orange

#### Dark Mode
- **Primary:** `oklch(0.6397 0.1720 36.4421)` - Same warm orange
- **Background:** `oklch(0.2598 0.0306 262.6666)` - Dark background
- **Foreground:** `oklch(0.9219 0 0)` - Light text
- **Card:** `oklch(0.3106 0.0301 268.6365)` - Dark card
- **Border:** `oklch(0.3843 0.0301 269.7337)` - Dark border

### Typography
- **Sans:** Inter, sans-serif
- **Serif:** Source Serif 4, serif
- **Mono:** JetBrains Mono, monospace

### Border Radius
- **Default:** `0.75rem` (12px)
- **Consistent rounded corners throughout**

### Shadows
- Subtle shadows with warm tones
- Multiple shadow levels (xs, sm, md, lg, xl, 2xl)

---

## Navigation System

### Sidebar Navigation (Desktop)

#### Auto-Minimizing Behavior

**Expanded State (Default):**
- Full sidebar width (~240px)
- Icons + labels visible
- Active state highlighted
- Smooth hover effects

**Minimized State (Auto-triggered):**
- Collapses to icon-only (~64px width)
- Triggers:
  - Click on main content area
  - Focus on input/search fields
  - Start typing in forms
  - Interact with data tables
- Icons remain visible
- Tooltips show labels on hover
- Smooth expand on sidebar hover

**Manual Toggle:**
- Toggle button in sidebar header
- User can override auto-behavior
- State saved to localStorage

#### Navigation Items

**Structure:**
```
┌─────────────────────┐
│ Logo/Brand          │
├─────────────────────┤
│ 🏠 Dashboard        │
│ 👥 Users            │
│   ├─ All Users      │
│   ├─ Create         │
│   └─ Bulk Upload    │
│ 📅 Leave            │
│   ├─ Requests       │
│   ├─ Balances       │
│   └─ Types          │
│ ⏰ Timesheets       │
│   ├─ My Timesheets  │
│   ├─ All            │
│   └─ Create         │
│ 🔄 Workflows        │
│   ├─ Templates      │
│   ├─ Pending        │
│   └─ Instances      │
│ 📊 Reports          │
│ ⚙️  Configuration   │
│ 🛡️  Administration │
│ 👤 Profile          │
└─────────────────────┘
```

**Icons (Lucide React):**
- Dashboard: `LayoutDashboard`
- Users: `Users`
- Leave: `Calendar`
- Timesheets: `Clock`
- Workflows: `Workflow`
- Reports: `BarChart`
- Configuration: `Settings`
- Administration: `Shield`
- Profile: `User`

#### Visual States

**Normal:**
- Icon + label
- Subtle background
- Hover: Light accent background

**Active:**
- Primary color background
- Primary foreground color
- Left border indicator (2px)

**Minimized:**
- Icon only
- Tooltip on hover
- Active state still visible (colored icon)

---

## Mobile Navigation

### Drawer Navigation

**Behavior:**
- Hidden by default
- Triggered by hamburger menu
- Slides in from left
- Overlay backdrop (semi-transparent)
- Full-height drawer
- Close on:
  - Outside click
  - Navigation
  - Close button

**Layout:**
```
┌─────────────────────┐
│ ☰ Close  Logo       │
├─────────────────────┤
│ 🏠 Dashboard        │
│ 👥 Users            │
│ 📅 Leave            │
│ ⏰ Timesheets       │
│ 🔄 Workflows        │
│ 📊 Reports          │
│ ⚙️  Configuration   │
│ 🛡️  Administration │
│ ─────────────────── │
│ 👤 Profile          │
│ 🔔 Notifications    │
│ ⚙️  Settings        │
└─────────────────────┘
```

### Bottom Navigation (Alternative)

**For Mobile:**
- Fixed bottom bar
- 5 main sections
- Icons + labels
- Active indicator
- Quick access

**Sections:**
1. Dashboard
2. Leave
3. Timesheets
4. Workflows
5. Profile

---

## Responsive Breakpoints

### Tailwind CSS Breakpoints
- **sm:** 640px (Tablet portrait)
- **md:** 768px (Tablet landscape)
- **lg:** 1024px (Desktop)
- **xl:** 1280px (Large desktop)
- **2xl:** 1536px (Extra large)

### Layout Adaptations

**Mobile (< 640px):**
- Drawer navigation
- Single column layouts
- Stacked cards
- Bottom navigation option
- Full-width modals
- Touch-optimized inputs

**Tablet (640px - 1024px):**
- Collapsible sidebar
- 2-column layouts
- Responsive tables
- Optimized forms

**Desktop (> 1024px):**
- Auto-minimizing sidebar
- Multi-column layouts
- Full data tables
- Side-by-side forms
- Hover interactions

---

## Mobile-First Considerations

### Touch Targets
- **Minimum:** 44x44px
- **Recommended:** 48x48px
- Adequate spacing between targets
- No hover-only interactions

### Gestures
- **Swipe:** Navigation, dismiss modals
- **Pull to refresh:** Lists
- **Pinch to zoom:** Charts/images (where appropriate)
- **Long press:** Context menus

### Performance
- Lazy load heavy components
- Virtual scrolling for long lists
- Optimized images (WebP, responsive)
- Reduced animations on mobile
- Code splitting by route

### Forms
- Large input fields
- Native date pickers
- Auto-focus management
- Keyboard-friendly
- Input type optimization (email, tel, etc.)

### Data Display
- **Tables:** Horizontal scroll with sticky columns
- **Cards:** Alternative view for mobile
- **Charts:** Simplified or table view
- **Lists:** Infinite scroll or pagination

---

## Implementation Notes

### Sidebar Component Requirements
1. **State Management:**
   - `isExpanded` state
   - `isAutoMinimized` state
   - localStorage persistence

2. **Auto-Minimize Logic:**
   - Listen to main content focus events
   - Listen to input focus events
   - Debounce minimize/expand actions
   - Smooth transitions (300ms)

3. **Accessibility:**
   - ARIA labels
   - Keyboard navigation
   - Focus management
   - Screen reader announcements

4. **Performance:**
   - CSS transitions (not JS animations)
   - Will-change hints
   - GPU acceleration

### Mobile Drawer Requirements
1. **Animation:**
   - CSS transform (translateX)
   - Smooth slide-in (300ms)
   - Backdrop fade-in

2. **Touch Handling:**
   - Swipe to close
   - Touch outside to close
   - Prevent body scroll when open

3. **Focus Management:**
   - Trap focus in drawer
   - Return focus on close
   - Skip link support

---

## Component Library Integration

### shadcn/ui Components
All components will use Tangerine theme:
- Button
- Card
- Input
- Select
- Dialog/Modal
- Sheet (for drawer)
- Sidebar (for navigation)
- Tabs
- Table
- Form components

### Custom Components Needed
1. **AutoMinimizingSidebar**
   - Desktop sidebar with auto-minimize
   - Icon-only mode
   - Tooltip system

2. **MobileDrawer**
   - Slide-in drawer
   - Overlay backdrop
   - Touch gestures

3. **ResponsiveTable**
   - Horizontal scroll on mobile
   - Sticky columns
   - Card view alternative

4. **MobileBottomNav**
   - Fixed bottom bar
   - Quick navigation
   - Active indicators

---

**Last Updated:** February 22, 2025  
**Status:** Design Complete  
**Next:** Implementation
