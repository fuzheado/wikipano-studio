# Caveats & Gotchas — Photosphere Tours

Hard-won lessons from debugging this project. Read before touching hotspot CSS, export/preview paths, or server responses.

---

## 0. Validate at Every Data Boundary

**Every checkpoint where data enters, transforms, or exits the system must validate hotspot integrity.** This is not optional — missing fields propagate silently through the pipeline and surface as confusing bugs much later (e.g., video URL lost on import, invisible on export, discovered days later).

**Checkpoints:**

| Stage | Function | Check |
|---|---|---|
| User adds/edits hotspot | `confirmAddHotspot()` | `validateHotspot(hs)` |
| Import from wiki/JSON | `importTourData()` | `validateTour()` |
| Export to JSON | `exportTour()` | `validateTour()` |
| Preview | `previewTour()` | `validateTour()` |
| Viewer loads tour | `enrichHotspots()` | Consider: warn on missing `audioUrl`/`videoUrl` |

**What to validate:** For each hotspot subtype (audio, video, scene), the corresponding URL/target field must be present. When adding a NEW subtype, add its check to `validateHotspot()` immediately. When adding a NEW data boundary (e.g., server-side validation, API endpoint), add a `validateTour()` call.

**How to validate:** Show ⚠️ in the status bar, log to console. Non-blocking — the user can proceed but knows something is wrong.

**When adding a new hotspot field** (e.g., `quizQuestion`, `portalUrl`):
1. Add it to `confirmAddHotspot()` (storage)
2. Add it to `importTourData()` (import)
3. Add it to `exportTour()` hotspot mapping (export)
4. Add it to `previewTour()` hotspot mapping (preview)
5. Add it to `validateHotspot()` (integrity check)
6. Add it to `renderHotspotList()` (UI badge)
7. Add it to viewer's `enrichHotspots()` (CSS class + behavior)

**Example: `iconStyle` field** — added in all 7 locations to support small/normal/large/huge icon size variants.

**This list is alive** — add new checkpoints as the codebase evolves.

---

## 1. Pannellum: All Hotspots Use Custom CSS Icons

**All hotspot types now use `cssClass` with custom CSS styling.** The viewer no longer relies on Pannellum's default sprites for scene/info hotspots — we provide our own icons via CSS `::after` pseudo-elements.

### Why this works

Pannellum's default sprites are small (26×26px) and inconsistent across types. Our custom CSS:
- Uses larger circles (44-50px) for better visibility
- Provides consistent emoji icons via `::after` content
- Supports size variants (small/normal/large/huge) via `iconStyle`
- Applies pulsing glow animations for visual feedback

### The `cssClass` Pattern

```javascript
// enrichHotspots sets cssClass for ALL types:
hs.cssClass = tagClass + sizeClass;  // e.g. "scene-hotspot icon-large"
```

The CSS uses `::after` to overlay the icon on top of Pannellum's default sprite, then hides the sprite:

```css
.scene-hotspot {
    background: #e94560 !important;  /* Replace sprite */
}
.scene-hotspot::after {
    content: '➤';  /* Overlay icon */
}
.scene-hotspot.pnlm-sprite {
    background-image: none !important;  /* Hide default */
}
```

### Historical Note

Previously, setting `cssClass` on scene/info hotspots prevented Pannellum from creating the default sprite child, making icons invisible. This caveat only applied when **relying on Pannellum's sprites**. With custom CSS providing the icons, `cssClass` is required for all types.

---

## 2. Pannellum: Never Use `transform` in Hotspot Keyframes

Pannellum positions every hotspot with an inline `transform` calculated from spherical pitch/yaw. Any CSS keyframe that sets `transform` will rip the hotspot out of position — it lands in the upper-left corner and stops tracking the panorama.

```css
/* ❌ BROKEN — hotspot jumps to (0,0) */
@keyframes pulse { 50% { transform: scale(1.1); } }

/* ✅ CORRECT — animate box-shadow/opacity only */
@keyframes pulse { 50% { box-shadow: 0 0 30px green; } }
```

Safe keyframe properties: `box-shadow`, `opacity`, `filter`, `outline-color`.
Also override Pannellum's sprite: `.my-class.pnlm-sprite { background-image: none !important; }`

Documented in the pannellum skill under "Hot Spot CSS: Never Use `transform` in Keyframe Animations".

---

## 2. Canonical URLs: Never Store Wiki References for Media

All media references (panorama images, audio files, any future types) in stored/exported JSON must be **canonical direct URLs**, never wiki page references or `File:` prefixes. The browser can't play `File:Sound.ogg` — it needs `https://upload.wikimedia.org/wikipedia/commons/x/xx/Sound.ogg`.

Resolution happens at input time in `confirmAddHotspot()`: `File:` references are resolved via `/api/resolve?file=...` before storage. The viewer's `resolveAudioFileUrl()` is a fallback for legacy data only.

Consistency check: images use `_original` (direct Commons URL), audio uses resolved `audioUrl` (direct Commons URL). Both follow the same pattern.

---

## 3. Export vs Preview: Different Path Strategies

| | Export JSON | Preview (local) |
|---|---|---|
| **Consumer** | Anyone, any server | `localhost:8765` viewer |
| **Image origin** | Cross-origin (Commons) | Must be same-origin for Pannellum |
| **Use field** | `_original` (canonical Commons URL) | Server-cached `/images/<hash>.jpg` |

**Export**: `s._original || await resolvePanoramaForPreview(s.panorama)`
**Preview**: `await resolvePanoramaForPreview(scene.panorama)` — never use `_original`

Mixing these up causes Pannellum to fail with "could not be accessed" on cross-origin Commons URLs during local preview.

---

## 4. Server: `/api/resolve-url` Must Return Flat Object

The server's `/api/resolve-url` endpoint returns the result of `cacheImage()`, which is `{ url, thumb, original }`. It must be returned **directly**, not wrapped:

```javascript
// ✅ CORRECT
jsonResponse(res, 200, cached);

// ❌ BROKEN — client gets nested object where data.url is an object
jsonResponse(res, 200, { url: cached });
```

The client reads `data.url` (expects a string path), `data.thumb`, `data.original`. Nesting breaks all three.

---

## 5. Yaw Normalization: Three-Layer Defense

Pannellum's JSON Schema requires yaw in [-180, 180]. Pannellum itself normalizes out-of-range values internally, but exported JSON should be spec-compliant.

| Layer | Where | What |
|---|---|---|
| **Prevent** | `mousedown` handler in studio | `normalizeYaw()` before storing in `state.capturedCoords` |
| **Defend** | `exportTour()`, `previewTour()` | `normalizeYaw()` in hotSpots mapping |
| **Fix** | `scripts/validate-pannellum.mjs --fix` | Batch-fix existing wiki page JSON |

Normalization formula: `((yaw % 360) + 540) % 360 - 180`

---

## 6. Hotspot Click Handling in Studio: Prevent, Don't Undo

When intercepting hotspot clicks in the studio (edit mode), the old approach let Pannellum's navigation fire then tried to undo it with a `setTimeout` + `loadSceneIntoViewport()`. This caused visible viewport resets.

**Correct approach**: suppress Pannellum's `onclick` entirely:
```javascript
el.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    editHotspot(state.activeSceneId, idx);
    return false;
};
```

Never call `origOnclick` — the studio is an editor, not a viewer.

---

## 7. Export Radio Button Toggle: Cache Resolved Data

When the Export modal has radio buttons ("Entire project" / "Current scene only"), the JSON must regenerate instantly when the user toggles. The pattern:

1. `exportTour()` resolves all scene data once → stores in `_exportResolvedScenes`
2. Radio `change` event → calls `updateExportTextarea()` (sync) → filters cached data → updates textarea
3. No re-fetching on toggle

Generating JSON before showing the modal and not adding radio listeners = toggling does nothing.

---

## 8. Custom Hotspot Types: Subtype Pattern

Pannellum only has `type: "info"` and `type: "scene"`. For custom types (audio, quiz, etc.):

- Store Pannellum `type: "info"` (baseline)
- Store `hotspotSubtype: "audio"` (custom field)
- Store type-specific data: `audioUrl`, `quizQuestion`, etc.
- Use `cssClass` for visual differentiation
- Preserve all custom fields in export/import

The studio's `confirmAddHotspot()` handles this mapping; `renderHotspotList()` and `loadSceneIntoViewport()` read `hotspotSubtype` for badge icon and cssClass.

---

## 9. Viewport Preservation During Editing

Any operation that reloads the viewer (`loadSceneIntoViewport`) must capture and restore the current view position (pitch/yaw/hfov). The function accepts an optional `viewOverride` parameter:

```javascript
// When reloading after add/edit/delete:
const v = state.pannellumViewer;
const view = { pitch: v.getPitch(), yaw: v.getYaw(), hfov: v.getHfov() };
loadSceneIntoViewport(sceneId, view);
```

**Check all callers of `loadSceneIntoViewport`** — each must decide whether to preserve the view (add/edit/delete hotspots) or use scene defaults (switching to a different scene).

---

## 10. Every Viewer Creation Path Must Call `enrichHotspots`

The viewer has 3 independent creation paths:
1. Main load (`#User:Fuzheado/Panellum_Tour`)
2. localStorage preview (`#preview=local`)
3. Server preview (`#preview=<key>`)

**All 3 must call `enrichHotspots(config.scenes)` before `pannellum.viewer()`.** `enrichHotspots` tags hotspots with CSS classes (`scene-hotspot`, `audio-hotspot`, etc.) and sets up `createTooltipFunc`. Missing this call in any path silently breaks scene navigation, audio/video playback, and click-to-toggle.

When adding features that depend on `enrichHotspots`, check all 3 paths. Use `grep "pannellum.viewer"` to find every creation site.

---

## 11. New Hotspot Subtype Checklist

When adding a new hotspot subtype (audio, video, quiz, etc.), **every** location that switches on type/subtype must be updated. Missing one causes fall-through to the `info` default — producing a wrong icon, wrong badge, wrong behavior, with no obvious error.

**Required touchpoints in studio.js:**
1. `loadSceneIntoViewport()` — `typeClass` ternary (cssClass for Pannellum)
2. `renderHotspotList()` — `typeLabel` ternary (badge text) + detail rendering
3. `updateHsModalFields()` — show/hide type-specific input group
4. `confirmAddHotspot()` — store custom fields (`hotspotSubtype`, type-specific URL)
5. `addHotspot()` / `editHotspot()` — clear/set type-specific form fields
6. Export mapping (`exportTour`, `buildExportJSON`) — preserve custom fields
7. Preview mapping (`previewTour`) — preserve custom fields
8. Import mapping (`importTourData`) — preserve custom fields

**Required touchpoints in studio.html:**
1. `<select id="modal-hs-type">` — add option
2. Modal — add type-specific input group div
3. CSS — `.studio-xxx-hs` icon styles, `.hs-type.xxx` badge color
4. CSS — `.studio-xxx-hs.pnlm-sprite` sprite override

**Required touchpoints in tour_viewer.html:**
1. `enrichHotspots()` — add cssClass condition
2. CSS — `.xxx-hotspot` icon styles + `.pnlm-sprite` override
3. Interception function + MutationObserver
4. Wire calls in all 6 scenechange/load handlers

---

## 12. DOM Element Order: HTML Before Script

If JavaScript references DOM elements by ID at the top level (parse time, not inside an event handler), those elements must appear **before** the `<script>` tag in the HTML. `getElementById()` at parse time returns `null` for elements defined later in the document.

This manifested as the video overlay HTML being placed after `</script>`, causing `videoClose.addEventListener(...)` to throw a TypeError that silently broke preview initialization.

```html
<!-- ❌ BROKEN — script runs before overlay is parsed -->
<script> var el = document.getElementById('video-overlay'); // null! </script>
<div id="video-overlay">...</div>

<!-- ✅ CORRECT -->
<div id="video-overlay">...</div>
<script> var el = document.getElementById('video-overlay'); // works </script>
```

---

## 13. Always Normalize Media Inputs Through `normalizeImageSource()`

`normalizeImageSource()` converts multiple Commons input formats into a canonical `File:` reference:
- `File:Glenstone_24.jpg` → `File:Glenstone_24.jpg` (pass-through)
- `https://commons.wikimedia.org/wiki/File:Glenstone_24.jpg` → `File:Glenstone_24.jpg`
- `Glenstone_24.jpg` → `File:Glenstone_24.jpg`
- Direct upload URL → pass-through unchanged

**Every media type using Commons files must run this BEFORE attempting File: resolution.** The audio and video `confirmAddHotspot` handlers do `videoUrl = normalizeImageSource(videoUrl)` before the `^File:` regex check. Without it, Commons page URLs are stored as-is (unplayable HTML pages, not media files).

---

## 14. Image Source Resolution Flow

Original title (moved from section 12). The full resolution flow:

```
User input → normalizeImageSource() → stored in scene.panorama
                                          ↓
                      loadSceneIntoViewport() → resolveSceneImage() → cached /images/ path
                                          ↓
                      exportTour() → _original (Commons URL) or resolvePanoramaForPreview()
                                          ↓
                      previewTour() → resolvePanoramaForPreview() → same-origin cached path
```

---

## 15. Scene Thumbnails: Use Proxied Paths, Not Direct Commons URLs

The server's `/api/tour` endpoint returns `scene._thumb` as a **direct Commons URL** (e.g., `https://upload.wikimedia.org/.../200px-...`). This is fine for export but **CORS-blocked** when used as a CSS `background-image` in the browser.

**Wrong:** Use `scene._thumb` directly → `net::ERR_BLOCKED_BY_ORB`
**Right:** Use `scene.panorama` (the `/images/<hash>.jpg` proxy path) → browser scales via `background-size: cover`

The `getSceneThumbnail()` function in both Studio and Viewer ignores `_thumb` and returns the panorama path. No extra network requests, no CORS issues.

```javascript
// Both Studio and Viewer use this pattern:
function getSceneThumbnail(scene) {
    const pano = scene.panorama || '';
    if (pano.startsWith('/images/')) return pano;  // ✅ proxied, same-origin
    return '';
}
```

**When adding thumbnails to a new UI**: Always check if the path starts with `/images/`. Never use `scene._thumb` or any direct Commons URL in CSS `background-image` or `<img src>` — the browser will block it.

---

## 16. Pannellum Wraps Hotspots in `<a target="_blank">` for URL Hotspots

When a hotspot has a `URL` field, Pannellum wraps the hotspot `<div>` in an `<a href="..." target="_blank">` element. This creates a **nested click handler problem**: clicking anything inside the hotspot (close button, tooltip links) bubbles up to the `<a>` and triggers navigation.

### DOM Structure (unexpected)
```html
<a href="https://en.qrwp.org/..." target="_blank">  ← Pannellum adds this
  <div class="pnlm-hotspot-base wp-card-hotspot">
    <div class="wp-card-tooltip visible">
      <button class="info-popup-close">×</button>  ← click here opens new tab!
    </div>
  </div>
</a>
```

### Fix
In `_doInterceptInfo()`, add a **capture-phase** click listener on the `<a>` parent that blocks navigation when the click originated inside `.wp-card-tooltip`:

```javascript
var anchorParent = el.closest('a');
if (anchorParent) {
    anchorParent.addEventListener('click', function(e) {
        if (e.target.closest('.wp-card-tooltip')) {
            e.preventDefault();  // block <a> navigation
            return false;
        }
    }, true);  // capture phase — fires before <a> default action
}
```

Also, close button handlers must use `e.preventDefault()` **in addition to** `e.stopPropagation()` — `stopPropagation` alone doesn't prevent the `<a>` default action.

### Why `stopPropagation` alone isn't enough
`stopPropagation()` prevents bubbling to parent elements, but the `<a>` element's default navigation action fires **after** all handlers complete. Only `preventDefault()` stops the navigation.

---

## 17. CSS Opacity Animations Affect All Children

The `info-pulse` keyframe animates `opacity` on `.wp-card-hotspot`. Since the `.wp-card-tooltip` card is a **child** of the hotspot div, the entire card (text, images, close button) pulses opacity too.

### Fix
Stop the animation when the card is open using `:has()`:

```css
.wp-card-hotspot:has(.wp-card-tooltip.visible) {
    animation: none !important;
}
```

**Rule of thumb**: If a parent element has a pulsing/glowing animation, check whether any child elements (tooltips, cards, overlays) inherit the animation undesirably. Use `:has()` or a JS-toggled class to suppress the animation when child content is visible.

---

## 18. Reusable Patterns

### Capture-Phase Anchor Interceptor

Pannellum wraps hotspots in `<a target="_blank">` when they have a URL. Any interactive element inside (close button, form input, inner link) will trigger navigation on click. This pattern blocks it:

```javascript
// Add to _doInterceptInfo or wherever hotspots are initialized
var anchorParent = el.closest('a');
if (anchorParent) {
    anchorParent.addEventListener('click', function(e) {
        if (e.target.closest('.your-interactive-child')) {
            e.preventDefault();  // blocks <a> navigation
        }
    }, true);  // capture phase — fires before <a> default action
}
```

Works for: close buttons, form inputs, dropdown menus, or any interactive element nested inside a Pannellum hotspot card.

### `stopPropagation()` vs `preventDefault()`

| | `stopPropagation()` | `preventDefault()` |
|---|---|---|
| **Prevents** | Event bubbling to parent elements | Element's own default action |
| **Doesn't prevent** | Default action (navigation, form submit) | Other handlers on the same element |
| **Use when** | You don't want parent handlers to fire | You don't want the browser to do its default thing |

Common mistake: using `stopPropagation()` on a close button inside an `<a>` tag. The event stops bubbling, but the `<a>` still navigates. You need `preventDefault()` for that.

### Selective Event Blocking in Nested Interactive Elements

When you have multiple interactive elements nested inside each other (e.g., a close button AND a navigation link inside a tooltip card inside a hotspot), **don't blanket-block all clicks**. You need to be selective:

```javascript
// ❌ BROKEN — blocks ALL clicks, including "Read on Wikipedia" links
anchorParent.addEventListener('click', function(e) {
    if (e.target.closest('.wp-card-tooltip')) {
        e.preventDefault();
    }
}, true);

// ✅ CORRECT — exempts actual links inside the card
anchorParent.addEventListener('click', function(e) {
    if (e.target.closest('.wp-card-tooltip')) {
        if (e.target.closest('a[href]')) return;  // let links navigate
        e.preventDefault();  // block everything else
    }
}, true);
```

The same applies to the parent element's onclick handler — it must also skip when the click is on a child element that should navigate:

```javascript
el.onclick = function(e) {
    // Skip if clicking a link inside the card
    if (e.target.closest('.wp-card-tooltip a[href]')) return;
    e.preventDefault(); e.stopPropagation();
    // ... toggle card visibility
};
```

### Checklist: Nested Interactive Elements

When adding a new interactive element inside a Pannellum hotspot card, verify all three event layers:

1. **Capture-phase `<a>` interceptor** — does it allow/block the right clicks?
2. **Hotspot `onclick`** — does it skip when the click is on the new element?
3. **Element's own handler** — does it use both `preventDefault()` and `stopPropagation()`?

Test all three scenarios: open card, interact with new element, close card.

---

## 16. Thumbnail Fix: Resolve Images Before Rendering

**Problem**: When adding a new scene, the thumbnail in the left sidebar was blank because the panorama URL was still a `File:` reference (not resolved to `/images/` path) when `renderSceneList()` was called.

**Root cause**: `addScene()` set `panorama: "File:MyPhoto.jpg"` but didn't resolve it to a cached `/images/` path before calling `renderSceneList()`. The `getSceneThumbnail()` function only works with `/images/` paths.

**Fix**: Make `addScene()` async and call `resolveSceneImage()` before rendering:

```javascript
async function addScene(imageUrl, title) {
    // ... create scene ...
    
    // Resolve the image URL to get cached /images/ path for thumbnails
    try {
        const resolvedUrl = await resolveSceneImage(scene);
        scene.panorama = resolvedUrl;
    } catch(e) {
        console.warn('Failed to resolve image for thumbnail:', e);
    }

    renderSceneList();  // Now panorama is /images/abc123.jpg
    // ...
}
```

**Lesson**: When creating objects that will be rendered immediately, ensure all URLs are resolved to their final form before rendering. Don't assume the rendering function can handle intermediate states.

**Related**: This is similar to the export/preview path issue (CAVEATS.md §11) where `_original` fields must be set before export.

---

## 16. Chrome May Require Full Restart After Server Changes

**Date**: 2026-06-19

**Symptom**: Page works in Incognito and fresh Playwright browser, but not in regular Chrome. Hard refresh (`Cmd+Shift+R`) doesn't help.

**Root Cause**: Chrome maintains internal state (connection pools, DNS cache, TLS session cache) that isn't cleared by hard refresh. When the server changes behavior (e.g., removing streaming, adding cache-busting), Chrome may reuse stale connections or cached responses from the old server behavior.

**Solution**: Fully quit Chrome (`Cmd+Q` on Mac, `Ctrl+Shift+W` on Windows) and restart it. This clears all internal state.

**Why Incognito works**: Incognito mode starts with fresh internal state — no cached connections, no DNS cache, no TLS sessions.

**Rule of Thumb**: If a page works in Incognito but not in regular Chrome, and hard refresh doesn't help, fully quit and restart Chrome before debugging further.

---

## 16. NEVER Stream Responses for Pannellum Image Loading

**Date**: 2026-06-19
**Symptom**: `net::ERR_FAILED 200 (OK)` — server returns HTTP 200 but browser fails to read response as Blob.
**Error**: `Failed to execute 'readAsBinaryString' on 'FileReader': parameter 1 is not of type 'Blob'.`

### The Mistake

Using `createReadStream().pipe(res)` for serving large images:

```javascript
// ❌ BROKEN — causes net::ERR_FAILED 200 (OK)
if (stat.size > 1024 * 1024) {
    const { createReadStream } = await import('node:fs');
    createReadStream(filePath).pipe(res);
} else {
    const content = await readFile(filePath);
    res.end(content);
}
```

### Why It Breaks

Pannellum loads panorama images via `XMLHttpRequest` and expects a **complete response** it can read as a Blob. When using `createReadStream().pipe(res)`:
- The response stream may not finalize properly before XHR tries to read it
- The browser sees a 200 status but can't construct a valid Blob from the streamed response
- Result: `net::ERR_FAILED 200 (OK)` — technically successful but practically broken

### The Fix

Always use `readFile()` for serving images to Pannellum:

```javascript
// ✅ WORKING — loads entire file into memory before responding
const content = await readFile(filePath);
res.end(content);
```

### When Streaming IS OK

- Serving to `<img>` tags (browser handles streaming natively)
- Serving to `fetch()` with `response.blob()` (different from XHR)
- Serving video/audio (different loading mechanism)

### When Streaming Is NOT OK

- Pannellum panorama images (uses XHR + FileReader)
- Any client that reads response as Blob via XHR
- WebGL texture loading (expects complete response)

### Rule of Thumb

**For Pannellum image serving: always buffer the entire file in memory before responding.** The memory cost is worth the reliability.

---

## 17. Cache-Control Headers Are Critical for Image Performance

**Date**: 2026-06-19

Without `Cache-Control` headers, browsers re-download images on every page load, even if the images haven't changed. Always add caching headers for static assets:

```javascript
// ✅ Add caching headers for images
if (pathname.startsWith('/images/')) {
    headers['Cache-Control'] = 'public, max-age=604800, immutable'; // 1 week
}

// ✅ Don't cache error responses
if (err) {
    res.writeHead(404, { 'Cache-Control': 'no-store' });
}
```

This prevents the "works in Incognito but not regular browser" issue where browsers cache error responses.

---

## 18. TOML is Legacy Ingest-Only — JSON is Canonical

**Date**: 2026-06-19

**Decision**: JSON is the canonical format for all tour definitions. TOML is supported for ingestion only (backward compatibility).

### Why

1. **Pannellum uses JSON natively** — no conversion needed
2. **JSON is the web standard** — all tools and libraries work with it
3. **Simplifies codebase** — only one format to maintain for export/preview/validation
4. **Round-trip fidelity** — our TOML parser is a one-to-one mapping of JSON, so conversion is lossless

### Current Behavior

- **Ingestion**: Auto-detects JSON vs TOML, converts TOML to JSON internally
- **Export**: Always produces JSON (never TOML)
- **Preview**: Always uses JSON (stored in localStorage)
- **Studio**: Saves in JSON format only

### TOML Parser Limitations

Our TOML parser (`tour_server.mjs`) supports:
- Sections (`[section]`)
- Arrays of tables (`[[array]]`)
- Strings, numbers, booleans
- Nested objects

It does NOT support:
- Datetime values
- Inline tables
- Multi-line strings
- Comments (though we could add support)

### What This Means for Users

1. **Existing TOML wiki pages** — continue to work (ingested and converted to JSON)
2. **New tours** — should be created in JSON format
3. **Hand-editing** — users who prefer hand-editing can still use TOML, but it will be converted to JSON on import
4. **Documentation** — all examples and templates should use JSON format going forward

### Migration Path

**Phase 1** (current): Both formats supported for ingestion
**Phase 2** (future): Deprecation warnings for TOML ingestion
**Phase 3** (long-term): Remove TOML parser, require JSON

### Rule of Thumb

**Always use JSON for new work.** TOML is only for backward compatibility with existing wiki pages.
