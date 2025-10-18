# Coming Soon Variants

This directory contains JSON content files for all Coming Soon page variants.

## Current Variants

### waitlist.json
Used by: `/pages/waitlist.html`
Purpose: Early access waitlist signup page

### partners.json
Used by: `/pages/partners.html`
Purpose: BPO partner onboarding page

### labs.json
Used by: `/pages/labs.html`
Purpose: Innovation lab / experimental features page

### fallback.json
Used by: `/404.html` (standalone static 404)
Purpose: Fallback for broken URLs and pages coming soon

## JSON Structure

Each variant JSON file should follow this structure:

```json
{
  "logo": "/OnSpot Log Full Purple Blue_1757942805752.png",
  "logoAlt": "OnSpot",
  "logoLink": "/",
  "titleLine1": "First line of headline",
  "titleLine2": "Second line (will have gradient)",
  "subtitle": "Supporting text / description",
  "primaryCTA": "Primary Button Text",
  "secondaryCTA": "Secondary Button Text",
  "secondaryLink": "/"
}
```

## Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `logo` | string | Yes | Path to logo image |
| `logoAlt` | string | Yes | Alt text for logo |
| `logoLink` | string | Yes | URL when logo is clicked |
| `titleLine1` | string | Yes | First line of headline (standard gradient) |
| `titleLine2` | string | Yes | Second line of headline (violet-blue gradient) |
| `subtitle` | string | Yes | Supporting description text |
| `primaryCTA` | string | Optional | Primary button text (if omitted, button won't show) |
| `secondaryCTA` | string | Optional | Secondary button text |
| `secondaryLink` | string | Optional | URL for secondary button |

## Creating a New Variant

1. Copy an existing variant:
   ```bash
   cp waitlist.json my-new-variant.json
   ```

2. Edit the content:
   ```json
   {
     "logo": "/OnSpot Log Full Purple Blue_1757942805752.png",
     "logoAlt": "OnSpot",
     "logoLink": "/",
     "titleLine1": "Your custom",
     "titleLine2": "headline.",
     "subtitle": "Your description here",
     "primaryCTA": "Get Started",
     "secondaryCTA": "Learn More",
     "secondaryLink": "/"
   }
   ```

3. Create corresponding HTML page in `/pages/`:
   ```html
   <!-- Load your new variant -->
   <script type="module">
     import { renderComingSoon } from '../ui/ComingSoonParent.js';
     const response = await fetch('../ui/variants/my-new-variant.json');
     const content = await response.json();
     renderComingSoon(content);
   </script>
   ```

## Notes

- All variants share the same design from `ComingSoonParent.js`
- Changes to parent automatically apply to all variants
- Each variant is independent - editing one won't affect others
- Keep content concise for better mobile experience
- Test on multiple screen sizes after creating new variants
