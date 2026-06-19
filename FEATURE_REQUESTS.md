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

| Phase | Feature | Effort | Dependencies | Status |
|-------|---------|--------|--------------|--------|
| 1 | FR-01 Multi-Wiki Loading | Medium | None | ✅ Done |
| 2 | FR-02 Audio/Video Restriction | Medium | FR-01 | ⬜ Not started |
| 3 | FR-05 Export Validation | Medium | FR-02, FR-03 | ⬜ Not started |
| 4 | FR-03 Panorama Validation | Low | FR-01 | ⬜ Not started |
| 5 | FR-04 External Link Warning | Low | None | ⬜ Not started |

---

## Phase 2.7: UI Polish & Usability Fixes

**Date**: 2026-06-18
**Purpose**: Small UI improvements and bug fixes

### FR-06: Text Wrapping in Audio/Video Hotspot Boxes

**Priority**: Low
**Status**: ⬜ Not started
**Description**: In the hotspots list in Studio, audio (🎵) and video (🎬) hotspot boxes have text that overflows/pokes out the edge of the container. The text should wrap properly within the box boundaries.

**Current behavior**: Text in audio/video hotspot list items extends beyond the container edge.

**Expected behavior**: Text should wrap and stay contained within the hotspot box boundaries.

**Implementation**: Add CSS `word-wrap: break-word` or `overflow-wrap: break-word` to the hotspot list item container, or adjust the container width/overflow properties.

**Changes needed**:
- Studio CSS: Add word-wrap properties to hotspot list items
- May need to adjust container width or add `overflow: hidden`
- Test with long hotspot text labels

### Phase 2.7 Additions (Pending)
- Feature 6: FR-06 Text wrapping in audio/video hotspot boxes

---

## Phase 2.8: Wiki Integration & OAuth

**Date**: 2026-06-18
**Purpose**: Enable direct save/load to/from Wikimedia wiki pages with authentication

### FR-07: Save Tour Back to Wiki (OAuth Integration)

**Priority**: High
**Status**: ⬜ Not started
**Description**: Allow users to save their tour directly back to the Wikimedia wiki page they loaded it from (or to a new page). This requires OAuth authentication to write to Wikimedia projects.

**Current workflow**:
1. Load tour from wiki page (`?page=User:Fuzheado/Panellum_Tour`)
2. Edit in Studio
3. Export as JSON (download or copy)
4. Manually paste back to wiki page

**Desired workflow**:
1. Load tour from wiki page
2. Edit in Studio
3. Click **Save** button → writes directly back to the same wiki page
4. Optionally **Save As** → writes to a different page name

### User Stories

**US-01: Save to original page**
- User loads tour from `User:Example/MyTour`
- Makes edits in Studio
- Clicks **Save** button
- Tour JSON is written back to `User:Example/MyTour` on Commons
- Confirmation message shown

**US-02: Save to new page**
- User loads tour from `User:Example/MyTour`
- Makes edits
- Clicks **Save As** or **Export to Wiki**
- Enters new page name: `User:Example/MyTour_v2`
- Tour JSON is written to new page
- User can optionally delete old page

**US-03: Create new tour from scratch**
- User starts with empty Studio
- Creates scenes and hotspots
- Clicks **Save to Wiki**
- Enters page name: `User:Example/NewTour`
- Tour JSON is written to new page
- URL updates to reflect new page

### Technical Requirements

#### OAuth 2.0 Flow

**Wikimedia OAuth 2.0 (AuthManager)**:
- Register tool at `https://meta.wikimedia.org/wiki/Special:OAuthConsumerRegistration`
- Use `grant_type=authorization_code` flow
- Scopes needed: `edit`, `createpage` (for new pages)
- Store OAuth tokens securely (session-based or encrypted local storage)

**Alternative: Bot Passwords**
- Simpler for single-user tool
- User creates bot password at `Special:BotPasswords`
- Use HTTP Basic Auth with bot username + password
- Less secure, but no OAuth app registration needed

**Recommended**: Start with Bot Passwords for rapid prototyping, migrate to OAuth 2.0 for production.

#### Server Endpoints (New)

```
POST /api/wiki/save
  Body: {
    wiki: "commons",           # wiki prefix
    page: "User:Example/Tour",  # page title
    content: "{...json...}",   # tour JSON
    summary: "Updated via PanoTour Studio",  # edit summary
    token: "..."               # CSRF or OAuth token
  }
  Response: { success: true, newrevid: 123456, newtimestamp: "..." }

POST /api/wiki/auth
  Body: { username: "...", password: "..." }  # Bot password auth
  Response: { token: "...", expires: "..." }

GET /api/wiki/check-auth
  Response: { authenticated: true, user: "...", wiki: "commons" }
```

#### Action API Integration

Use Wikimedia Action API for edits:

```javascript
// Fetch CSRF token
const tokenRes = await fetch(
  `https://commons.wikimedia.org/w/api.php?action=query&meta=tokens&type=csrf&format=json`,
  { credentials: 'include' }
);
const { query: { tokens: { csrftoken } } } = await tokenRes.json();

// Save page
const saveRes = await fetch(
  `https://commons.wikimedia.org/w/api.php`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      action: 'edit',
      title: 'User:Example/Tour',
      text: JSON.stringify(tourJson, null, 2),
      summary: 'Updated via PanoTour Studio',
      token: csrftoken,
      format: 'json'
    }),
    credentials: 'include'
  }
);
```

### UI Changes

#### New Buttons in Studio Header

```
┌─────────────────────────────────────────────────────────────┐
│ 🎬 PanoTour Studio                                         │
│                                                             │
│ [📁 Import] [💾 Save] [📝 Save As] [⬇️ Export] [👁️ Preview] │
└─────────────────────────────────────────────────────────────┘
```

**Save button states**:
- **Logged out**: Button shows "Login to Save" → opens auth modal
- **Logged in, loaded from wiki**: Button shows "Save" → writes to original page
- **Logged in, new/unsaved**: Button shows "Save to Wiki" → opens page name dialog

#### Auth Modal

```
┌─────────────────────────────────────┐n│ 🔐 Login to Wikimedia               │
│                                     │
│ Username: [________________________]│
│ Bot Password: [____________________]│
│                                     │
│ 🔗 How to create a bot password    │
│                                     │
│        [Cancel]  [Login]            │
└─────────────────────────────────────┘
```

#### Save As Dialog

```
┌─────────────────────────────────────┐
│ 💾 Save Tour to Wiki                │
│                                     │
│ Wiki: [Commons ▼]                   │
│ Page: [User:Example/MyTour________] │
│                                     │
│ Summary: [Updated via Studio_______]│
│                                     │
│ ☐ Create redirect from old page     │
│                                     │
│        [Cancel]  [Save]             │
└─────────────────────────────────────┘
```

### State Changes

Add to `state` object:

```javascript
state.auth = {
    authenticated: false,
    username: null,
    wiki: null,           // 'commons', 'en', etc.
    token: null,          // OAuth or bot password token
    tokenExpiry: null
};

state.wikiSource = {
    wiki: null,           // Original wiki prefix
    page: null,           // Original page title
    revision: null,       // Original revision ID (for conflict detection)
    timestamp: null       // Original edit timestamp
};
```

### Conflict Detection

Before saving, check if page was modified since load:

```javascript
async function checkForConflicts() {
    const res = await fetch(
        `/api/wiki/info?page=${state.wikiSource.page}&wiki=${state.wikiSource.wiki}`
    );
    const { revision, timestamp } = await res.json();
    
    if (revision !== state.wikiSource.revision) {
        // Page was modified since we loaded it
        showConflictModal({
            currentRev: revision,
            ourRev: state.wikiSource.revision,
            currentTimestamp: timestamp
        });
        return false;
    }
    return true;
}
```

**Conflict modal options**:
- **Overwrite**: Save anyway (risky)
- **Reload**: Discard changes, reload from wiki
- **Merge**: Open diff view (Phase 3 feature)

### Security Considerations

1. **Token storage**: Never store bot passwords in localStorage. Use session-only cookies or memory.
2. **HTTPS only**: All API calls must be over HTTPS
3. **CORS**: Wikimedia API requires proper OAuth signing or bot password auth
4. **Rate limiting**: Respect API limits (5 edits/second for bots)
5. **Edit wars**: Show warning if page has been edited >3 times in last hour

### Implementation Effort

**Phase 1 (MVP)**: ~4-6 hours
- Bot password authentication
- Save to original page
- Conflict detection (read-only)
- Basic error handling

**Phase 2 (Full)**: ~8-12 hours
- OAuth 2.0 flow
- Save As dialog
- Create new pages
- Edit history diff view
- Batch save (multiple tours)

### Files to Modify

- `prototype/studio.html` — Add Save/Save As buttons, auth modal
- `prototype/studio.js` — Add save logic, auth state management
- `prototype/tour_server.mjs` — Add `/api/wiki/*` endpoints
- `FEATURE_REQUESTS.md` — Document feature
- `CAVEATS.md` — Add OAuth gotchas

---

### Phase 2.8 Additions (Pending)
- Feature 7: FR-07 Save Tour Back to Wiki (OAuth Integration)

---

## Phase 2.9: Scene Naming & URL-Friendly Slugs

**Date**: 2026-06-18
**Purpose**: Replace random scene IDs with meaningful, customizable, URL-friendly slugs

### FR-08: Custom Scene Names/Slugs

**Priority**: High
**Status**: ⬜ Not started
**Description**: Currently, new scenes get random IDs like `scene_1234567890`, which creates ugly, unfriendly URLs like `?scene=scene_1234567890`. Users should be able to set meaningful scene names that become URL-friendly slugs.

**Current behavior**:
- Add scene → generates `scene_` + random 10-digit number
- URL: `?scene=scene_3847291056`
- Not memorable, not shareable, not human-readable

**Desired behavior**:
- Add scene → user can set name → auto-generates URL-friendly slug
- URL: `?scene=museum-lobby` or `?scene=tallinn-old-town`
- Easy to read, share, and remember

### User Stories

**US-01: Auto-generate slug from title**
- User adds scene with title "Museum Lobby"
- System auto-generates slug: `museum-lobby`
- URL becomes `?scene=museum-lobby`

**US-02: Custom slug override**
- User adds scene, enters title "Museum Lobby"
- User overrides slug to `lobby`
- URL becomes `?scene=lobby`

**US-03: Rename scene slug**
- User has scene with slug `scene_1234567890`
- User renames to `museum-main`
- Old URL `?scene=scene_1234567890` gets 301 redirect (if possible) or shows warning

**US-04: Import preserves existing slugs**
- User imports tour with existing scene IDs
- Slugs preserved as-is (backward compatible)
- User can optionally rename after import

### Slug Generation Rules

Convert title to URL-friendly slug:

```javascript
function generateSlug(title) {
    return title
        .toLowerCase()
        .trim()
        // Replace spaces with hyphens
        .replace(/\s+/g, '-')
        // Remove non-alphanumeric characters (keep hyphens)
        .replace(/[^a-z0-9-]/g, '')
        // Collapse multiple hyphens
        .replace(/-{2,}/g, '-')
        // Remove leading/trailing hyphens
        .replace(/^-+|-+$/g, '')
        // Truncate to 50 chars
        .substring(0, 50);
}

// Examples:
// "Museum Lobby" → "museum-lobby"
// "Tallinn Old Town (Estonia)" → "tallinn-old-town-estonia"
// "入口 / Entrance" → "entrance"
// "Scene 1" → "scene-1"
```

**Fallback**: If title is empty or generates empty slug, use `scene-{timestamp}` (still random, but at least predictable).

### Uniqueness Enforcement

```javascript
function ensureUniqueSlug(baseSlug, existingSlugs) {
    let slug = baseSlug;
    let counter = 2;
    while (existingSlugs.includes(slug)) {
        slug = `${baseSlug}-${counter}`;
        counter++;
    }
    return slug;
}

// "museum-lobby" → "museum-lobby" (if unique)
// "museum-lobby" → "museum-lobby-2" (if taken)
// "museum-lobby" → "museum-lobby-3" (if -2 also taken)
```

### UI Changes

#### Scene Properties Panel

Current:
```
┌─────────────────────────────────┐
│ Scene Properties                │
│                                 │
│ Title: [Museum Lobby__________] │
│                                 │
│ [Set as Default View]           │
└─────────────────────────────────┘
```

New:
```
┌─────────────────────────────────────────────┐
│ Scene Properties                            │
│                                             │
│ Title: [Museum Lobby____________________]   │
│ Slug:  [museum-lobby____________________]   │
│        ^^^^^^^^^^^ auto-generated           │
│        (editable)                           │
│                                             │
│ ℹ️  Used in URL: ?scene=museum-lobby        │
│                                             │
│ [Set as Default View]                       │
└─────────────────────────────────────────────┘
```

**Slug input behavior**:
- Auto-populates from title as user types
- User can override with custom slug
- Real-time validation: shows ✓ valid or ✗ taken/conflict
- Debounced uniqueness check against other scenes

#### Add Scene Modal

```
┌─────────────────────────────────────────────┐n│ 📷 Add Scene                                │
│                                             │
│ Panorama: [File:My_Photo.jpg_______________] │
│                                             │
│ Title: [________________________]           │
│ Slug:  [auto-from-title____________]        │
│                                             │
│ [Cancel]           [Add Scene]              │
└─────────────────────────────────────────────┘
```

### State Changes

Current scene object:
```javascript
state.scenes = {
    "scene_1234567890": {
        title: "Museum Lobby",
        panorama: "File:Photo.jpg",
        hotSpots: [...]
    }
};
```

No structural change needed — scene IDs are already the slug. The change is in **how IDs are generated**:
- Before: `scene_` + random
- After: slugified title (or custom override)

### Migration & Backward Compatibility

**Existing tours with random IDs**:
- Keep old IDs as-is (don't break existing tours)
- User can manually rename in Studio
- Show warning: "This scene has a random ID. Consider renaming for better URLs."

**URL redirects** (nice-to-have, Phase 3):
- If scene is renamed, old `?scene=old-slug` could redirect to `?scene=new-slug`
- Requires storing a `previousSlugs` array
- Not critical — users can update shared links manually

### Validation Rules

```javascript
const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function validateSlug(slug) {
    if (slug.length === 0) return { valid: false, error: 'Slug cannot be empty' };
    if (slug.length > 50) return { valid: false, error: 'Slug too long (max 50 chars)' };
    if (!SLUG_REGEX.test(slug)) return { valid: false, error: 'Use lowercase letters, numbers, and hyphens only' };
    if (slug.startsWith('-') || slug.endsWith('-')) return { valid: false, error: 'Slug cannot start or end with hyphen' };
    return { valid: true };
}
```

### Implementation Effort

**MVP**: ~2-3 hours
- Slug generation from title
- Custom slug input in scene properties
- Uniqueness validation
- Update `addScene()` to use slugs

**Full**: ~4-6 hours
- Rename existing scenes
- URL redirect mapping
- Import slug preservation
- Batch rename tool

### Files to Modify

- `prototype/studio.js` — Add `generateSlug()`, `validateSlug()`, update `addScene()`
- `prototype/studio.html` — Add slug input to scene properties panel
- `prototype/tour_viewer.html` — Handle slug-based scene loading
- `CAVEATS.md` — Document slug generation rules

### URL Impact

**Before**:
```
https://wikipano.toolforge.org/tour_viewer.html#User:Fuzheado/Tour?scene=scene_3847291056
```

**After**:
```
https://wikipano.toolforge.org/tour_viewer.html#User:Fuzheado/Tour?scene=museum-lobby
```

Much cleaner, more shareable, more memorable!

---

### Phase 2.9 Additions (Pending)
- Feature 8: FR-08 Custom Scene Names/Slugs

---

## Phase 2.10: Immersive Viewing Experience

**Date**: 2026-06-18
**Purpose**: Full-screen immersive default view with clean URL scheme

### FR-09: Immersive Full-Screen Default View

**Priority**: High
**Status**: ✅ **Implemented (2026-06-18)**
**Description**: Tour Viewer should start in full-screen immersive mode by default, with a clean URL scheme. The 360° panorama fills the entire viewport with minimal UI. A toggle button reveals detailed controls (scene list, info panels, etc.).

### Current Behavior

- Tour Viewer loads with sidebar, header, footer always visible
- No full-screen mode on desktop
- Mobile has gyroscope button but no full-screen button
- URL uses hash: `tour_viewer.html#User:Fuzheado/Panellum_Tour`

### Desired Behavior

**URL Scheme**:
```
https://wikipano.toolforge.org/?page=User:Fuzheado/Panellum_Tour
https://wikipano.toolforge.org/?page=User:Fuzheado/Panellum_Tour&scene=museum-lobby
```

**Desktop**:
- Starts full-screen immersive (panorama fills viewport)
- Minimal UI: just a small toggle button
- Click toggle → reveals sidebar + controls
- Click toggle again → returns to immersive

**Mobile**:
- Starts full-screen immersive (native fullscreen if possible)
- Minimal UI: gyroscope button + toggle button
- Swipe to look around, gyroscope for orientation
- Tap toggle → reveals scene list as overlay

### User Stories

**US-01: First-time visitor**
- User clicks link: `wikipano.toolforge.org/?page=User:Example/Tour`
- Page loads in full-screen immersive mode
- User sees 360° panorama filling entire screen
- User can drag/swipe to look around
- User taps small button in corner → scene list appears
- User taps scene → transitions to new scene
- User taps button again → returns to immersive

**US-02: Deep link to specific scene**
- User clicks: `?page=User:Example/Tour&scene=museum`
- Loads tour, starts at "museum" scene
- Same immersive experience

**US-03: Desktop experience**
- User visits on desktop
- Panorama fills browser window (no sidebar by default)
- Click toggle → sidebar slides in from left
- ESC key → returns to immersive

### UI Design

#### Immersive Mode (Default)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    360° PANORAMA                            │
│                    (fills entire viewport)                  │
│                                                             │
│                                                             │
│                                                             │
│  ┌─────┐                                                   │
│  │ ≡ │  ← toggle button (bottom-left)                     │
│  └─────┘                                                   │
│                                                             │
│                      🧭 (mobile only)                       │
└─────────────────────────────────────────────────────────────┘
```

#### Detailed Mode (Toggle Open)

```
┌─────────────────────────────────────────────────────────────┐
│ ┌──────────┐                                               │
│ │ Scenes   │                                               │
│ │ ─────── │    360° PANORAMA                               │
│ │ [img] Museum│                                            │
│ │ [img] Street│   (still fills viewport,                   │
│ │ [img] Park │    sidebar is overlay)                      │
│ │          │                                               │
│ │ ─────── │                                               │
│ │ Info     │                                               │
│ │ Author   │                                               │
│ └──────────┘                                               │
│  ┌─────┐                                                   │
│  │ ≡ │  ← toggle button (now closes sidebar)             │
│  └─────┘                                                   │
└─────────────────────────────────────────────────────────────┘
```

#### Mobile Overlay

```
┌─────────────────────────────┐
│  ┌───────────────────────┐  │
│  │ Scenes                │  │
│  │ ──────────────────── │  │
│  │ [img] Museum          │  │
│  │ [img] Street          │  │
│  │ [img] Park            │  │
│  │                       │  │
│  │ [×] Close             │  │
│  └───────────────────────┘  │
│                             │
│    360° PANORAMA            │
│    (behind overlay)         │
│                             │
│              🧭  ≡          │
└─────────────────────────────┘
```

### CSS Implementation

```css
/* Immersive mode - default */
.tour-viewer.immersive .sidebar {
    display: none;
}

.tour-viewer.immersive .header {
    display: none;
}

.tour-viewer.immersive .footer {
    opacity: 0;
    transition: opacity 0.3s;
}

.tour-viewer.immersive .footer:hover {
    opacity: 1;
}

/* Toggle button always visible */
.toggle-btn {
    position: fixed;
    bottom: 20px;
    left: 20px;
    z-index: 1000;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    font-size: 20px;
    border: none;
    cursor: pointer;
}

/* Detailed mode - sidebar as overlay */
.tour-viewer:not(.immersive) .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    width: 300px;
    background: rgba(0, 0, 0, 0.9);
    z-index: 999;
    transition: transform 0.3s;
}

/* Mobile overlay */
@media (max-width: 768px) {
    .tour-viewer:not(.immersive) .sidebar {
        width: 100%;
        height: 60%;
        bottom: 0;
        top: auto;
        border-radius: 20px 20px 0 0;
    }
}
```

### JavaScript Logic

```javascript
// Toggle immersive mode
function toggleImmersive() {
    const viewer = document.querySelector('.tour-viewer');
    viewer.classList.toggle('immersive');
    
    // Update button icon
    const btn = document.querySelector('.toggle-btn');
    btn.textContent = viewer.classList.contains('immersive') ? '≡' : '×';
    
    // Store preference
    localStorage.setItem('immersive', viewer.classList.contains('immersive'));
}

// Enter fullscreen on mobile
function requestFullscreen() {
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
    } else if (document.documentElement.webkitRequestFullscreen) {
        document.documentElement.webkitRequestFullscreen();
    }
}

// Auto-start immersive
function initImmersive() {
    const saved = localStorage.getItem('immersive');
    if (saved !== 'false') {  // Default to immersive
        document.querySelector('.tour-viewer').classList.add('immersive');
    }
    
    // Request fullscreen on mobile
    if ('ontouchstart' in window) {
        requestFullscreen();
    }
}
```

### URL Routing Changes

**Current**:
```
tour_viewer.html#User:Fuzheado/Panellum_Tour
tour_viewer.html?page=User:Fuzheado/Panellum_Tour&scene=museum
```

**New (additive, backward compatible)**:
```
/?page=User:Fuzheado/Panellum_Tour
/?page=User:Fuzheado/Panellum_Tour&scene=museum-lobby
```

**Implementation**: Add root `index.html` that redirects or serves `tour_viewer.html` with query params.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Esc` | Toggle immersive mode |
| `F` | Toggle fullscreen |
| `G` | Toggle gyroscope (mobile) |
| `1-9` | Jump to scene 1-9 |

### Implementation Effort

**MVP**: ~3-4 hours
- CSS immersive mode
- Toggle button
- Mobile fullscreen request
- URL param routing

**Full**: ~6-8 hours
- Keyboard shortcuts
- Smooth transitions
- localStorage preferences
- Scene list overlay for mobile

### Files to Modify

- `prototype/tour_viewer.html` — Add toggle button, immersive CSS, fullscreen API
- `prototype/tour_viewer.html` — Update URL routing for clean `?page=` scheme
- `prototype/tour_server.mjs` — Serve root `index.html` if needed
- `FEATURE_REQUESTS.md` — Document feature

### Mobile Full-Screen Button Issue

**Bug**: Mobile view only shows gyroscope button, no full-screen button.

**Root Cause** (confirmed 2026-06-18):
- **No fullscreen button exists** in `tour_viewer.html` at all - no HTML element for it
- The gyroscope button is the ONLY button with conditional mobile visibility
- CSS: `#gyro-btn { display: none; }` (hidden by default)
- JavaScript shows it only if:
  - `'ontouchstart' in window || navigator.maxTouchPoints > 0` (mobile device)
  - `viewer.isOrientationSupported()` returns true

**Footer HTML** (lines 552-562):
```html
<footer>
    <span>Powered by Pannellum</span>
    <div style="display:flex;gap:8px;align-items:center;">
        <button id="gyro-btn" title="Toggle device gyroscope control">
            <span class="icon">🧭</span>
            <span class="label">Gyro</span>
        </button>
        <button id="toggleAllInfoBtn">👁 Show all popups</button>
    </div>
    <span>Tour JSON stored on Wikimedia Commons</span>
</footer>
```

**Fix needed**:
1. Add fullscreen button to footer HTML
2. Add CSS for fullscreen button visibility (show on both mobile and desktop)
3. Add JavaScript for Fullscreen API (`requestFullscreen()`)
4. Consider making it always visible (not conditionally hidden like gyro)

---

### Phase 2.10 Additions (Done)
- Feature 9: FR-09 Immersive Full-Screen Default View ✅

### Mobile UX Improvements (2026-06-19)
- **Auto-gyro on first tap**: iOS requires user gesture to enable gyroscope
- **Fullscreen button prominent**: Larger, colored button on mobile
- **Prompt**: "👆 Tap to enable gyroscope & fullscreen" on first load
- **Note**: iOS Fullscreen API has limited support; immersive mode is fallback

---

## Phase 2.11: Cache Management & Performance

**Date**: 2026-06-18
**Purpose**: Smart caching and pre-fetching for faster scene transitions

### FR-10: Image Cache Management

**Priority**: High
**Status**: ✅ **Implemented (2026-06-18)**

**Implemented features**:
- **Cache size limit**: 500MB max (configurable via `MAX_CACHE_SIZE_MB`)
- **LRU eviction**: When cache exceeds limit, oldest accessed files are removed first
- **Access tracking**: `.access` files track last access time for each cached image
- **Expired cleanup**: Runs every 5 minutes, removes files older than CACHE_TTL (1 hour)
- **Pre-fetching**: When a tour loads, images for linked scenes are pre-fetched in background

**How it works**:
1. When `cacheImage()` is called, it checks cache size before downloading
2. If cache exceeds 500MB, `enforceCacheSizeLimit()` evicts oldest files
3. Each cached image has a `.access` file tracking last access time
4. Periodic cleanup removes expired files (older than CACHE_TTL)
5. When a tour loads, `preFetchLinkedScenes()` pre-fetches images for linked scenes

**Pre-fetching logic**:
- Finds all scene hotspots in the starting scene
- For each linked scene, checks if image is already cached
- If not cached, downloads in background (non-blocking)
- Logs pre-fetch status to console

### FR-11: Pre-fetch Linked Scene Images

**Priority**: Medium
**Status**: ✅ **Implemented (2026-06-18)**

**User story**: When loading a tour, images for scenes linked from the starting scene are pre-fetched in the background, so navigating to those scenes is instant.

**Implementation**:
- `preFetchLinkedScenes(tour, startSceneId)` function
- Called after tour resolution in `handleTourAPI()`
- Runs asynchronously without blocking the response
- Skips already-cached images
- Logs pre-fetch progress

---

### Phase 2.11 Additions (Done)
- Feature 10: FR-10 Image Cache Management ✅
- Feature 11: FR-11 Pre-fetch Linked Scene Images ✅

---

## Phase 2.12: File Format Decision — TOML vs JSON

**Date**: 2026-06-19
**Purpose**: Define the canonical format for tour definitions and legacy support strategy

### Decision: JSON is Canonical, TOML is Legacy Ingest-Only

**Status**: ✅ **Decision Made (2026-06-19)**

**Summary**:
- **JSON** is the canonical, primary format for all tour definitions
- **TOML** is supported for **ingestion only** (backward compatibility with existing wiki pages)
- **Export/output** always produces JSON (never TOML)
- **Studio** saves in JSON format only
- **Viewer** accepts both formats (for existing wiki pages)

### Rationale

1. **Pannellum uses JSON natively** — the viewer accepts JSON configuration directly
2. **JSON is the web standard** — all tools, APIs, and libraries work with JSON
3. **TOML was a convenience** — the hand-editing-friendly format was useful for early prototyping
4. **Round-trip fidelity** — our TOML parser is a one-to-one mapping of JSON structure, so TOML → JSON conversion is lossless
5. **Simplifies codebase** — only one format to maintain for export/preview/validation

### Current Behavior

**Ingestion (Viewer + Studio)**:
```javascript
// Auto-detect format and convert
if (content.trim().startsWith('{')) {
    // JSON format
    tourData = JSON.parse(content);
} else {
    // TOML format → convert to JSON
    tourData = parseTOML(content);
}
```

**Export (Studio)**:
```javascript
// Always export as JSON
const json = JSON.stringify(tourData, null, 2);
```

**Preview**:
```javascript
// Always use JSON (stored in localStorage)
localStorage.setItem('preview', JSON.stringify(tourData));
```

### TOML Format Specification

The TOML format is a **one-to-one mapping** of the JSON structure:

**JSON**:
```json
{
  "default": {
    "firstScene": "museum"
  },
  "scenes": {
    "museum": {
      "title": "Museum Interior",
      "panorama": "File:My_Photo.jpg",
      "hotSpots": [
        {
          "pitch": -17.35,
          "yaw": 33.77,
          "type": "scene",
          "sceneId": "street",
          "text": "Go outside"
        }
      ]
    }
  }
}
```

**TOML** (equivalent):
```toml
[default]
firstScene = "museum"

[scenes.museum]
title = "Museum Interior"
panorama = "File:My_Photo.jpg"

  [[scenes.museum.hotSpots]]
  pitch = -17.35
  yaw = 33.77
  type = "scene"
  sceneId = "street"
  text = "Go outside"
```

### What This Means for Users

1. **Existing TOML wiki pages** — continue to work (ingested and converted to JSON internally)
2. **New tours** — should be created in JSON format (Studio exports JSON)
3. **Hand-editing** — users who prefer hand-editing can still use TOML, but it will be converted to JSON on import
4. **Documentation** — all examples and templates should use JSON format going forward

### Implementation Notes

**TOML Parser Location**: `prototype/tour_server.mjs` — `parseTOML()` function

**Supported TOML Features**:
- Sections (`[section]`)
- Arrays of tables (`[[array]]`)
- Strings, numbers, booleans
- Nested objects

**Unsupported TOML Features** (not needed for our use case):
- Datetime values
- Inline tables
- Multi-line strings
- Comments (though we could add support)

### Migration Path

**Phase 1** (current): Both formats supported for ingestion
**Phase 2** (future): Deprecation warnings for TOML ingestion
**Phase 3** (long-term): Remove TOML parser, require JSON

### Files Involved

- `prototype/tour_server.mjs` — TOML parser and format auto-detection
- `prototype/studio.js` — Export always uses JSON
- `prototype/tour_viewer.html` — Ingestion supports both formats
- `CAVEATS.md` — Document TOML format limitations

### Related ADR

- ADR-004: Dual TOML + JSON format support
- ADR-006: TOML/JSON/YAML format decision

---

### Phase 2.12 Additions (Done)
- Feature 12: File Format Decision — TOML vs JSON ✅

---

## Phase 2.13: New Project Creation & Default Naming

**Date**: 2026-06-19
**Purpose**: Enable starting a new tour from scratch in Studio with sensible defaults

### Problem Statement

**Current workflow to create a new tour**:
1. Create a blank JSON file on Commons (manual)
2. Upload to Commons (manual)
3. Create a wiki page with the JSON content (manual)
4. Point Studio to the wiki page (`?page=` param)
5. Start editing

This is cumbersome and defeats the purpose of a visual editor.

**Current default naming**:
- Scene name: `scene_<timestamp>` (e.g., `scene_1750310400`)
- Creator: `Wikimedia Commons`

These are not user-friendly and don't communicate what the tour is about.

---

### FR-12: New Project Button in Studio

**Priority**: High
**Status**: Not implemented

**Description**: Add a "New Project" button in Studio that creates a blank tour definition in memory, allowing users to start editing immediately without first creating a wiki page.

**User Story**:
1. User opens Studio (`studio.html`)
2. Clicks "🆕 New Project" button
3. Studio creates a blank tour with sensible defaults
4. User adds scenes and hotspots
5. User exports JSON and saves to wiki page (or uses future OAuth save)

**UI Design**:

```
┌─────────────────────────────────────────────────────────────┐
│ Studio                                                      │
├─────────────────────────────────────────────────────────────┤
│ [🆕 New Project]  [📁 Import]  [💾 Export]                 │
│                                                             │
│  If no project loaded:                                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                     │    │
│  │         No tour loaded                              │    │
│  │                                                     │    │
│  │  [🆕 Start New Project]                             │    │
│  │                                                     │    │
│  │  Or import from wiki:                               │    │
│  │  [Enter wiki page URL...] [Load]                   │    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Implementation**:

```javascript
function createNewProject() {
    const state = {
        scenes: {},
        activeSceneId: null,
        activeTourId: null,  // No wiki page yet
        tourMeta: {
            author: DEFAULT_CREATOR,
            title: 'Untitled Tour'
        }
    };
    
    // Add first scene
    const sceneId = addScene();
    
    // Update UI
    renderSceneList();
    showStatus('New project created. Add scenes and hotspots.');
}
```

**New Project Template**:

```json
{
  "default": {
    "firstScene": "scene-1"
  },
  "scenes": {
    "scene-1": {
      "title": "Untitled Scene",
      "panorama": "",
      "hotSpots": []
    }
  },
  "author": "Wikimedia Commons",
  "title": "Untitled Tour"
}
```

**Files to Modify**:
- `prototype/studio.html` — Add "New Project" button to header and empty state
- `prototype/studio.js` — Add `createNewProject()` function

---

### FR-13: Configurable Default Names

**Priority**: Medium
**Status**: Not implemented

**Description**: Replace hardcoded default names with configurable constants that can be customized per installation.

**Current Defaults** (not user-friendly):
- Scene name: `scene_<timestamp>` (e.g., `scene_1750310400`)
- Creator: `Wikimedia Commons`

**Proposed Defaults**:
- Scene name: `Untitled Scene` or `Scene 1`, `Scene 2`, etc.
- Creator: `''` (empty) or configurable per installation

**Configuration Location**:

```javascript
// In studio.js or config.js
const CONFIG = {
    // Default names for new projects
    DEFAULT_SCENE_NAME: 'Untitled Scene',
    DEFAULT_SCENE_PREFIX: 'Scene',  // For numbering: Scene 1, Scene 2, etc.
    DEFAULT_TOUR_TITLE: 'Untitled Tour',
    DEFAULT_AUTHOR: '',  // Empty = prompt user to enter
    
    // Scene ID generation
    SCENE_ID_PREFIX: 'scene',  // scene-1, scene-2, etc.
    
    // Export defaults
    EXPORT_FORMAT: 'json',
    EXPORT_INDENTATION: 2
};
```

**Scene Naming Logic**:

```javascript
let sceneCounter = 0;

function generateSceneName() {
    sceneCounter++;
    return `${CONFIG.DEFAULT_SCENE_PREFIX} ${sceneCounter}`;
}

function generateSceneId() {
    sceneCounter++;
    return `${CONFIG.SCENE_ID_PREFIX}-${sceneCounter}`;
}
```

**Examples**:

| Current | Proposed |
|---------|----------|
| `scene_1750310400` | `scene-1` |
| `scene_1750310401` | `scene-2` |
| `Untitled` | `Untitled Scene` |
| `Wikimedia Commons` | `''` (empty) or configurable |

**User Story**:

1. User clicks "New Project"
2. First scene is named "Scene 1" (not `scene_1750310400`)
3. Second scene is named "Scene 2"
4. User is prompted to enter their name (not defaulted to "Wikimedia Commons")
5. Tour title defaults to "Untitled Tour"

**Installation Configuration**:

For Toolforge deployment, these can be set in environment variables:

```bash
# In webservice environment
DEFAULT_AUTHOR="Wikimedia Commons"
DEFAULT_SCENE_PREFIX="Scene"
```

Or in a config file:

```json
// /data/project/wikipano/config.json
{
    "defaultAuthor": "Wikimedia Commons",
    "defaultScenePrefix": "Scene",
    "defaultTourTitle": "Untitled Tour"
}
```

**Files to Modify**:
- `prototype/studio.js` — Add CONFIG object, update `addScene()` to use `generateSceneName()`
- `prototype/studio.js` — Update `createNewProject()` to use new defaults
- `prototype/tour_server.mjs` — Serve config.json if present

---

### FR-14: Tour Metadata Editor

**Priority**: Medium
**Status**: Not implemented

**Description**: Add a properties panel for editing tour-level metadata (title, author, description) that persists across sessions.

**Current State**:
- Tour title is hardcoded as `Untitled Tour`
- Author is hardcoded as `Wikimedia Commons`
- No UI to edit these fields

**Proposed UI**:

```
┌─────────────────────────────────────────────────────────────┐
│ Tour Properties                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Title:    [My Awesome Tour_______________]                  │
│                                                             │
│ Author:   [Your Name____________________]                  │
│                                                             │
│ Wiki:     [User:YourName/My_Tour________] (optional)       │
│                                                             │
│ Description:                                                │
│ [_______________________________________________]          │
│ [_______________________________________________]          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Implementation**:

```javascript
// In tour metadata
const tourMeta = {
    title: 'Untitled Tour',
    author: '',
    description: '',
    wikiPage: null,  // Set when saved to wiki
    wikiSite: null   // 'commons', 'en', etc.
};

// Save to localStorage for persistence
function saveTourMeta() {
    localStorage.setItem('studio-tour-meta', JSON.stringify(tourMeta));
}

// Load from localStorage
function loadTourMeta() {
    const saved = localStorage.getItem('studio-tour-meta');
    if (saved) {
        Object.assign(tourMeta, JSON.parse(saved));
    }
}
```

**Files to Modify**:
- `prototype/studio.html` — Add Tour Properties panel
- `prototype/studio.js` — Add `tourMeta` state, `saveTourMeta()`, `loadTourMeta()`
- `prototype/studio.js` — Update `createNewProject()` to include metadata
- `prototype/studio.js` — Update `exportTour()` to include metadata in JSON

---

### Phase 2.13 Additions (Pending)
- Feature 13: FR-12 New Project Button
- Feature 14: FR-13 Configurable Default Names
- Feature 15: FR-14 Tour Metadata Editor

---

## Phase 2.14: UI Polish & Bug Fixes

**Date**: 2026-06-19
**Purpose**: Fix visual overlap issues and polish the viewer/studio UI

### FR-15: Immersive Toggle Button Overlapping Header

**Priority**: Medium
**Status**: Not implemented
**Type**: Bug fix

**Description**: The immersive mode toggle button (`#toggle-immersive-btn`) is a circular button with `☰` positioned fixed at `top: 20px; right: 20px` with `z-index: 1000`. In the non-immersive (default/expanded) view mode, this button overlays the header bar, sitting on top of header text and controls.

**Visual**:
```
┌───────────────────────────────────────────────┐
│ 🔭 Wikimedia Photosphere Tour  ┌───┐         │
│ Phase 1 Prototype              │ ☰ │ ← overlaps│
│                                 └───┘         │
│ ┌────────────────────────────────────────┐    │
│ │ [Wiki page title____________] [Load]  │    │
│ └────────────────────────────────────────┘    │
└───────────────────────────────────────────────┘
```

**Root cause**: The `#toggle-immersive-btn` is always visible (position: fixed, z-index: 1000), but in the non-immersive view, the header is shown and the button sits on top of it at position `top: 20px; right: 20px` — right where the header is.

**Possible fixes**:
1. **Move button below header in non-immersive mode**: Adjust `top` position to account for header height (~60px) when not in immersive mode
2. **Hide button in non-immersive mode**: Only show the toggle button when actually in immersive mode
3. **Reposition to bottom corner**: Move to bottom-left or bottom-right instead of top-right
4. **Reduce z-index**: Lower z-index so it doesn't float above the header

**Suggestion**: Option 1 — adjust `top` from `20px` to `70px` when not in immersive mode (`.tour-viewer:not(.immersive) #toggle-immersive-btn { top: 70px; }`). This keeps the button accessible without overlapping the header row.

### FR-16: Sticky Immersive Mode Preference vs Canonical URL Consistency

**Priority**: Medium
**Status**: ✅ **Implemented (2026-06-19)**
**Type**: UX behavior decision

**Description**: The immersive mode preference is persisted to `localStorage` (`localStorage.getItem('immersive')` / `localStorage.setItem('immersive', ...)`). This means:

1. First visit to a URL → starts in immersive (full-screen) mode ✅
2. User toggles to detailed mode (sidebar + header visible)
3. Same URL is reloaded → **starts in detailed mode**, not immersive ❌

The preference "sticks" to whatever mode the user was last in, making the canonical tour URL non-deterministic.

**The question**: Should a canonical tour URL (`wikipano.toolforge.org/?page=User:Fuzheado/Panellum_Tour`) always start in immersive mode, regardless of the user's last preference?

**Arguments for always-starting-immersive**:
- Canonical URLs are predictable — every visitor sees the same initial experience
- New visitors discover the tour in the intended full-screen panoramic view
- Immersive is the "hero" experience; detailed mode is a power-user feature
- Tour creators can rely on the URL always presenting the tour in the same way
- Avoids confusion when sharing links ("it worked when I opened it, but when my friend reloaded it looked different")

**Arguments for localStorage preference (current behavior)**:
- Respects user's choice — if they prefer detailed mode, they don't have to toggle every time
- Power users who are navigating multiple tours don't need to re-opt out each time
- Standard web convention (e.g., light/dark mode, sidebar state)

**Possible resolution**:
1. **Remove localStorage persistence entirely** — always start immersive; user preference is session-only. This makes the canonical URL fully deterministic.
2. **Add a URL parameter to override** — e.g., `?mode=detailed` or `?mode=immersive` to explicitly choose. If omitted, default to immersive. This gives the best of both worlds: canonical URL is always immersive, but users can opt into detailed mode via the toggle during a session.
3. **Tour-level configuration** — Let the tour definition (JSON/TOML) specify `default.viewMode = "immersive" | "detailed"`, so the tour creator decides the default experience for their specific tour.

**Recommendation**: Option 2 or a combined 2+3 — always start immersive by default (remove localStorage persistence), but accept `?mode=detailed` URL parameter for explicit override.

### Implementation (2026-06-19)

Implemented combined option 2+3:

**Priority chain**:
1. URL parameter `?mode=immersive|detailed` — highest priority (explicit user override)
2. Tour JSON `default.viewMode` — tour creator's intended default
3. Default `'immersive'` if neither specified

**Changes**:
- `tour_viewer.html`: Removed localStorage persistence, added `applyTourViewMode()` function
- `studio.js`: Added `state.viewMode`, exported in `default.viewMode`
- `studio.html`: Added "Default View Mode" select in Tour Settings panel
- `playwright.config.js`: Added `webServer` config for auto-starting server
- `tests/immersive-mode.spec.js`: 18 regression tests (all passing)

**URL examples**:
```
https://wikipano.toolforge.org/?page=User:Example/Tour              # Tour's default viewMode
https://wikipano.toolforge.org/?page=User:Example/Tour&mode=detailed # Override to detailed
https://wikipano.toolforge.org/?page=User:Example/Tour&mode=immersive # Override to immersive
```

**Tour JSON example**:
```json
{
  "default": {
    "firstScene": "museum",
    "viewMode": "detailed"
  },
  "scenes": { ... }
}
```

---

## Phase 2.15: Welcome & Onboarding

**Date**: 2026-06-19
**Purpose**: First-impression experience for new visitors

### FR-17: Welcome Greeting Box

**Priority**: Medium
**Status**: Not implemented
**Type**: New feature

**Description**: A dismissible greeting box that appears when a tour loads, showing a welcome message or instructions. Useful for tour creators to provide context, instructions, or a brief introduction before the visitor explores.

### Use Cases

- **Tour introduction**: "Welcome to the Banned Books Museum tour. Click the red arrows to navigate between rooms."
- **Instructions**: "Drag to look around. Click hotspots for more information."
- **Credits**: "This tour features 360° photos by Fuzheado, taken on location in 2024."
- **Accessibility note**: "Use the 🧭 button on mobile to enable gyroscope control."

### UI Design

```
┌─────────────────────────────────────────────────────────┐
│                    360° PANORAMA                         │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  👋 Welcome to the Banned Books Museum          │   │
│  │                                                 │   │
│  │  Click the red arrows to navigate between       │   │
│  │  rooms. Click blue info icons for details.      │   │
│  │                                                 │   │
│  │                              [× Dismiss]        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│                                         🧭  ≡           │
└─────────────────────────────────────────────────────────┘
```

### Behavior

- **Position**: Bottom-left corner (above footer, below toggle button)
- **Dismissal**: Click "× Dismiss" button or press `X` key
- **Persistence**: Dismissal remembered in `sessionStorage` (per-session only; reappears on new visit)
- **Animation**: Fade in on load, fade out on dismiss
- **Only shown when**: Tour JSON includes a `welcome` object (see below)
- **No box if**: No `welcome` in tour JSON — nothing shown

### Tour JSON Schema

```json
{
  "default": {
    "firstScene": "museum",
    "welcome": {
      "title": "Welcome to the Banned Books Museum",
      "message": "Click the red arrows to navigate between rooms. Click blue info icons for details.",
      "dismissText": "× Dismiss"
    }
  },
  "scenes": { ... }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `title` | No | Bold heading text (e.g., "Welcome!") |
| `message` | Yes | Body text shown in the box |
| `dismissText` | No | Button label (default: "× Dismiss") |

### Studio UI

Add a "Welcome Message" section in the Tour Settings panel:

- **Title** (text input, optional)
- **Message** (textarea, required to enable)
- **Preview**: Shows how the greeting box will look
- Clear button to remove welcome message

### Implementation Effort

**MVP**: ~2-3 hours
- HTML/CSS for greeting box
- JavaScript for show/dismiss/sessionStorage
- Tour JSON parsing
- Studio UI for editing

**Full**: ~4-5 hours
- Markdown support in message text
- Typing animation effect
- Auto-dismiss after N seconds option
- Image/media support in greeting box

### Files to Modify

- `prototype/tour_viewer.html` — Add greeting box HTML/CSS/JS
- `prototype/studio.html` — Add welcome message editor in Tour Settings
- `prototype/studio.js` — Add `state.welcome`, export/import logic
- `HANDOVER.md` — Document feature
- `CAVEATS.md` — Document any gotchas

---

### FR-18: Video Popup Title/Caption

**Priority**: Medium
**Status**: Not implemented
**Type**: New feature

**Description**: Currently, video hotspots open a raw video overlay with no context — no title, no caption, no description. Users have no idea what they're about to watch. Add a title/caption bar above the video player to provide context.

### Current Behavior

```
┌─────────────────────────────────────────────────────────┐
│ ×
├─────────────────────────────────────────────────────────┤
│                                                         │
│                    🎬 VIDEO                            │
│                    (raw player, no context)             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Desired Behavior

```
┌─────────────────────────────────────────────────────────┐
│ ×
├─────────────────────────────────────────────────────────┤
│  🎬 Original Filming Location (1920)                    │
│  Archival footage of the museum's opening day           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                    ▶️ VIDEO PLAYER                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Tour JSON Schema

```json
{
  "scenes": {
    "museum": {
      "hotSpots": [
        {
          "type": "info",
          "hotspotSubtype": "video",
          "videoUrl": "File:Archival_Footage.webm",
          "videoTitle": "Original Filming Location (1920)",
          "videoCaption": "Archival footage of the museum's opening day",
          "text": "Watch archival footage"
        }
      ]
    }
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `videoTitle` | No | Bold heading shown above video |
| `videoCaption` | No | Smaller description text below title |

---

### FR-19: Video Start/Stop Timecode

**Priority**: Medium
**Status**: Not implemented
**Type**: New feature

**Description**: Allow tour creators to specify start and end times for video playback, so only a relevant segment is shown. Useful for long videos where only a specific portion is relevant to the scene.

### Use Cases

- **Archival footage**: Show only the 30-second segment featuring the museum
- **Interview clips**: Play just the relevant quote (1:23 to 1:45)
- **YouTube embeds**: Skip intros, play only the useful part
- **Demo videos**: Show a specific feature demonstration

### Implementation Details

**HTML5 Video** (Commons/direct URLs):
```javascript
video.currentTime = startTime;  // Seek to start
video.addEventListener('timeupdate', function() {
    if (video.currentTime >= endTime) {
        video.pause();
    }
});
```

**YouTube Embeds** (via URL parameters):
```
https://www.youtube.com/embed/VIDEO_ID?autoplay=1&start=30&end=60
```

### Tour JSON Schema

```json
{
  "scenes": {
    "museum": {
      "hotSpots": [
        {
          "type": "info",
          "hotspotSubtype": "video",
          "videoUrl": "File:Long_Interview.webm",
          "videoTitle": "Curator's Commentary",
          "videoCaption": "The curator discusses the rare book collection",
          "videoStartTime": 85,
          "videoEndTime": 145,
          "text": "Listen to curator"
        }
      ]
    }
  }
}
```

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `videoStartTime` | No | number | Start time in seconds (default: 0) |
| `videoEndTime` | No | number | End time in seconds (default: video length) |

**Timecode format alternatives** (future):
- Seconds: `85`
- MM:SS: `1:25`
- HH:MM:SS: `01:01:25`

### Studio UI

Add to the video hotspot modal:

```
┌─ Add Hotspot ─────────────────────────────────────┐
│ ...
│ Video URL: [File:Long_Interview.webm           ] │
│ Title:    [Curator's Commentary                 ] │
│ Caption:  [The curator discusses the rare...     ] │
│                                                     │
│ ⏱️ Time Range (optional)                          │
│ Start: [0:00   ]  End: [2:25    ]  [▶ Preview]   │
│                                                     │
│ [Cancel]                          [Add Hotspot]    │
└─────────────────────────────────────────────────────┘
```

- Time inputs accept `MM:SS` or seconds
- "Preview" button opens video at the specified timecodes
- Clear button to remove time constraints

### Implementation Effort

**FR-18 (Title/Caption)**: ~1-2 hours
- Add title/caption HTML to video overlay
- Parse `videoTitle`/`videoCaption` from hotspot data
- Studio modal inputs

**FR-19 (Timecodes)**: ~2-3 hours
- HTML5 video: `currentTime` + `timeupdate` listener
- YouTube: URL parameters `?start=&end=`
- Studio timecode inputs with validation
- Preview button

**Combined (FR-18 + FR-19)**: ~3-4 hours

### Files to Modify

- `prototype/tour_viewer.html` — Video overlay HTML/CSS/JS, timecode logic
- `prototype/studio.html` — Video hotspot modal (title, caption, time inputs)
- `prototype/studio.js` — Parse/export `videoTitle`, `videoCaption`, `videoStartTime`, `videoEndTime`
- `HANDOVER.md` — Document features
- `CAVEATS.md` — YouTube timecode limitations, seeking behavior