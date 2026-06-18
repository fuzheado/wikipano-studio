# Caveats & Gotchas — Photosphere Tours

Hard-won lessons from debugging this project. Read before touching hotspot CSS, export/preview paths, or server responses.

---

## 1. Pannellum: Never Use `transform` in Hotspot Keyframes

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

## 10. New Hotspot Subtype Checklist

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

## 11. DOM Element Order: HTML Before Script

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

## 12. Always Normalize Media Inputs Through `normalizeImageSource()`

`normalizeImageSource()` converts multiple Commons input formats into a canonical `File:` reference:
- `File:Glenstone_24.jpg` → `File:Glenstone_24.jpg` (pass-through)
- `https://commons.wikimedia.org/wiki/File:Glenstone_24.jpg` → `File:Glenstone_24.jpg`
- `Glenstone_24.jpg` → `File:Glenstone_24.jpg`
- Direct upload URL → pass-through unchanged

**Every media type using Commons files must run this BEFORE attempting File: resolution.** The audio and video `confirmAddHotspot` handlers do `videoUrl = normalizeImageSource(videoUrl)` before the `^File:` regex check. Without it, Commons page URLs are stored as-is (unplayable HTML pages, not media files).

---

## 13. Image Source Resolution Flow

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
