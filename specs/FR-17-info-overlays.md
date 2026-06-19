# FR-17: Info Overlays & Welcome Panels

**Date**: 2026-06-19
**Status**: Spec complete, not implemented
**Priority**: Medium
**Estimated Effort**: 6-7 hours

---

## Concept

A flexible overlay system that supports multiple dismissible info panels, ranging from simple welcome messages to Wikipedia-linked tooltip cards. Each overlay is independently dismissible and can be positioned anywhere on the viewport.

---

## Overlay Types

| Type | Use Case | Appearance |
|------|----------|------------|
| `greeting` | Welcome message, instructions | Text box with optional title |
| `info` | Context about the current scene | Smaller tooltip-style box |
| `link` | Wikipedia article preview | Card with image, title, excerpt, CTA button |

---

## Tour JSON Schema

```json
{
  "default": {
    "firstScene": "museum",
    "overlays": [
      {
        "type": "greeting",
        "title": "Welcome to the Banned Books Museum",
        "message": "Drag to look around. Click **red arrows** to navigate between rooms.",
        "position": "bottom-left",
        "dismissText": "× Got it"
      },
      {
        "type": "link",
        "title": "Banned Books Museum",
        "url": "https://en.wikipedia.org/wiki/Banned_Books_Museum",
        "position": "top-right",
        "dismissText": "× Dismiss"
      }
    ]
  }
}
```

---

## Overlay Type: `greeting`

Simple text box with optional title and Markdown support.

```json
{
  "type": "greeting",
  "title": "Welcome!",
  "message": "This tour features **360° panoramas** of the museum.\n\n- Click red arrows to navigate\n- Click blue icons for info\n- Press `G` for gyroscope on mobile",
  "position": "bottom-left",
  "dismissText": "× Got it"
}
```

### Fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `type` | Yes | — | `"greeting"` |
| `title` | No | — | Bold heading |
| `message` | Yes | — | Body text (supports Markdown) |
| `position` | No | `"bottom-left"` | Where to show on viewport |
| `dismissText` | No | `"× Dismiss"` | Button label |

---

## Overlay Type: `info`

Smaller tooltip-style box for scene-specific context.

```json
{
  "type": "info",
  "message": "This room contains first editions from 1820-1860.",
  "position": "top-center",
  "dismissText": "Got it"
}
```

### Fields

Same as `greeting`, but typically no title (shorter, more tooltip-like).

---

## Overlay Type: `link`

Wikipedia-style card with image, title, excerpt, and call-to-action.

```json
{
  "type": "link",
  "title": "Banned Books Museum",
  "url": "https://en.wikipedia.org/wiki/Banned_Books_Museum",
  "position": "top-right",
  "dismissText": "× Dismiss"
}
```

### Fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `type` | Yes | — | `"link"` |
| `title` | Yes | — | Heading + Wikipedia article title to fetch |
| `url` | Yes | — | Wikipedia or external URL |
| `position` | No | `"top-right"` | Where to show |
| `dismissText` | No | `"× Dismiss"` | Button label |

### Behavior

- If URL is Wikipedia (`*.wikipedia.org/wiki/*`): Auto-fetch lead image + extract via REST API (same as hotspot Wikipedia cards)
- If URL is external: Show title + domain, link opens in new tab
- Card shows: image (if Wikipedia), title, excerpt, "Read more →" link

---

## Positioning

```
┌─────────────────────────────────────────────────────────┐
│ top-left      top-center      top-right                 │
│                                                         │
│                                                         │
│                                                         │
│                                                         │
│ bottom-left   bottom-center   bottom-right              │
└─────────────────────────────────────────────────────────┘
```

| Position | CSS |
|----------|-----|
| `top-left` | `top: 20px; left: 20px` |
| `top-center` | `top: 20px; left: 50%; transform: translateX(-50%)` |
| `top-right` | `top: 20px; right: 20px` |
| `bottom-left` | `bottom: 80px; left: 20px` (above footer) |
| `bottom-center` | `bottom: 80px; left: 50%; transform: translateX(-50%)` |
| `bottom-right` | `bottom: 80px; right: 20px` |

---

## Markdown Support

Lightweight Markdown in `message` fields:

| Syntax | Output |
|--------|--------|
| `**bold**` | **bold** |
| `*italic*` | *italic* |
| `` `code` `` | `code` |
| `[text](url)` | Clickable link |
| `- item` | Bullet list |
| `\n` | Line break |

**Implementation**: Use a tiny markdown parser (~50 lines) or inline regex replacements. No external dependency needed for this subset.

---

## Dismissal Behavior

- Each overlay dismissed independently
- Stored in `sessionStorage` as JSON array of dismissed IDs
- Key: `overlays-dismissed`
- Value: `["overlay-0", "overlay-2"]` (indices)
- Reappears on new session (not persistent across page reloads)
- Keyboard: `X` key dismisses the topmost overlay

---

## Multiple Overlays Behavior

- All overlays shown simultaneously on load (stacked by position)
- User dismisses each independently
- No sequential/step-by-step mode (keep it simple)
- Overlays don't block viewport interaction (click-through except on the overlay itself)

---

## Studio UI

Add "Overlays" section to Tour Settings:

```
┌─ Tour Settings ──────────────────────────────┐
│ ...                                          │
│ 📢 Overlays                                  │
│                                              │
│ ┌─ Overlay 1 ──────────────────────────────┐ │
│ │ Type: [greeting ▾]                       │ │
│ │ Title: [Welcome to the Museum     ]      │ │
│ │ Message: [Drag to look around...  ]      │ │
│ │ Position: [bottom-left ▾]                │ │
│ │ Dismiss: [× Got it              ]        │ │
│ │ [↑] [↓] [🗑 Delete]                     │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ ┌─ Overlay 2 ──────────────────────────────┐ │
│ │ Type: [link ▾]                           │ │
│ │ Title: [Banned Books Museum      ]       │ │
│ │ URL: [https://en.wikipedia.org/... ]     │ │
│ │ Position: [top-right ▾]                  │ │
│ │ [↑] [↓] [🗑 Delete]                     │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ [+ Add Overlay]                              │
│                                              │
└──────────────────────────────────────────────┘
```

---

## Implementation Effort

| Part | Effort | Notes |
|------|--------|-------|
| HTML/CSS for 3 overlay types | ~2 hours | Greeting, info, link cards |
| Markdown parser (lightweight) | ~30 min | Bold, italic, links, lists |
| Positioning system | ~30 min | 6 positions, responsive |
| Dismissal logic + sessionStorage | ~30 min | Per-overlay, keyboard shortcut |
| Wikipedia API fetch for `link` type | ~30 min | Reuse existing `WP_API` code |
| Studio UI (add/edit/delete overlays) | ~2 hours | Drag-to-reorder, type switching |
| JSON import/export | ~30 min | Follow 5-step rule |
| **Total** | ~6-7 hours | |

---

## Files to Modify

| File | Changes |
|------|---------|
| `prototype/tour_viewer.html` | Overlay HTML/CSS/JS, markdown parser, Wikipedia fetch |
| `prototype/studio.html` | Overlays editor panel |
| `prototype/studio.js` | `state.overlays`, import/export, validation |
| `HANDOVER.md` | Document feature |
| `FEATURE_REQUESTS.md` | Update FR-17 |
| `CAVEATS.md` | Overlay z-index, click-through, positioning gotchas |

---

## Visual Design

### Greeting Overlay

```
┌─────────────────────────────────────────────────────┐
│ × Got it                                            │
├─────────────────────────────────────────────────────┤
│  👋 Welcome to the Banned Books Museum              │
│                                                     │
│  Drag to look around. Click red arrows to navigate  │
│  between rooms. Click blue icons for info.          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Info Overlay

```
┌─────────────────────────────────────┐
│ This room contains first editions   │
│ from 1820-1860.              [Got it]│
└─────────────────────────────────────┘
```

### Link Overlay (Wikipedia)

```
┌─────────────────────────────────────┐
│ × Dismiss                          │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │       [Wikipedia Image]       │  │
│  └───────────────────────────────┘  │
│  Banned Books Museum                │
│  The Banned Books Museum is a       │
│  museum dedicated to books that     │
│  have been censored or banned...    │
│                                     │
│  Read on Wikipedia →                │
└─────────────────────────────────────┘
```

### Link Overlay (External)

```
┌─────────────────────────────────────┐
│ × Dismiss                          │
├─────────────────────────────────────┤
│  Banned Books Museum                │
│  example.org                        │
│                                     │
│  Visit site →                       │
└─────────────────────────────────────┘
```

---

## Edge Cases

1. **No overlays defined**: Nothing shown, no UI elements rendered
2. **Empty overlays array**: Same as above
3. **Invalid position**: Fall back to `bottom-left`
4. **Wikipedia API fails**: Show title + URL without image/excerpt
5. **Very long message**: Scrollable box, max-height with overflow
6. **Mobile viewport**: Overlays stack vertically if overlapping, smaller max-width
7. **Z-index conflicts**: Overlays at z-index 9000 (below video overlay at 10000)

---

## Testing Checklist

- [ ] Greeting overlay renders with title + message
- [ ] Markdown renders correctly (bold, italic, links, lists)
- [ ] Link overlay fetches Wikipedia image + excerpt
- [ ] Link overlay shows domain for external URLs
- [ ] All 6 positions work correctly
- [ ] Dismiss button hides overlay
- [ ] Dismissed state persists in sessionStorage
- [ ] X key dismisses topmost overlay
- [ ] Overlays don't block viewport interaction
- [ ] Multiple overlays can coexist
- [ ] Studio can add/edit/delete/reorder overlays
- [ ] Export includes overlays in JSON
- [ ] Import loads overlays correctly
- [ ] Mobile responsive layout works
