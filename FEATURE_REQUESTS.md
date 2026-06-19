# Feature Request Analysis: Learnings from Panaedit + Marzipano

**Date**: 2026-06-18 (updated)
**Purpose**: Prioritized feature requests for Wikimedia Photosphere Tours, informed by Panaedit and Marzipano analysis

---

## 1. Draggable Hotspot Repositioning in 360° Viewport

**Status**: ✅ **Implemented (2026-06-18)** via "Set to Current View" button (Panaedit pattern)
**Priority**: High

### What We Built

Instead of true drag-in-viewport (which has edge case issues at the 180° seam), we implemented the Panaedit pattern:

1. User navigates to where they want the hotspot
2. Opens hotspot edit modal (or add modal)
3. Clicks "🔄 Set to Current View" button
4. Hotspot coordinates update to current viewport position

```js
// Capture current view for hotspot repositioning
function handleHsSetCurrentView() {
    const viewer = state.pannellumViewer;
    const yaw = normalizeYaw(viewer.getYaw());
    const pitch = viewer.getPitch();
    state.capturedCoords = { pitch, yaw };
    // Update modal display
    $('modal-hs-pitch').textContent = pitch.toFixed(2);
    $('modal-hs-yaw').textContent = yaw.toFixed(2);
}
```

**Effort**: ~30 minutes. Works in both add and edit modes.

### Why Not True Drag

Marzipano has `viewer.view().screenToCoordinates({ x, y })` — Pannellum does NOT. The math to approximate it fails at the equirectangular seam (yaw=±180°). The Panaedit pattern is simpler and handles all edge cases naturally.

---

## 2. Set Default View for a Scene

**Status**: ✅ **Implemented (2026-06-18)**
**Priority**: High

### What We Built

A "Set as Default View" button in the scene properties panel that captures the current Pannellum viewport and stores it as the scene's default yaw/pitch/hfov.

```js
// Capture current view as scene default
function handleSetDefaultView() {
    const viewer = state.pannellumViewer;
    const scene = state.scenes[state.activeSceneId];
    scene.yaw = normalizeYaw(viewer.getYaw());
    scene.pitch = viewer.getPitch();
    scene.hfov = viewer.getHfov();
    // Update input fields and show status
}
```

**Implementation**: 30 minutes. The scene's default yaw/pitch/hfov already worked in both Pannellum's viewer and our studio — we just needed to expose the UI.

---

## 3. Entry View URL Parameter per Scene

**Status**: Not implemented anywhere — novel feature request
**Priority**: Medium

### Concept

Currently, entering a scene always loads the scene's default yaw/pitch/hfov. It would be useful to allow a different entry orientation based on where the user came from.

**Use case examples**:
- Entering a museum from the front door → face the entrance
- Entering the same museum from a linked scene in a different room → face the doorway
- Tour guide can set different entry views for different navigation contexts

### Implementation

Add optional `targetYaw`, `targetPitch`, `targetHfov` to the scene link hotspot (Pannellum already supports this):

```js
// In hotspot definition
{
    type: "scene",
    sceneId: "museum",
    targetYaw: 45,      // Entry yaw when arriving via this link
    targetPitch: -5,    // Entry pitch
    targetHfov: 100,    // Entry hfov
}
```

For the studio, add these fields to the scene link hotspot modal with "Set to current view" buttons.

**For multi-scene entry control** (more advanced): Add a URL parameter:

```
studio.html?page=User:Example/Tour&entry=road:-45:0:110
```

This means: load tour, start at "road" scene, but enter with yaw=-45, pitch=0, hfov=110. Useful for deep-linking from external contexts (tour guide pages, museum website).

Pannellum natively supports `targetYaw`, `targetPitch`, `targetHfov` on hotspot definitions. We just need to expose the UI in the studio.

---

## 4. Additional Hotspot Types (from Panaedit)

**Status**: We have scene + info + audio + video; Panaedit has scene + info + article + photo + web link
**Priority**: Medium (dependent on Wikimedia use case)

### What Panaedit Has That We Don't

| Panaedit Type | Description | Our Equivalent | Notes |
|---|---|---|---|
| **Article** | Click opens a side panel with article content | Wikipedia rich cards | Panaedit dispatches CustomEvent; ours fetches REST API |
| **Photo** | Tooltip shows a photo from local files | ❌ | Not applicable to Wikimedia (images are always on Commons) |
| **Web link** | Opens external URL | ✅ (URL field on info hotspot) | We do this better — native Pannellum URL, no custom handlers |

### The Wikipedia Article Case is Interesting

Panaedit's article hotspot opens a `ArticleViewer` panel. Our Wikipedia rich cards are more powerful (lead image + extract), but they're limited to hover tooltips. A dedicated "Wikipedia article panel" — where clicking the hotspot opens a persistent side panel with the article's title, image, and extract — could be better for deep browsing.

**Recommendation**: Keep our Wikipedia card approach (hover tooltip) for quick looks. Add an optional "open as panel" mode where clicking an info hotspot with a Wikipedia URL opens a side panel (similar to Marzipano's Article Viewer). This could also be useful for general info hotspots.

---

## 5. Floor Plan Editor

**Status**: Panaedit has this (canvas-based); we don't
**Priority**: Medium (Phase 3)

### What Panaedit's FloorPlanEditor Does

The `FloorPlanEditor.tsx` is a canvas-based 2D map with:
- Background image (a floor plan / map image uploaded by the user)
- Draggable scene marker nodes (positioned as normalized 0-1 coordinates)
- Click-to-add new markers
- Labels on markers
- Drag to reposition
- Edit/delete markers

The `MiniMap.tsx` component renders:
- Scene markers as dots (active = orange, others = blue)
- Lines connecting scenes based on hotspot `sceneId` links
- North offset direction indicators (arrows) on markers
- Click-to-navigate (click a dot → switch to that scene)
- Expand/collapse toggle
- "Edit Map" button → opens the full FloorPlanEditor

### Key Architectural Insight: Normalized Coordinates

Panaedit stores marker positions as normalized 0-1 coordinates:

```ts
interface FloorPlanMarker {
    id: string;
    x: number;  // 0 to 1 (normalized canvas width)
    y: number;  // 0 to 1 (normalized canvas height)
    sceneKey: string;
    label: string;
}
```

This means markers scale with the floor plan image — no fixed pixel coordinates that break when the image resizes. This is the right approach.

### The DragHandler Hook

Panaedit's `useDragHandler` is a clean, reusable React hook:

```ts
const { isDragging, dragTarget, setDragTarget } = useDragHandler(canvasRef, {
    onDragStart: (position) => { /* find clicked marker, set drag target */ },
    onDrag: (position) => { /* update marker position in real-time */ },
    onDragEnd: (position) => { /* finalize position */ }
});
```

This is well-designed and could be adapted to vanilla JS.

### Could We Use Panaedit's Code Directly?

**Not directly** — it's tightly coupled to React + Redux:
- `useDragHandler` depends on React hooks
- `FloorPlanEditor` dispatches Redux actions
- `MiniMap` uses `useSelector` for state access

However, the **core logic is transferable**:
- Canvas rendering (markers, lines, arrows) → vanilla JS
- Normalized coordinate system → adopt directly
- Drag handling → adapt to vanilla event system
- Click-to-navigate → adapt to our state management

### Recommended Approach: Hybrid

For Phase 3, adopt PSV's `PlanPlugin` for the map overview (OpenStreetMap integration with GPS markers). Build a lightweight floor plan editor as a separate component:

1. **Floor plan image**: User uploads a Commons image as the background
2. **Scene markers**: Draggable dots on the canvas, linked to scene IDs
3. **Auto-connect lines**: Automatically draw lines between scenes based on hotspot links (Panaedit does this)
4. **North indicators**: Show scene orientation based on `northOffset` (Panaedit does this)
5. **Click-to-navigate**: Click a marker → switch to that scene
6. **Edit mode**: Drag markers to reposition; click to add new markers

This would be a **Phase 3 feature** — not urgent for Phase 2.5 deployment.

---

## 6. Autorotate (Start/Stop/Toggle)

**Status**: Pannellum has native support; we don't expose it in UI
**Priority**: Medium

### What Pannellum Provides

Pannellum has built-in autorotate:

```js
// Config-based (always on after load)
{
    autoRotate: -2,           // degrees per second (negative = clockwise)
    autoRotateInactivityDelay: 3000,  // resumes 3s after user stops interacting
    autoRotateStopDelay: 2000  // stops after 2s on load (lets user see scene first)
}

// Programmatic control
viewer.startAutoRotate(speed, pitch);
viewer.stopAutoRotate();
```

### User Behavior (from Marzipano)

Marzipano's autorotate behavior:
1. Scene loads → starts slow auto-rotation
2. User clicks/drags → rotation pauses immediately
3. User stops interacting for N seconds → rotation resumes
4. Toggle button in the UI → user can force on/off

### Implementation for Our Viewer

Add an autorotate toggle button in the viewer navbar:

```js
// In tour_viewer.html
const autoRotateBtn = document.createElement('button');
autoRotateBtn.innerHTML = '⟳';
autoRotateBtn.title = 'Toggle autorotate';
autoRotateBtn.onclick = () => {
    if (state.isAutoRotating) {
        viewer.stopAutoRotate();
    } else {
        viewer.startAutoRotate(-2, state.scenes[viewer.getScene()].pitch || 0);
    }
    state.isAutoRotating = !state.isAutoRotating;
};

// Also listen for user interaction to pause
viewer.on('mousedown', () => {
    if (state.isAutoRotating) {
        viewer.stopAutoRotate();
        // Optionally auto-resume after inactivity
        setTimeout(() => {
            if (state.isAutoRotating && !state.userIsInteracting) {
                viewer.startAutoRotate(-2, pitch);
            }
        }, 3000);
    }
});
```

This is a **viewer feature** (not studio), and it's a quick addition.

---

## 7. Fullscreen Toggle (Viewer Mode)

**Status**: Pannellum has native support; we don't expose it
**Priority**: Medium

### How Pannellum Does Fullscreen

Pannellum has `requestFullscreen()` support built into its navbar. However, this only fullscreens the panorama div — the sidebar (scene list, author info, links) remains visible.

### What We'd Want

A "theater mode" or "clean fullscreen" — hide all UI chrome (sidebar, navbar, info popups) and show only the 360° panorama. User can press Escape or click to exit.

### Implementation

```css
/* theater-mode.css */
body.theater-mode #sidebar { display: none; }
body.theater-mode .pnlm-controls-container { opacity: 0; transition: opacity 0.3s; }
body.theater-mode:hover .pnlm-controls-container { opacity: 1; }
body.theater-mode .info-popup { display: none; }
```

```js
// Toggle theater mode
const toggleTheaterMode = () => {
    document.body.classList.toggle('theater-mode');
    state.theaterMode = !state.theaterMode;
};

// Exit on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.theaterMode) {
        toggleTheaterMode();
    }
});
```

Pannellum already has a fullscreen button in its navbar. The "hide all UI" mode is a different feature — more like a slideshow mode. Could be a button in the viewer footer or the Pannellum navbar.

---

## 8. Meaningful Scene Thumbnails

**Status**: We have basic thumbnails; could be better
**Priority**: Medium

### What We Have Now

The studio calls `/api/resolve?file=...` and gets a 200px Commons thumbnail from `_thumb`. This shows in the scene list. It's functional but the thumbnails are:
- Low quality (200px)
- Center-cropped (may miss the interesting part of the panorama)
- Uniform — all scenes look similar in the list

### What Panaedit Does

Panaedit shows local image thumbnails from the file system — more control, but tied to local files.

### What Would Be Better

**Option A: Scene-specific crops**
Allow the user to specify which part of the panorama to use as the thumbnail. Store `thumbnailX`, `thumbnailY` as percentages. When rendering the thumbnail, crop from that position. Pannellum supports `panoramaBackground` with clipping — we could generate cropped thumbnails server-side.

**Option B: Auto-detect interesting region**
Use the hotspot positions to infer the "interesting" part of the panorama. For example, if a scene has a prominent hotspot at yaw=45, use that area for the thumbnail. This is more complex but could be a smart default.

**Option C: User-uploaded thumbnail**
Allow the user to upload a separate image (from Commons or their own files) as the scene thumbnail. This is the most flexible but requires more UI.

**Recommendation**: Implement Option A first — it's simple (two fields in the scene properties), gives the user control, and the thumbnail already renders correctly in the list.

---

## 9. Standalone Tour Linter / Integrity Checker

**Status**: Not implemented — part of the COMP_COMPARISON.md recommendation
**Priority**: High

### The Problem

Anyone can create a tour JSON file on Commons and publish it. Currently, there is no way for a contributor to check whether their tour is valid *before* viewing it — they have to load it in the viewer and hope it works. Worse, tours can be published with structural defects (one-way scene links, dangling `sceneId` references, orphaned scenes) that silently degrade the experience.

**What we need**: A standalone command-line utility that anyone can run against a tour JSON file to validate its correctness — like ESLint for JavaScript or `jsonlint` for JSON.

### What It Should Check

#### Tier 1: Structural Integrity (ERROR — tour will break)

| Check | Description | Severity |
|---|---|---|
| **Valid JSON/TOML** | File parses without syntax errors | ERROR |
| **`default.firstScene` exists** | The entry scene is actually defined in `scenes` | ERROR |
| **All `sceneId` references valid** | Every hotspot `sceneId` points to a defined scene | ERROR |
| **`panorama` field present** | Every scene has a `panorama` URL or File: reference | ERROR |
| **Yaw in range** | All hotspot yaw values in [-180, 180] | ERROR |
| **Pitch in range** | All hotspot pitch values in [-90, 90] | ERROR |

#### Tier 2: Navigation Integrity (WARNING — confusing but functional)

| Check | Description | Severity |
|---|---|---|
| **One-way scene links** | For every A→B scene link, verify B→A exists | WARNING |
| **Orphaned scenes** | Scenes with no incoming links (except `firstScene`) | WARNING |
| **Unreachable scenes** | Scenes not reachable via any path from `firstScene` | WARNING |
| **Self-links** | Hotspot `sceneId` pointing to its own scene | WARNING |

#### Tier 3: Content Quality (INFO — suggestions)

| Check | Description | Severity |
|---|---|---|
| **Missing `title`** | Scene has no title | INFO |
| **No hotspots** | Scene has zero hotspots (dead end if not firstScene) | INFO |
| **Missing `author`** | Tour has no author in `default` | INFO |
| **`File:` vs URL** | Panorama stored as `File:` reference instead of resolved URL | INFO |
| **Scene count** | Tour has only 1 scene (could just use Pano360 template) | INFO |

### Usage Design

```bash
# Basic lint
node scripts/lint-tour.mjs path/to/tour.json

# Lint with auto-fix (e.g., normalize yaw, add missing fields)
node scripts/lint-tour.mjs path/to/tour.json --fix

# Strict mode (treat warnings as errors)
node scripts/lint-tour.mjs path/to/tour.json --strict

# Lint a tour directly from Commons
node scripts/lint-tour.mjs --page User:Fuzheado/Panellum_Tour

# JSON output for CI/tooling
node scripts/lint-tour.mjs path/to/tour.json --format json

# Quiet mode — only print errors
node scripts/lint-tour.mjs path/to/tour.json --quiet
```

### Output Design

```
tour.json:7:12  error    sceneId "garden" not found in scenes  dangling-sceneId
tour.json:15:5  warning  One-way link: "Kitchen" → "Living Room" has no return link  one-way-link
tour.json:23:8  warning  Scene "Basement" has no incoming links from any other scene  orphaned-scene
tour.json:31:3  info     Scene "Garage" has no title  missing-title

✖ 4 problems (1 error, 2 warnings, 1 info)
  1 error must be fixed before this tour can be viewed correctly.
```

### Architecture

The linter is a **standalone Node.js script** — same zero-dependency constraint as `tour_server.mjs`:

```
scripts/
├── lint-tour.mjs          # Entry point: CLI + file loading
├── lint-rules/
│   ├── structure.mjs      # JSON/TOML parse, required fields
│   ├── scene-links.mjs    # sceneId validation, one-way detection
│   ├── ranges.mjs         # yaw/pitch bounds, numeric validation
│   └── quality.mjs        # Missing titles, suggestions
└── validate-pannellum.mjs # Existing JSON Schema validator (augment with cross-scene checks)
```

Each rule module exports a function `check(tour)` that returns an array of `{line, col, severity, message, rule}` objects. The linter aggregates and formats them.

### Relationship to Existing Validator

The existing `scripts/validate-pannellum.mjs` validates against the **Pannellum JSON Schema** — it checks that the JSON is structurally valid Pannellum config. The linter goes further:

| | `validate-pannellum.mjs` | `lint-tour.mjs` |
|---|---|---|
| Validates JSON structure | ✅ | ✅ (delegates) |
| Validates against Pannellum schema | ✅ | ❌ (separate concern) |
| Checks cross-scene navigation integrity | ❌ | ✅ |
| One-way street detection | ❌ | ✅ |
| Orphan/unreachable scene detection | ❌ | ✅ |
| Content quality suggestions | ❌ | ✅ |
| Auto-fix | Yaw normalization, URL encoding | Same + bidirectional link suggestions |
| Output formats | Text | Text, JSON, quiet |
| Fetches from Commons | ❌ | ✅ (`--page`) |

Both tools are useful for different audiences: `validate-pannellum.mjs` for developers checking against the Pannellum spec; `lint-tour.mjs` for tour authors checking their work before publishing.

### Integration Points

1. **Studio**: "Lint Tour" button in the toolbar — runs checks and shows results in a modal
2. **Pre-publish hook**: Before saving to wiki via OAuth, run the linter and warn if errors exist
3. **Commons template**: `{{PanoTour}}` could optionally display lint status on the wiki page
4. **CI-like workflow**: A bot could watch for tour page changes and lint them, leaving talk page notes

**Estimated effort**: ~4 hours (script + rule modules + CLI, building on existing parser infrastructure).

---

## 10. Formal Tour Format Specification

**Status**: Not started — needed before others can build tools against our format
**Priority**: High

### The Problem

Our tour JSON format is based on Pannellum's native configuration schema, but we've extended it with several non-standard fields that are specific to our platform:

- `iconStyle` (hotspot size variants)
- `hotspotSubtype` (audio/video distinction)
- `audioUrl` / `videoUrl` (Commons media references)
- `wikipediaUrl` (auto-enrichment trigger)
- `_original` (export path resolution)
- `_thumb` (server-side thumbnail resolution)
- `author` in `default` section

These extensions are **implemented but undocumented**. Anyone who wants to author a tour by hand (editing the JSON on a wiki page directly) has no reference for what fields are valid, what they do, or what values they accept.

### What The Spec Should Cover

#### Core Schema (Pannellum Baseline)
- The standard Pannellum tour config: `default`, `scenes`, `hotSpots`
- Document which Pannellum fields we support (not all Pannellum features are relevant to tours)
- Link to official Pannellum documentation for standard fields

#### Our Extensions

**Hotspot extensions**:

| Field | Type | Values | Description |
|---|---|---|---|
| `iconStyle` | string | `"normal"` (default), `"small"`, `"large"`, `"huge"` | Controls hotspot icon size (32px–80px) |
| `hotspotSubtype` | string | `"audio"`, `"video"` | Distinguishes media hotspot types under `type: "info"` |
| `audioUrl` | string | Commons direct URL | Audio file to play when hotspot is active |
| `videoUrl` | string | Commons direct URL or YouTube URL | Video to play in popup overlay |
| `wikipediaUrl` | string | `https://en.wikipedia.org/wiki/...` | Triggers Wikipedia card enrichment on hover |

**Scene extensions**:

| Field | Type | Description |
|---|---|---|
| `yaw` | number [-180, 180] | Default yaw for scene entry |
| `pitch` | number [-90, 90] | Default pitch for scene entry |
| `hfov` | number | Default horizontal field of view |

**Export/internal fields** (not for hand-authoring):

| Field | Type | Description |
|---|---|---|
| `_original` | string | Canonical Commons URL (set at export time) |
| `_thumb` | string | 200px thumbnail URL (set by server) |

#### Constraints & Validation Rules
- Yaw must be in [-180, 180]
- Pitch must be in [-90, 90]
- `firstScene` must reference an existing scene
- All `sceneId` values must reference existing scenes
- `panorama` is required on every scene
- `File:` references are accepted on input but should be resolved to URLs for storage (canonical media references per SC-2.3)

#### Format Versioning
- The spec should define a `formatVersion` field (e.g., `"formatVersion": "1.0"`) to allow future evolution
- The server and linter can use this to validate against the correct schema version
- This is critical for forward compatibility as we add features

### Format & Location

The spec should be a standalone Markdown document: `docs/TOUR_FORMAT_SPEC.md` (or `SPEC.md` at the project root).

It should follow the pattern of a standards document:
1. **Overview**: What this format is, who it's for, relationship to Pannellum
2. **Quick Start**: Minimal valid tour example
3. **Field Reference**: Every field, its type, valid values, default, required/optional
4. **Constraints**: Cross-field validation rules
5. **Extensions**: How our extensions differ from standard Pannellum config
6. **Versioning**: How `formatVersion` works, migration between versions
7. **Examples**: Complete annotated tours showing common patterns

**Estimated effort**: ~3 hours (primarily documentation — most fields are already implemented and understood).

---

## Summary: Prioritized Feature List

| # | Feature | Source | Priority | Effort | Phase | Status |
|---|---|---|---|---|---|---|
| 1 | Set current view as default yaw/pitch/hfov for scene | Panaedit | **High** | 30 min | 2.5 | ✅ Done |
| 2 | Draggable hotspot repositioning ("set to current view" button) | Panaedit | **High** | 1-2 hrs | 2.5 | ✅ Done |
| 3 | Standalone tour linter / integrity checker | COMP_COMPARISON | **High** | ~4 hrs | 2.5 | |
| 4 | Formal tour format specification | — | **High** | ~3 hrs | 2.5 | |
| 5 | Entry view override per hotspot (targetYaw/pitch/hfov) | Novel | Medium | 2-3 hrs | 2.5 | |
| 6 | Autorotate toggle button in viewer | Marzipano | Medium | 2-3 hrs | 2.5 | |
| 7 | Fullscreen/theater mode in viewer | Marzipano | Medium | 1-2 hrs | 2.5 | |
| 8 | Scene thumbnail crop control (specify region) | Improvement | Medium | 3-4 hrs | 3 | |
| 9 | Floor plan editor with draggable markers | Panaedit | Medium | 3-5 days | 3 | |
| 10 | Wikipedia article side panel (click-to-open) | Panaedit | Low | 2-3 hrs | 3 | |

### Phase 2.5 Additions (Small Effort, High Value)
- ~~Feature 1: Set default view button in scene properties~~ ✅
- ~~Feature 2: "Set to current view" in hotspot edit modal~~ ✅
- **Feature 3: Standalone tour linter (`scripts/lint-tour.mjs`)** — one-way street detection, orphaned scenes, structural validation, `--fix` support
- **Feature 4: Tour format specification (`docs/TOUR_FORMAT_SPEC.md`)** — document all Pannellum extensions, constraints, versioning
- Feature 5: targetYaw/targetPitch/targetHfov fields in scene link modal
- Feature 6: Autorotate toggle in viewer footer
- Feature 7: Theater mode button (hide all UI)

### Phase 3 Additions (Larger Effort)
- Feature 8: Scene thumbnail crop control
- Feature 9: Floor plan editor (or leverage PSV PlanPlugin)
- Feature 10: Wikipedia article side panel

---

## Implementation Dependencies

Some features depend on others:
- **Feature 2 (hotspot repositioning)** ~~depends on Feature 1~~ — both now share the same `viewer.getYaw()/getPitch()` pattern ✅
- **Feature 3 (linter)** builds on existing parser + `validate-pannellum.mjs` infrastructure — parser already exists, needs rule modules
- **Feature 4 (format spec)** is a pure documentation task — no code dependencies, but should be written before Feature 3 to define what "valid" means
- **Feature 5 (entry view override)** depends on Pannellum's native `targetYaw/targetPitch/targetHfov` support — already built in, just needs UI
- **Feature 7 (theater mode)** can be implemented standalone and works alongside any other feature
- **Feature 7 (floor plan)** is Phase 3 and independent of other features

---

## Phase 2.6: Scope & Compliance Features

**Date**: 2026-06-18
**Purpose**: Multi-wiki support + Wikimedia content restrictions

### Decisions
- Tour definitions can come from any Wikimedia project (multi-wiki support)
- Audio/video restricted to Wikimedia Commons only (runtime `ALLOW_ALL_SOURCES` flag for dev)
- Panoramas must be Commons `File:` references
- Info hotspots allow any URL but show external link warning
- Export validates against compliance rules

### FR-01: Multi-Wiki Tour Loading
**Priority**: High  
**Status**: ✅ Implemented (2026-06-18)  
**Description**: Support loading tour definitions from any Wikimedia project using `prefix:Page` format. Default to `commons:` for backward compatibility.

**Prefixes**: `commons:`, `en:`, `de:`, `fr:`, `es:`, `ja:`, `zh:`, `ru:`, `pt:`, `it:`, etc.

**Examples**:
- `commons:User:Fuzheado/Panellum_Tour` → Commons
- `en:Wikipedia:Featured_tours/Museum` → English Wikipedia
- `User:Fuzheado/Panellum_Tour` → Commons (no prefix = backward compatible)

**Changes needed**:
- Server: Generalize `fetchTourFromCommons()` → `fetchTourFromWiki(prefix, page)` with prefix→API mapping
- Studio/Viewer: Update UI to show which wiki the tour is loaded from
- Export: Include source wiki in JSON metadata

### FR-02: Audio/Video Source Restriction
**Priority**: High  
**Status**: ⬜ Not started  
**Description**: Restrict audio and video hotspots to Wikimedia Commons files only. No external URLs (YouTube, etc.) by default.

**Runtime flag**: `ALLOW_ALL_SOURCES=true` unlocks all sources (for testing/development).

**Whitelist**:
- ✅ `File:*.ogg` on Commons (audio)
- ✅ `File:*.mp3` on Commons (audio)
- ✅ `File:*.wav` on Commons (audio)
- ✅ `File:*.webm` on Commons (video)
- ✅ `File:*.ogv` on Commons (video)
- ❌ YouTube, Vimeo, or any other external URL (unless `ALLOW_ALL_SOURCES`)

**Changes needed**:
- Server: Add URL validation function `isAllowedMediaSource(url)`
- Studio: Disable YouTube/external audio/video options by default; show locked UI state
- Import: Reject tours with non-allowed media sources (or strip with warning)
- Export: Validate and warn on non-compliant media

### FR-03: Panorama Source Validation
**Priority**: Medium  
**Status**: ⬜ Not started  
**Description**: Enforce that all panorama `File:` references are from Wikimedia Commons. No external image URLs.

**Already implemented**: Current behavior loads from Commons API.

**Changes needed**:
- Add explicit validation in server and Studio
- Clear error message if non-Commons panorama detected
- Export validation to catch any violations

### FR-04: Info Hotspot External Link Warning
**Priority**: Low  
**Status**: ⬜ Not started  
**Description**: Info hotspots can link to any URL, but show a visual warning (⚠️ icon or tooltip) when linking to non-Wikimedia sites.

**Wikimedia domains** (no warning):
- `*.wikipedia.org`
- `*.wikimedia.org`
- `*.wikidata.org`
- `*.wikiquote.org`
- `*.wiktionary.org`
- `*.commons.wikimedia.org`

**Changes needed**:
- Studio: Show warning icon/badge on external info hotspots
- Viewer: Optional tooltip on hover ("External link")
- Export: No restriction, just metadata

### FR-05: Export Validation
**Priority**: Medium  
**Status**: ⬜ Not started  
**Description**: Validate exported JSON against compliance rules before download. Warn on non-compliant content.

**Rules**:
- Panoramas must be Commons `File:` references
- Audio/video must be Commons `File:` references (unless `ALLOW_ALL_SOURCES`)
- Info URLs: pass through, but flag external links

**Changes needed**:
- Add `validateExport(tour, options)` function
- Studio export UI: Show compliance checklist with warnings/errors
- Option to "Fix non-compliant" (strip or convert)

### Implementation Order

| Phase | Feature | Effort | Dependencies |
|-------|---------|--------|--------------|
| 1 | FR-01 Multi-Wiki Loading | Medium | None |
| 2 | FR-02 Audio/Video Restriction | Medium | FR-01 |
| 3 | FR-05 Export Validation | Medium | FR-02, FR-03 |
| 4 | FR-03 Panorama Validation | Low | FR-01 |
| 5 | FR-04 External Link Warning | Low | None |