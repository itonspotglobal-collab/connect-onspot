# OnSpot Modular Coming Soon System

## Overview

A scalable, modular Coming Soon page system where one parent component controls the design for all variants. Update the parent once, and all Coming Soon pages automatically inherit the changes.

## Quick Start

### Accessing the Pages

- **Waitlist**: `/pages/waitlist.html`
- **Partners**: `/pages/partners.html`
- **Labs**: `/pages/labs.html`
- **404 Fallback**: `/404.html`

### File Locations

```
/public
  ├── ui/
  │   ├── ComingSoonParent.js       ← Master design file
  │   ├── variants/
  │   │   ├── waitlist.json         ← Waitlist content
  │   │   ├── partners.json         ← Partners content
  │   │   ├── labs.json             ← Labs content
  │   │   └── fallback.json         ← 404 content
  │   └── README.md                 ← Detailed documentation
  ├── pages/
  │   ├── waitlist.html
  │   ├── partners.html
  │   └── labs.html
  └── 404.html
```

## How It Works

### Parent Component Architecture

**ComingSoonParent.js** contains:
- Complete layout structure
- Breathing radial orb animation (light flow, no scaling)
- Responsive grid system (mobile → tablet → desktop)
- Typography and spacing
- Button styles with hover effects
- Typing animation
- Shadow DOM for style isolation

### Variant Content (JSON)

Each variant JSON defines:
```json
{
  "logo": "/OnSpot Log Full Purple Blue_1757942805752.png",
  "logoAlt": "OnSpot",
  "logoLink": "/",
  "titleLine1": "First line of headline",
  "titleLine2": "Second line (gradient highlight)",
  "subtitle": "Subtitle description",
  "primaryCTA": "Primary Button Text",
  "secondaryCTA": "Secondary Button Text",
  "secondaryLink": "/"
}
```

### Child Pages (HTML)

Each HTML page imports the parent and loads its variant:

```javascript
import { renderComingSoon } from '../ui/ComingSoonParent.js';

const response = await fetch('../ui/variants/waitlist.json');
const content = await response.json();

renderComingSoon(content);
```

## Key Features

✅ **URLs remain unchanged** - No redirects (e.g., `/waitlist` stays `/waitlist`)  
✅ **Single design source** - Update parent → all variants update  
✅ **Independent content** - Edit one JSON without affecting others  
✅ **Scalable** - Add new pages by copying JSON + HTML  
✅ **Style isolation** - Shadow DOM prevents CSS conflicts  
✅ **Fully responsive** - Smooth transitions across all devices  
✅ **Accessible** - Respects `prefers-reduced-motion`  
✅ **Dark mode ready** - Follows system preference  

## Design Specifications

### Layout Behavior

- **Mobile/iPad** (< 1024px): All content centered
- **Desktop** (≥ 1024px): Content left-aligned, orb on right
- **Fluid transitions**: Uses `clamp()` for smooth scaling

### Animations

- **Breathing orb**: Light flow animation (blur 95px↔135px, opacity 0.82↔0.45)
- **Typing effect**: "COMING SOON" with animated dots
- **Content fade-in**: Sequential reveal with delays

### Typography

- **Headline**: 
  - Line 1: Gradient text (dark → light)
  - Line 2: Violet-to-blue gradient
- **Subtitle**: Light weight, high readability
- **Buttons**: 
  - Primary: Gradient (violet → blue) with shimmer on hover
  - Secondary: Outlined with subtle backdrop blur

## Adding a New Variant

1. **Create JSON** (`/ui/variants/my-page.json`):
   ```json
   {
     "titleLine1": "Your headline",
     "titleLine2": "goes here.",
     "subtitle": "Your subtitle",
     "primaryCTA": "Call to Action",
     "secondaryCTA": "Learn More",
     "secondaryLink": "/"
   }
   ```

2. **Create HTML** (`/pages/my-page.html`):
   ```html
   <!DOCTYPE html>
   <html lang="en">
   <head>
     <meta charset="UTF-8">
     <meta name="viewport" content="width=device-width, initial-scale=1.0">
     <title>My Page | OnSpot</title>
   </head>
   <body>
     <div id="coming-soon-root"></div>
     
     <script type="module">
       import { renderComingSoon } from '../ui/ComingSoonParent.js';
       const response = await fetch('../ui/variants/my-page.json');
       const content = await response.json();
       renderComingSoon(content);
     </script>
   </body>
   </html>
   ```

3. **Done!** Your page now uses the parent design.

## Updating the Global Design

To change the design for **all** Coming Soon pages:

1. Open `/public/ui/ComingSoonParent.js`
2. Modify layout, animations, or styles
3. Save
4. **All variants automatically update**

No need to edit individual pages unless changing specific content.

## Technical Details

### Shadow DOM

- Styles are scoped to prevent conflicts with main application
- Each page gets its own isolated component tree
- No CSS leakage in or out

### ES Modules

- Clean, modern JavaScript imports
- No build step required for variants
- Browser-native module support

### Performance

- Minimal JavaScript execution
- CSS animations use GPU acceleration
- Respects user motion preferences

## Current Variants

| Variant | URL | Purpose |
|---------|-----|---------|
| Waitlist | `/pages/waitlist.html` | Early access signup |
| Partners | `/pages/partners.html` | BPO partner onboarding |
| Labs | `/pages/labs.html` | Innovation/experimental features |
| 404 | `/404.html` | Fallback for broken URLs |

## Future Expansion

This system is designed to grow with your needs:

- Add unlimited variants without duplicating code
- Customize variants while maintaining design consistency
- Update all pages from a single source
- Keep content separate from presentation
- Scale efficiently as the platform evolves

## Support

For detailed documentation, see `/public/ui/README.md`
