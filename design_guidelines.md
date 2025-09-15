# OnSpot Platform MVP - Design Guidelines

## Design Approach
**Apple HIG Inspired**: Following Apple's design principles for clean, intuitive interfaces with Upwork-style functionality. This utility-focused platform prioritizes efficiency and learnability for professional outsourcing management.

## Core Design Elements

### Color Palette
**Light Mode:**
- Primary: 220 100% 50% (Apple blue)
- Surface: 0 0% 98% (near white)
- Text: 220 9% 15% (dark gray)
- Border: 220 13% 91% (light gray)

**Dark Mode:**
- Primary: 212 100% 60% (lighter blue)
- Surface: 220 13% 9% (dark gray)
- Text: 220 9% 85% (light gray)
- Border: 220 13% 19% (medium gray)

### Typography
- Primary: SF Pro Display via system fonts (-apple-system, BlinkMacSystemFont)
- Headings: 600 weight, generous line-height
- Body: 400 weight, optimized for readability
- UI elements: 500 weight for buttons and labels

### Layout System
**Tailwind Spacing**: Consistent use of 4, 6, 8, 12, 16, 24 unit increments
- Container padding: p-6 or p-8
- Component spacing: gap-4, gap-6
- Section margins: mb-8, mb-12

### Component Library

**Navigation:**
- Clean sidebar with grouped sections (Dashboard, Talent, Projects, Performance)
- Minimal top bar with user profile and notifications
- Apple-style tab navigation for sub-sections

**Dashboard Cards:**
- Subtle shadows with rounded corners (rounded-lg)
- Clear hierarchy with bold headings and supporting metrics
- Apple-inspired card spacing and proportions

**Data Tables:**
- Clean borders, alternating row colors
- Sortable headers with subtle hover states
- Integrated action buttons aligned right

**Forms:**
- Apple-style input fields with subtle borders
- Clear error states in red
- Grouped sections with proper spacing

**Buttons:**
- Primary: Filled blue buttons for main actions
- Secondary: Outline buttons with subtle borders
- Destructive: Red for delete/cancel actions

### Key Features Layout

**Multi-Role Dashboard:**
- Role-based sidebar navigation
- Contextual widgets based on user type (Client/Talent/Manager)
- Quick action buttons prominently placed

**Talent Acquisition:**
- Search and filter sidebar
- Card-based talent profiles with photos and key metrics
- Apple-style modal overlays for detailed profiles

**Project Management:**
- Kanban-style task boards
- Timeline view with clean date indicators
- Collaboration panels with message threads

**Performance Analytics:**
- Clean chart implementations using subtle colors
- Key metrics in card format
- Trend indicators with Apple-style iconography

### Interactions
- Subtle hover states (opacity changes, not color shifts)
- Smooth transitions (200ms ease-in-out)
- Apple-style loading states with activity indicators
- Minimal use of animations - only for state changes

### Responsive Behavior
- Mobile-first approach with collapsible sidebar
- Stacked cards on smaller screens
- Touch-friendly button sizing (44px minimum)

### Images
**Hero Section:** Clean, professional workspace imagery showing diverse teams collaborating
**Dashboard:** Subtle background patterns or gradients, no competing imagery
**Profile Photos:** Consistent circular crops with subtle borders
**Empty States:** Simple illustrations matching the Apple aesthetic

This design system ensures consistency across all modules while maintaining the professional, efficient feel expected in enterprise outsourcing platforms.