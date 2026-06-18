# Handover Document - Wikimedia Photosphere Tours

**Date**: 2026-06-18 (updated)
**Session**: Mobile gyroscope toggle, icon consistency, icon size variants

---

## Current State (Quick Reference)

| Feature | Status |
|---|---|
| Scene link nav + icon | ✅ |
| Info click-to-toggle + Show All | ✅ |
| `&open=0,2` URL param | ✅ |
| Audio 🎵 + Video 🎬 | ✅ |
| Export (all/current, _original URLs) | ✅ |
| Import/Export preserve videoUrl | ✅ |
| Yaw normalization [-180,180] | ✅ |
| Viewport preservation on edit | ✅ |
| `?scene=` URL param | ✅ |
| JSON validator (`--fix`) | ✅ |
| Integrity checks at all boundaries | ✅ |
| Scene thumbnails (Studio + Viewer) | ✅ |
| Set default view for scene | ✅ |
| Hotspot repositioning (Set to Current View) | ✅ |
| Icon consistency (Studio = Viewer) | ✅ |
| Icon size variants (`iconStyle`) | ✅ |
| **Mobile gyroscope toggle** | ✅ |

### Architecture Quick Notes
- **Hotspot subtype pattern**: `hotspotSubtype` (audio/video) + custom URL fields → Pannellum `type: "info"`
- **Export vs Preview**: Export uses `_original` (canonical Commons URLs), Preview uses `/images/` (same-origin cached)
- **Pannellum 2.5.7**: All hotspots now use `cssClass` with custom CSS `::after` for icons
- **Class tagging**: `cssClass` set for ALL hotspot types (scene/info/audio/video/wp-card-hotspot)
- **5-step rule**: Every new field must touch storage, import, export, preview, validation.

### Pannellum 2.5.7 Gotchas
1. All hotspots use `cssClass` + custom CSS with `::after` for icons (no longer rely on Pannellum sprites)
2. `transform` in CSS keyframes overrides Pannellum's inline positioning — use `box-shadow`/`opacity` instead
3. Literal `<script>` in HTML comments breaks the page
4. `::after` pseudo-element overlays icon on top of any child elements (works with Wikipedia cards)
5. **Gyroscope requires HTTPS**: Pannellum's `isOrientationSupported()` returns false on `http:` — only works on `https:` (privacy requirement for DeviceOrientationEvent API)

### Roadmap
- **Phase 2.5**: Toolforge deployment (`wikipano`), `{{PanoTour}}` template, OAuth save-to-wiki
- **Phase 3**: Auto-popup in field of view, GPS/maps, gallery, multilingual, tour discovery

### Debug Commands
```bash
playwright-cli open
playwright-cli goto http://localhost:8765/tour_viewer.html
playwright-cli eval "Array.from(document.querySelectorAll('.pnlm-hotspot-base')).map(function(e,i){return i+':kids='+e.children.length+' '+e.className.split(' ').slice(0,3).join('+')}).join('|')"
playwright-cli eval "var el=document.querySelector('.pnlm-render-container .pnlm-scene');el?('vis='+el.style.visibility):'NONE'"
playwright-cli console
```

---

## Quick Start (Next Session)

```bash
cd /Users/alih/Documents/ai/photospheres/prototype
node tour_server.mjs
# Open http://localhost:8765/studio.html
# Demo: http://localhost:8765/studio.html?page=User:Fuzheado/Panellum_Tour
```

Do NOT run `rm -rf cache images` on startup - that wipes cached Commons images and breaks previews. The images cache is now managed with 1-hour TTL.

---

## What's Built

### Tour Viewer (`tour_viewer.html`)
- Pannellum-based 360° viewer with scene sidebar (thumbnails via CSS background-size:cover)
- Loads tours from wiki pages: `#User:Fuzheado/Panellum_Tour`
- Loads previews from localStorage: `#preview=local`
- Wikipedia rich info cards on hotspot hover (fetches lead image + extract from REST API)
- Handles TOML + JSON formats via server API
- **Mobile gyroscope toggle**: 🧭 button in footer (only visible on mobile + HTTPS)

### Visual Studio (`studio.html` + `studio.js`)
- 360° viewport with click-to-capture coordinates for hotspot placement
- Import tours from wiki (`?page=` URL param) or paste JSON
- Scene management: add/delete, thumbnails from Commons 200px API
- Hotspot editor: info (URL + tooltip) and scene links, with edit-in-place
- Export as JSON (download or copy) with scope selector (Entire project / Current scene only)
- Export panorama paths use original Commons URLs (not cached `/images/` paths)
- Preview via localStorage (no server dependency)
- Cycle hotspots with "Show All" button
- Hover hotspot cards → viewport pans to face them
- Yaw auto-normalized to [-180, 180] per Pannellum JSON Schema (at capture, export, and preview)
- Purple ▶️ icons for video hotspots (popup overlay player — Commons + YouTube)
- Green 🎵 icons for audio hotspots (pulsing glow, plays Commons sound files in viewer)
- Red ➤ icons for scene links, blue ⓘ for info hotspots (pulsing, glowing)
- **Icon consistency**: Studio and Viewer use identical CSS for all hotspot icons (44-50px circles with emoji)
- **Icon size variants**: `iconStyle` field with options: `normal`, `small` (32px), `large` (60px), `huge` (80px)
- `?scene=` URL parameter: direct-link to a specific scene for editing; URL stays in sync
- Viewport position preserved across all editing operations (add/edit/delete hotspots)
- Set as Default View: Capture current viewport as scene's default yaw/pitch/hfov (button in properties panel)
- Set to Current View: Reposition hotspots by navigating to desired spot and clicking button in edit modal

### Server (`tour_server.mjs`)
- Zero external dependencies (Node.js built-ins only)
- Endpoints:
  - `GET /api/tour?page=...` - fetch + parse + resolve tour from Commons wiki
  - `GET /api/resolve?file=...` - resolve Commons File: → cached image path
  - `GET /api/resolve-url?url=...` - cache + resolve direct URL
  - `POST /api/preview` / `GET /api/preview/:key` - server-side preview storage
  - Static files: `tour_viewer.html`, `studio.html`, cached images at `/images/`
- TOML parser (subset: sections, arrays of tables, strings, numbers, booleans)
- Commons image download + SHA-256 hash caching with 1-hour TTL
- Commons thumbnail URL generation (200px for scene list)

### PHP Reference (`tour_config.php`)
- Standalone PHP equivalent for environments that can't run Node.js
- Not deployed - the Node.js server deploys directly to Toolforge as-is

---

## File Layout

```
photospheres/
├── RESEARCH_REPORT.md       # Library comparison (Pannellum vs PSV vs Marzipano)
├── PRD.md                   # Product requirements
├── DEVELOPMENT.md           # Build status + roadmap
├── HANDOVER.md              # This file
├── adr/
│   ├── README.md            # ADR index
│   ├── 001-pannellum-phase-1.md
│   ├── 002-wiki-page-storage.md
│   ├── 003-hash-cache-paths.md
│   ├── 004-dual-format.md
│   ├── 005-nodejs-prototype.md
│   ├── 006-toml-json-yaml.md
│   └── 007-hotspot-icons-postmortem.md
├── DEBUGGING.md             # Visual debugging guide (playwright-cli patterns for 360° viewport)
├── scripts/
│   ├── dump-state.js                # Playwright run-code script for full state introspection
│   └── validate-pannellum.mjs       # Pannellum JSON Schema validator + auto-fix
└── prototype/
    ├── tour_server.mjs       # Server (the main entry point)
    ├── tour_viewer.html      # End-user viewer
    ├── studio.html           # Visual editor UI
    ├── studio.js             # Editor logic (~650 lines)
    ├── tour_config.php       # Standalone PHP equivalent (reference only)
    ├── sample_tour.json      # Template
    ├── HOW_TO_CREATE_A_TOUR.txt
    └── README.md
```

---

## Key Architecture Decisions (ADRs)

| # | Decision | Why |
|---|---|---|
| 001 | Pannellum over Photo-Sphere-Viewer for Phase 1 | Already on Toolforge, Commons integration exists |
| 002 | Wiki pages as tour storage | Zero infra, full collaboration (history, talk, watchlists) |
| 003 | SHA-256 hash image cache paths | Avoids CORS, URL-encoding issues with proxy patterns |
| 004 | Dual TOML + JSON support | Existing tours use TOML; JSON better for tooling |
| 005 | Node.js prototype, Node.js on Toolforge | Zero deps for dev; deploy prototype directly as new Toolforge tool |
| 006 | JSON canonical, TOML supported, YAML excluded | TOML is valid (tested against tomllib), YAML too fragile for wiki |
| 007 | Hotspot icon visibility postmortem | Pannellum sprite override, solid colors, glow, pulsing |

---

## Debugging Guide

`photospheres/DEBUGGING.md` documents how to visually debug the Studio and Viewer using `playwright-cli` (already installed). Key techniques:

- **Three-layer model**: DOM (snapshot), Network/JS (console), WebGL canvas (eval into Pannellum API)
- **360° viewport inspection**: use `eval` to call `state.pannellumViewer.*` and `state.scenes[...].hotSpots` - the WebGL canvas is opaque to DOM-based tools
- **Programmatic hotspot placement**: bypass UI clicks by injecting hotspot objects into `state` and re-rendering
- **Script automation**: `playwright-cli run-code scripts/dump-state.js` snapshots the entire editor state as JSON
- **VLM fallback**: if text-only eval can't answer a visual question, use `fetch_content` on a screenshot (uses Gemini internally) or delegate to a vision-capable subagent via `model` override

## Known Issues & Gotchas

1. **Don't clear cache on restart** - `rm -rf cache images` breaks active previews and forces re-download of 7MB images
2. **TOML parser is a subset** - handles sections, arrays of tables, basic types. Doesn't support inline tables or multiline strings
3. **`File:` references in studio** - resolved server-side on save, not live in the viewport. The studio shows the pre-resolution path
4. **Headless Chrome `readPixels`** - returns black because Pannellum doesn't set `preserveDrawingBuffer: true`. This is normal; use DOM inspection instead of pixel reading for tests
5. **`window.open()` in tests** - Playwright opens tabs in a shared context; localStorage IS shared but sessionStorage may not be
6. **Pannellum inline styles** - use `!important` + combined selectors (`.my-class.pnlm-sprite`) to override default hotspot appearance
7. **Yaw values outside [-180, 180]** — existing tours on Commons may have out-of-range yaw (Pannellum normalizes internally). Studio now auto-normalizes at capture/export; use `node scripts/validate-pannellum.mjs <file> --fix` to batch-fix wiki page JSON
8. **URLs with spaces** — some hot spot URLs on Commons contain spaces (e.g. `The New Class: An Analysis...`). Pannellum handles these, but the JSON Schema URI format validator flags them. Use `--fix` to encode

## This Session (2026-06-17)

### Bug Fix: Export Panorama Paths
- Export was using cached `/images/3b3625c00fa4245e.jpg` paths instead of original Commons URLs
- Root cause: server's `handleTourAPI` mutated `scene.panorama` to cached path, and export's `resolvePanoramaForPreview` returned `/images/` paths as-is
- Fix: `exportTour()` and `previewTour()` now prefer `s._original` (stored by import and `resolveSceneImage`) over `s.panorama`
- Server `/api/resolve-url` fixed: was returning `{url: {url:..., original:...}}` (nested) — now returns flat `{url, thumb, original}`

### Bug Fix: Export Scope Radio Buttons
- Added "Entire project" (default) / "Current scene only" radio buttons in Export modal
- Radio change listeners update the JSON textarea instantly (no re-fetch — pre-resolved data)
- Fixed UI flow: previously `exportTour()` generated JSON before showing modal, so toggling had no effect

### Feature: Yaw Auto-Normalization
- `normalizeYaw()` added: wraps values to [-180, 180] per Pannellum JSON Schema `yaw` constraint
- Applied at three layers: capture time (mousedown handler), export path, preview path
- Prevents out-of-range yaw (-273°, 250°, etc.) from ever entering state or exported JSON
- Imported data with out-of-range yaw still gets normalized on export

### Tool: Pannellum JSON Schema Validator
- New `scripts/validate-pannellum.mjs` — validates tour/config JSON against official Pannellum JSON Schema
- Uses AJV with `ajv-formats` for URI validation
- Semantic checks: `firstScene` cross-reference, `sceneId` targets, yaw ranges, URL encoding
- `--fix` mode: auto-normalizes yaw and URL-encodes spaces in-place
- `--raw` flag: shows unfiltered schema errors for debugging
- Tested against `User:Fuzheado/Panellum_Tour.json` on Commons — found 4 fixable spec violations (3 yaw, 1 URL space)

### Feature: Audio Hotspot Type (2026-06-17)
- New hotspot subtype: `Audio 🎵` — plays a sound file (Commons .ogg/.mp3) on click in the viewer
- Custom subtype pattern: maps to Pannellum `type: "info"` + `hotspotSubtype: "audio"` + `audioUrl`
- Studio: green pulsing 🎵 icon, audio URL input in modal, "AUDIO" badge in hotspot list
- Viewer: `interceptAudioHotspots()` wraps `.audio-hotspot` onclick → play/pause, `.playing` CSS class
- Export/import preserves `hotspotSubtype` and `audioUrl` fields
- CSS fix: removed `transform: scale()` from `@keyframes audio-wave` (overrides Pannellum's inline positioning)
- Viewer CSS: full `.audio-hotspot` styling (green 44px circle, 🎵 icon, `.pnlm-sprite` override)

### Bug Fix: Preview Path (2026-06-17)
- Export uses `_original` (canonical Commons URL); preview must use cached `/images/` paths (same-origin)
- Preview was incorrectly using `_original` → Pannellum failed with "could not be accessed" on cross-origin URLs
- Reverted `previewTour()` to use `resolvePanoramaForPreview()` only (no `_original` fallback)

### Feature: `?scene=` URL Parameter (2026-06-17)
- `?page=...&scene=Museum` jumps directly to a scene on load
- `selectScene()` calls `history.replaceState` to keep URL in sync — shareable/bookmarkable
- Falls back to first scene gracefully if specified scene doesn't exist

### Feature: Video Hotspot (2026-06-17)
- New hotspot subtype: `Video 🎬` — popup overlay player supporting Commons + YouTube
- Studio: purple ▶️ icon, File: resolution at input time, `hotspotSubtype: "video"` + `videoUrl`
- Viewer: MutationObserver-based onclick interception, popup overlay with iframe (YouTube) or `<video>` tag (Commons/direct)
- Overlay: 90vw × 85vh, close via × / backdrop click / Escape key
- Fix: video overlay HTML must be before `<script>` — `getElementById` at parse time returns null for later elements
- Added to CAVEATS.md: Section 10 — New Hotspot Subtype Checklist, Section 11 — DOM Element Order

### Feature: Click-to-Toggle Info Popups (2026-06-17)
- Wikipedia cards and plain info tooltips were always visible (`.wp-card-tooltip` had no `display: none`)
- Now hidden by default; click hotspot icon → popup appears; click again or × button → dismisses
- Pannellum hover tooltips suppressed via `onmouseenter/onmouseleave = null`
- "👁 Show all popups" toggle button in footer → reveals/hides all info popups at once
- `&open=0,2` URL hash parameter → auto-opens popups at specified hotspot indices on load
- Scene hotspots protected with `scene-hotspot` CSS tag + `tourData` type fallback

### Bug Fix: Missing enrichHotspots in Server Preview Path (2026-06-17)
- Server preview path (`#preview=<key>`) wasn't calling `enrichHotspots` before creating viewer
- Without it, scene hotspots lacked `scene-hotspot` CSS tag → `interceptInfoHotspots` broke navigation
- Fix: added `enrichHotspots(config.scenes)` call + defense-in-depth `tourData` type lookup in interception
- Lesson: every viewer creation path must call `enrichHotspots` — check all 3 paths when adding features

### Bug Fix: Commons Page URL Normalization (2026-06-17)
- Entering `https://commons.wikimedia.org/wiki/File:Video.webm` was stored as-is (HTML page, unplayable)
- Fix: audio/video `confirmAddHotspot` now runs `normalizeImageSource()` before File: resolution — extracts filename from Commons page URLs
- Viewer fallback resolvers also updated to handle Commons page URLs
- Lesson: always normalize media input through `normalizeImageSource()` — it handles File:, Commons page URLs, bare filenames, and passes direct URLs through unchanged

### Bug Fix: Audio File Resolution + Media Consistency (2026-06-17)
- Audio hotspots were storing `File:Sound.ogg` references (wiki format) while images stored canonical Commons URLs — inconsistent
- `confirmAddHotspot()` now resolves `File:` audio references to direct `https://upload.wikimedia.org/...` URLs before storage
- Viewer retains `resolveAudioFileUrl()` as a fallback for legacy data
- Added SC-2.3 to PRD: all media references must use canonical direct URLs

### Bug Fix: Viewport Preservation (2026-06-17)
- Adding/editing/deleting a hotspot was resetting the viewport to the scene's default orientation
- `loadSceneIntoViewport()` now accepts optional `viewOverride` parameter
- Both `confirmAddHotspot()` and `deleteHotspot()` capture current view before reload
- Added SC-2.0 to PRD: overarching principle that no editing operation shall disturb the viewport

### Documentation: CAVEATS.md (2026-06-17)
- New file: 9 gotchas from debugging (transform, paths, yaw, viewport, onclick, radio toggle, subtypes, image sources)
- Pannellum skill updated: "Never Use `transform` in Keyframe Animations" in caveats section

### Scene Icon Fix + Pannellum 2.5.7 Deep Dive (2026-06-18)
- Scene hotspot arrow icon completely invisible — Pannellum 2.5.7 renders scene sprites in `.pnlm-render-container` (not as children of `.pnlm-hotspot-base`), with `visibility:hidden` inline, never set visible in tour mode with custom `createTooltipFunc`
- Also found: setting `hs.cssClass` for scene/info hotspots prevented Pannellum from creating the default sprite child
- Fix: no `cssClass` for scene/info + 200ms delayed `visibility:visible` on `.pnlm-render-container .pnlm-scene`
- CAVEATS.md §1: "Hotspot Elements Live in Unexpected Containers" with 5-step debugging checklist

### Video Export/Import Fixes (2026-06-18)
- `videoUrl` silently dropped in both `exportTour()` and `importTourData()` — added to both
- Test file on Commons had stale video hotspot without `videoUrl` — re-added via studio

### Integrity Check System (2026-06-18)
- `validateHotspot(hs)` + `validateTour()` at add/edit, import, export, preview
- 5-step rule: every new field must touch storage, import, export, preview, validation
- CAVEATS.md §0: "Validate at Every Data Boundary"

### Scene Thumbnails Fix (2026-06-18)
- Studio and Viewer scene lists now show thumbnails (40×40px, CSS `background-size:cover`)
- Root cause: server's `/api/tour` returns `scene._thumb` as direct Commons URL → CORS blocked (`net::ERR_BLOCKED_BY_ORB`)
- Fix: `getSceneThumbnail()` ignores `_thumb` and uses `scene.panorama` (the `/images/<hash>.jpg` proxy path)
- No extra network requests — browser scales the cached panorama
- CAVEATS.md §15: "Scene Thumbnails: Use Proxied Paths, Not Direct Commons URLs"

### Default View Capture + Hotspot Repositioning (2026-06-18)
- **Feature 1**: "Set as Default View" button in scene properties panel
  - Captures current viewport yaw/pitch/hfov and stores as scene default
  - Uses `normalizeYaw()` for spec compliance
  - Works with scene switching — values persist
- **Feature 2**: "Set to Current View" button in hotspot edit/add modal
  - Repositions hotspots without delete/re-add workflow
  - Updates `state.capturedCoords` so `confirmAddHotspot()` uses new coords
  - Works in both add and edit modes
- Both features follow Panaedit pattern: navigate → capture → store
- ~1 hour total implementation (under 1.5-2.5hr estimate)

### Mobile Gyroscope Toggle (2026-06-18)
- Added 🧭 Gyro button to tour viewer footer
- Uses Pannellum API: `isOrientationSupported()`, `startOrientation()`, `stopOrientation()`
- Button only visible on mobile devices (`ontouchstart` or `navigator.maxTouchPoints > 0`)
- Handles iOS 13+ permission prompt via `DeviceOrientationEvent.requestPermission()`
- **Key finding**: Pannellum requires HTTPS for gyroscope — `http://localhost` won't work
  - Source: `DeviceOrientationEvent && "https:" == location.protocol`
  - Deployed Toolforge (HTTPS) will work correctly
- Desktop: button hidden (no touch)
- Test: Playwright confirmed API exists and methods are callable

### Previous (2026-06-15)
- Created `DEBUGGING.md` - 734-line visual debugging reference
- Created `scripts/dump-state.js` - Playwright state introspection
- Updated `README.md` project structure

---

## Next Steps (Phase 2.5: New Toolforge Tool Deployment)

**Decision (2026-06-17)**: Instead of modifying the existing `panoviewer.toolforge.org` install, we create a brand new Toolforge tool named **`wikipano`**. Toolforge supports Node.js natively via `webservice --backend=kubernetes node`, so the existing `tour_server.mjs` deploys directly — no PHP porting needed.

1. **Create new Toolforge tool** — `wikipano`
   - `ssh login.toolforge.org toolforge tools create wikipano`
   - `webservice --backend=kubernetes node start` serves the prototype directly
2. **Deploy prototype** - rsync `prototype/` to `/data/project/wikipano/`
   - `node tour_server.mjs` is the entry point
   - No code changes needed; zero external dependencies
3. **Create `{{PanoTour}}` template** on Commons - generates links to the new tool
4. **Handle multires tiling** - build a Node.js tiling pipeline (or adapt panoviewer's `generate.py`)
5. **OAuth save-to-wiki** - add authenticated save from Studio back to wiki pages

Not needed:
- ❌ Port to PHP
- ❌ Modify existing panoviewer tool

## Future (Phase 3)

- Evaluate Photo-Sphere-Viewer migration for GPS, maps, gallery plugins
- Tour discovery: category system, featured tours
- Multilingual support
- Custom icon themes (beyond size variants)

### Icon Consistency + Size Variants (2026-06-18)
- **Problem**: Studio used custom CSS icons (large circles with emoji), Viewer relied on Pannellum's small native sprites for scene/info — inconsistent appearance
- **Solution**: Both now use identical custom CSS for ALL hotspot types:
  - Scene: 50px red circle with ➤
  - Info: 44px blue circle with ⓘ
  - Audio: 44px green circle with 🎵
  - Video: 48px purple circle with ▶️
- **New feature**: `iconStyle` field on hotspots with values: `normal` (default), `small`, `large`, `huge`
- **Implementation**: `iconStyle` follows the 5-step rule (storage, import, export, preview, validation)
- **CSS pattern**: `.studio-hotspot.icon-large`, `.info-hotspot.icon-huge`, etc.
- **CAVEATS.md updated**: Section 1 now documents custom CSS approach instead of Pannellum sprite reliance
- Fixed Wikipedia card hotspots to use `wp-card-hotspot` class with matching styling
- Removed old caveat about `cssClass` preventing sprite creation — no longer relevant since we provide our own icons via `::after`
