# Coming Soon Modular System

This is a scalable, modular Coming Soon system built with a parent-child architecture.

## Architecture

### Parent Component
- **File**: `/ui/ComingSoonParent.js`
- **Purpose**: Master design file containing all layout, animations, and styling
- **Technology**: ES Modules with Shadow DOM for style isolation
- **Updates**: Any changes to this file automatically apply to all child variants

### Variant Content
- **Location**: `/ui/variants/*.json`
- **Purpose**: Define page-specific content (title, subtitle, CTAs)
- **Format**: JSON files that are consumed by child pages

### Child Pages
- **Location**: `/pages/*.html` and `/404.html`
- **Purpose**: Individual Coming Soon pages that import the parent and load their variant JSON
- **Behavior**: URLs remain unchanged (no redirects)

## File Structure

```
/public
  /ui
    ├── ComingSoonParent.js          ← Master design (layout, animations, responsive)
    ├── /variants
    │     ├── waitlist.json          ← Waitlist page content
    │     ├── partners.json          ← Partners page content
    │     ├── labs.json              ← Labs page content
    │     └── fallback.json          ← 404 page content
    └── README.md
  /pages
    ├── waitlist.html                ← /pages/waitlist
    ├── partners.html                ← /pages/partners
    └── labs.html                    ← /pages/labs
  404.html                           ← 404 fallback
```

## How It Works

1. **Parent renders layout**: `ComingSoonParent.js` defines the entire UI, including:
   - Breathing radial orb animation
   - Responsive grid layout
   - Typography and spacing
   - Typing animation for "COMING SOON"
   - Button styles and interactions

2. **Variants provide content**: Each JSON file contains:
   ```json
   {
     "logo": "/path/to/logo.png",
     "logoAlt": "Logo alt text",
     "logoLink": "/",
     "titleLine1": "First line of headline",
     "titleLine2": "Second line (gradient)",
     "subtitle": "Subtitle text",
     "primaryCTA": "Button text",
     "secondaryCTA": "Secondary button text",
     "secondaryLink": "/"
   }
   ```

3. **Pages import and render**: Each HTML page:
   ```javascript
   import { renderComingSoon } from '../ui/ComingSoonParent.js';
   const response = await fetch('../ui/variants/waitlist.json');
   const content = await response.json();
   renderComingSoon(content);
   ```

## Adding a New Coming Soon Page

1. **Create a new variant JSON** in `/ui/variants/`:
   ```bash
   cp ui/variants/waitlist.json ui/variants/my-new-page.json
   ```

2. **Edit the JSON content**:
   ```json
   {
     "titleLine1": "Your custom",
     "titleLine2": "headline.",
     "subtitle": "Your subtitle here",
     "primaryCTA": "Get Started",
     "secondaryCTA": "Learn More",
     "secondaryLink": "/"
   }
   ```

3. **Create a new HTML page** in `/pages/`:
   ```bash
   cp pages/waitlist.html pages/my-new-page.html
   ```

4. **Update the variant path** in the HTML:
   ```javascript
   const response = await fetch('../ui/variants/my-new-page.json');
   ```

5. **Done!** Your new page will automatically use the parent design.

## Updating the Design

To update the design across **all** Coming Soon pages:

1. Edit `/ui/ComingSoonParent.js`
2. Save the file
3. All variant pages automatically inherit the changes

No need to touch individual pages or JSON files unless you want to change their specific content.

## Benefits

✅ **Single source of truth**: One parent component controls all design  
✅ **Content separation**: JSON files keep content editable without touching code  
✅ **No redirects**: URLs stay as-is (e.g., `/waitlist` displays `/waitlist`)  
✅ **Scalable**: Add new variants by copying JSON + HTML  
✅ **Style isolation**: Shadow DOM prevents CSS conflicts  
✅ **Future-proof**: Parent updates propagate automatically  
✅ **Independent variants**: Editing one JSON doesn't affect others  

## Features

- ✨ Breathing radial gradient orb animation
- 📱 Fully responsive (mobile → tablet → desktop)
- ⌨️ Typing animation for "COMING SOON" text
- 🎨 Apple-minimal aesthetic with gradient text
- ♿ Respects `prefers-reduced-motion`
- 🌙 Dark mode support (follows system preference)
- 📦 Shadow DOM for style encapsulation
