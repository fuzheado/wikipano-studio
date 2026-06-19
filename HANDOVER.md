# Handover Document - Wikimedia Photosphere Tours

**Date**: 2026-06-19 (updated)
**Session**: FR-16 tests, FR-17 spec, URL shareability, video features spec

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
| `?page=` + `?scene=` URL params (Viewer + Studio) | ✅ |
| JSON validator (`--fix`) | ✅ |
| Integrity checks at all boundaries | ✅ |
| Scene thumbnails (Studio + Viewer) | ✅ |
| Set default view for scene | ✅ |
| **Set as starting scene** | ✅ |
| Hotspot repositioning (Set to Current View) | ✅ |
| Icon consistency (Studio = Viewer) | ✅ |
| Icon size variants (`iconStyle`) | ✅ |
| **Mobile gyroscope toggle** | ✅ |
| **Toolforge deployment** | ✅ **wikipano.toolforge.org** |
| **Multi-wiki tour loading** | ✅ FR-01 |
| **Immersive mode (FR-09)** | ✅ Default view, toggle (☰), keyboard shortcuts |
| **Immersive mode stickiness (FR-16)** | ✅ URL ?mode= param + tour JSON viewMode, no localStorage |
| **FR-16 tests** | ✅ 18 tests in `tests/immersive-mode.spec.js` |
| **URL shareability** | ✅ Input box load updates URL via pushState |
| **Cache management (FR-10)** | ✅ 500MB LRU, pre-fetching |
| **Cache-busting** | ✅ `?v=` param on image URLs |
| **Browser caching headers** | ✅ `Cache-Control: immutable` |
| **Mobile fullscreen** | ✅ ⛶ button, auto-gyro on first tap |
| **JSON canonical, TOML legacy** | ✅ Export always JSON, ingest both formats |
| **New Project button** | 🔲 FR-12 Not implemented |
| **Default naming** | 🔲 FR-13 Not implemented |
| **Tour metadata editor** | 🔲 FR-14 Not implemented |
| **Info overlays (FR-17)** | 📋 Spec in `specs/FR-17-info-overlays.md` |
| **Video title/caption (FR-18)** | 📋 Spec in FEATURE_REQUESTS.md |
| **Video timecodes (FR-19)** | 📋 Spec in FEATURE_REQUESTS.md |

### Architecture Quick Notes
- **Hotspot subtype pattern**: `hotspotSubtype` (audio/video) + custom URL fields → Pannellum `type: "info"`
- **Export vs Preview**: Export uses `_original` (canonical Commons URLs), Preview uses `/images/` (same-origin cached)
- **Pannellum 2.5.7**: All hotspots now use `cssClass` with custom CSS `::after` for icons
- **Class tagging**: `cssClass` set for ALL hotspot types (scene/info/audio/video/wp-card-hotspot)
- **5-step rule**: Every new field must touch storage, import, export, preview, validation.
- **Multi-wiki support**: Page parameter accepts `prefix:Page` format (e.g., `en:Wikipedia_tour`). Default: `commons:`. Supported: commons, en, de, fr, es, it, ja, zh, ru, pt, wikidata.
- **Starting scene**: `state.startingSceneId` tracks the tour's first scene. Set via ⭐ button in properties panel. Export/preview use this instead of active scene.
- **View mode**: `state.viewMode` ('immersive'|'detailed') controls initial viewer mode. Priority: URL ?mode= > tour JSON default.viewMode > default 'immersive'. No localStorage persistence.
- **Thumbnail fix**: `addScene()` is async and resolves `File:` references to `/images/` paths before rendering thumbnails.
- **JSON is canonical, TOML is legacy**: JSON is the primary format; TOML is supported for ingestion only (backward compatibility). Export always produces JSON. See FEATURE_REQUESTS.md §12.

### Pannellum 2.5.7 Gotchas
1. All hotspots use `cssClass` + custom CSS with `::after` for icons (no longer rely on Pannellum sprites)
2. `transform` in CSS keyframes overrides Pannellum's inline positioning — use `box-shadow`/`opacity` instead
3. Literal `<script>` in HTML comments breaks the page
4. `::after` pseudo-element overlays icon on top of any child elements (works with Wikipedia cards)
5. **Gyroscope requires HTTPS**: Pannellum's `isOrientationSupported()` returns false on `http:` — only works on `https:` (privacy requirement for DeviceOrientationEvent API)
6. **JSON is canonical, TOML is legacy**: JSON is the primary format; TOML is supported for ingestion only (backward compatibility). Export always produces JSON.

### Roadmap
- **Phase 2.5**: ✅ **Done** — deployed at **wikipano.toolforge.org**
  - Tour Viewer: https://wikipano.toolforge.org/?page=User:Fuzheado/Panellum_Tour
  - Studio: https://wikipano.toolforge.org/studio.html?page=User:Fuzheado/Panellum_Tour
  - `{{PanoTour}}` template: instructions in `DEPLOYMENT.md`
  - Pending: Multires tiling, OAuth save-to-wiki
- **Phase 2.7**: ✅ **Done** — Immersive mode, cache management, mobile UX
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

### Live
- https://wikipano.toolforge.org/?page=User:Fuzheado/Panellum_Tour
- https://wikipano.toolforge.org/?page=User:Fuzheado/Panellum_Tour&scene=Museum
- https://wikipano.toolforge.org/studio.html?page=User:Fuzheado/Panellum_Tour

### Multi-Wiki Examples
- `commons:User:Fuzheado/Panellum_Tour` — Commons (default)
- `en:Wikipedia:Featured_tours/Museum` — English Wikipedia
- `de:Wikipedia:Tour/Museum` — German Wikipedia

### Local
```bash
cd /Users/alih/Documents/ai/photospheres/prototype
node tour_server.mjs
# Open http://localhost:8765/studio.html
# Demo: http://localhost:8765/studio.html?page=User:Fuzheado/Panellum_Tour
# Multi-wiki: http://localhost:8765/studio.html?page=en:Wikipedia_tour
```

Do NOT run `rm -rf cache images` on startup - that wipes cached Commons images and breaks previews. The images cache is now managed with 1-hour TTL.

---

## What's Built

### Tour Viewer (`tour_viewer.html`)
- Pannellum-based 360° viewer with scene sidebar (thumbnails via CSS background-size:cover)
- Loads tours from wiki pages: `#User:Fuzheado/Panellum_Tour` (hash) or `?page=User:Fuzheado/Panellum_Tour` (query string)
- **Scene jump**: `?scene=Museum` — jumps to a specific scene after load (works with both hash and query string)
- Loads previews from localStorage: `#preview=local`
- Wikipedia rich info cards on hotspot hover (fetches lead image + extract from REST API)
- Handles TOML + JSON formats via server API
- **Mobile gyroscope toggle**: 🧭 button in footer (only visible on mobile + HTTPS)
- **Immersive mode (FR-09)**: Panorama fills viewport, no sidebar on load
  - Toggle button (☰) top-right to show/hide sidebar
  - Footer shows on hover in immersive mode
  - Keyboard shortcuts: Esc (toggle sidebar), F (fullscreen), G (gyro)
  - Persisted to localStorage
- **Fullscreen**: ⛶ button in footer, works on mobile (iOS 12+)
- **Mobile UX**: Auto-enable gyroscope on first tap, fullscreen button prominent
- **Cache-busting**: Image URLs include `?v=<mtime>` to prevent stale cache

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
- **Cache management**: 500MB LRU with `.access` tracking files
- **Pre-fetching**: Linked scene images pre-fetched in background on tour load
- **Browser caching**: `Cache-Control: public, max-age=604800, immutable` for images
- **Cache-busting**: Image URLs include `?v=<mtime>` to prevent stale cache
- **Error responses**: 404s sent with `Cache-Control: no-store`
- **No streaming**: Always use `readFile()` for Pannellum images (streaming breaks XHR)

### PHP Reference (`tour_config.php`)
- Standalone PHP equivalent for environments that can't run Node.js
- Not deployed - the Node.js server deploys directly to Toolforge as-is

---

## File Layout

```
photospheres/
├── README.md                # Project overview
├── DEPLOYMENT.md            # Step-by-step Toolforge + Commons template deployment guide
├── DEVELOPMENT.md           # Build status + roadmap
├── PRD.md                   # Product requirements
├── HANDOVER.md              # This file
├── CAVEATS.md               # Gotchas & debugging lessons
├── DEBUGGING.md             # Visual debugging guide (playwright-cli patterns for 360° viewport)
├── adr/
│   ├── README.md            # ADR index
│   ├── 001-pannellum-phase-1.md
│   ├── 002-wiki-page-storage.md
│   ├── 003-hash-cache-paths.md
│   ├── 004-dual-format.md
│   ├── 005-nodejs-prototype.md
│   ├── 006-toml-json-yaml.md
│   └── 007-hotspot-icons-postmortem.md
├── scripts/
│   ├── dump-state.js                # Playwright run-code script for full state introspection
│   ├── validate-pannellum.mjs       # Pannellum JSON Schema validator + auto-fix
│   └── create-panotour-templates.py # Pywikibot script for Commons template creation
├── tests/
│   ├── tour-viewer.spec.js          # Tour viewer URL params, scene nav, status, state (15 tests)
│   ├── studio-behaviors.spec.js     # Studio interaction behavior tests
│   └── mobile-gyro.spec.js          # Mobile gyroscope toggle tests
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
  - Deployed Toolforge (HTTPS) works correctly ✅
- Desktop: button hidden (no touch)
- Verified working on mobile device via wikipano.toolforge.org

### Toolforge Deployment (2026-06-18)
- Tool created: `toolforge tools create wikipano`
- Code deployed to `/data/project/wikipano/www/js/` via rsync
- Web service started: `webservice --backend=kubernetes node20 start`
- Live at: https://wikipano.toolforge.org
- Key finding: Toolforge Node.js expects app in `~/www/js/` with `package.json`
- Files owned by `alih` group `tools.wikipano` — rsync creates as `alih:wikidev`, corrected via `become`
- Gyroscope confirmed working on mobile over HTTPS 🎉

### Immersive Mode Deployment (2026-06-19)
- FR-09 implemented: Immersive full-screen default view
- Deployed to Toolforge: `/data/project/wikipano/www/js/tour_viewer.html`
- Features: immersive mode, toggle sidebar (☰ top-right), fullscreen button (⛶), keyboard shortcuts (Esc/F/G)
- Default: starts in immersive mode (panorama fills viewport)
- Footer shows on hover in immersive mode
- Fullscreen button always visible (mobile + desktop)
- Mobile UX: Auto-gyro on first tap, prominent fullscreen button
- Note: iOS Fullscreen API has limited support; immersive mode is fallback

### Cache Management & Pre-fetching (2026-06-19)
- **Cache size limit**: 500MB max with LRU eviction
- **Pre-fetching**: Linked scene images pre-fetched in background on tour load
- **LRU tracking**: `.access` files track last access time for eviction
- **Expired cleanup**: Runs every 5 minutes, removes files older than CACHE_TTL
- **Permission fix**: Fixed `images/` and `cache/` directory permissions for tools.wikipano
- **Browser caching**: `Cache-Control: public, max-age=604800, immutable` for images
- **Cache-busting**: `?v=<mtime>` query parameter on image URLs
- **Error responses**: 404s sent with `Cache-Control: no-store`

### Thumbnail Optimization (2026-06-18)
- **Problem**: Original images are 7.8MB each (6528x3264 pixels)
- **Solution**: Use 2000px thumbnails from Commons API (~150KB each)
- **Size reduction**: 98% smaller (7.8MB → 150KB)
- **Implementation**: `resolveCommonsFile()` now requests `iiurlwidth=2000`
- **Note**: Server pod needs restart to pick up new code (kubeconfig issues prevent manual restart)

### Streaming Bug Fix (2026-06-19)
- **Problem**: Added `createReadStream().pipe(res)` for large images → broke Pannellum
- **Symptom**: `net::ERR_FAILED 200 (OK)` — server returns 200 but browser can't read response
- **Root cause**: Pannellum loads images via XHR + FileReader, expects complete response; streaming doesn't work
- **Fix**: Removed streaming, use `readFile()` for all images
- **Lesson documented**: CAVEATS.md §16 "NEVER Stream Responses for Pannellum Image Loading"

### Cache-Busting (2026-06-19)
- **Problem**: Chrome cached old broken streaming responses; hard refresh didn't clear them
- **Solution**: Added `?v=<mtime>` query parameter to image URLs
- **Effect**: Browser treats each version as a new resource, forces fresh download
- **Also**: Added `Cache-Control: no-store` on 404 responses to prevent caching errors

### Chrome Cache Issue (2026-06-19)
- **Symptom**: Page works in Incognito but not regular Chrome; hard refresh doesn't help
- **Root cause**: Chrome internal state (connection pool, DNS cache) stuck from old broken responses
- **Fix**: Fully quit Chrome (`Cmd+Q`) and restart
- **Lesson documented**: CAVEATS.md §17 "Chrome May Require Full Restart After Server Changes"

### DEPLOYMENT.md Created (2026-06-18)
- Created `DEPLOYMENT.md` with complete copy-paste deployment guide
- Covers Commons template creation (5 templates), Toolforge deploy, verification steps
- All documentation updated to reflect live deployment status

### Bug Fix: Info Card Pulsing + Close Button (2026-06-18)
- **Problem 1**: Wikipedia info cards (wp-card-tooltip) pulsed on/off because parent `.wp-card-hotspot` had `animation: info-pulse` animating `opacity` — child card inherited the pulsing
- **Problem 2**: Clicking × close button opened Wikipedia in new tab instead of dismissing card
- **Root cause (pulsing)**: CSS `opacity` animation on parent affects all children. Fix: `.wp-card-hotspot:has(.wp-card-tooltip.visible) { animation: none !important; }`
- **Root cause (close button)**: Pannellum wraps hotspots in `<a target="_blank">` when they have a URL field. Close button click bubbled up to the `<a>` which navigated. Fix: capture-phase click listener on `<a>` parent blocks navigation when click originated inside `.wp-card-tooltip`; close button handler uses `preventDefault()` + `stopPropagation()`
- **Key finding**: `stopPropagation()` alone doesn't prevent `<a>` default navigation — only `preventDefault()` does
- **CAVEATS.md** sections 16-17 added documenting both patterns

### Streaming Bug Fix (2026-06-19)
- **Problem**: Added `createReadStream().pipe(res)` for large images → broke Pannellum
- **Symptom**: `net::ERR_FAILED 200 (OK)` — server returns 200 but browser can't read response
- **Root cause**: Pannellum loads images via XHR + FileReader, expects complete response; streaming doesn't work
- **Fix**: Removed streaming, use `readFile()` for all images
- **Lesson documented**: CAVEATS.md §16 "NEVER Stream Responses for Pannellum Image Loading"

### Cache-Busting (2026-06-19)
- **Problem**: Chrome cached old broken streaming responses; hard refresh didn't clear them
- **Solution**: Added `?v=<mtime>` query parameter to image URLs
- **Effect**: Browser treats each version as a new resource, forces fresh download
- **Also**: Added `Cache-Control: no-store` on 404 responses to prevent caching errors

### Chrome Cache Issue (2026-06-19)
- **Symptom**: Page works in Incognito but not regular Chrome; hard refresh doesn't help
- **Root cause**: Chrome internal state (connection pool, DNS cache) stuck from old broken responses
- **Fix**: Fully quit Chrome (`Cmd+Q`) and restart
- **Lesson documented**: CAVEATS.md §17 "Chrome May Require Full Restart After Server Changes"

### Previous (2026-06-15)
- Created `DEBUGGING.md` - 734-line visual debugging reference
- Created `scripts/dump-state.js` - Playwright state introspection
- Updated `README.md` project structure

---

## Phase 2.5: Deploy ✅ (2026-06-18)

**Decision**: Create a new Toolforge tool named **`wikipano`** (not modify existing `panoviewer`). Toolforge's Node.js backend runs `tour_server.mjs` directly — no PHP porting.

**Done**:
- [x] Tool created: `toolforge tools create wikipano`
- [x] Code deployed: rsync `prototype/` → `/data/project/wikipano/www/js/`
- [x] Web service started: `webservice --backend=kubernetes node20 start`
- [x] Mobile gyroscope enabled (HTTPS)
- [x] Live URLs: https://wikipano.toolforge.org/tour_viewer.html
- [x] `DEPLOYMENT.md` created with Commons template creation guide

**Pending**:
- [ ] Create `{{PanoTour}}` template on Commons (instructions in `DEPLOYMENT.md`)
- [ ] Handle multires tiling (or adapt panoviewer's `generate.py`)
- [ ] OAuth save-to-wiki from Studio

**Not needed**:
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
