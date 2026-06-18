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

## Summary: Prioritized Feature List

| # | Feature | Source | Priority | Effort | Phase | Status |
|---|---|---|---|---|---|---|
| 1 | Set current view as default yaw/pitch/hfov for scene | Panaedit | **High** | 30 min | 2.5 | ✅ Done |
| 2 | Draggable hotspot repositioning ("set to current view" button) | Panaedit | **High** | 1-2 hrs | 2.5 | ✅ Done |
| 3 | Entry view override per hotspot (targetYaw/pitch/hfov) | Novel | Medium | 2-3 hrs | 2.5 | |
| 4 | Autorotate toggle button in viewer | Marzipano | Medium | 2-3 hrs | 2.5 | |
| 5 | Fullscreen/theater mode in viewer | Marzipano | Medium | 1-2 hrs | 2.5 | |
| 6 | Scene thumbnail crop control (specify region) | Improvement | Medium | 3-4 hrs | 3 | |
| 7 | Floor plan editor with draggable markers | Panaedit | Medium | 3-5 days | 3 | |
| 8 | Wikipedia article side panel (click-to-open) | Panaedit | Low | 2-3 hrs | 3 | |

### Phase 2.5 Additions (Small Effort, High Value)
- ~~Feature 1: Set default view button in scene properties~~ ✅
- ~~Feature 2: "Set to current view" in hotspot edit modal~~ ✅
- Feature 3: targetYaw/targetPitch/targetHfov fields in scene link modal
- Feature 4: Autorotate toggle in viewer footer
- Feature 5: Theater mode button (hide all UI)

### Phase 3 Additions (Larger Effort)
- Feature 6: Scene thumbnail crop control
- Feature 7: Floor plan editor (or leverage PSV PlanPlugin)
- Feature 8: Wikipedia article side panel

---

## Implementation Dependencies

Some features depend on others:
- **Feature 2 (hotspot repositioning)** ~~depends on Feature 1~~ — both now share the same `viewer.getYaw()/getPitch()` pattern ✅
- **Feature 3 (entry view override)** depends on Pannellum's native `targetYaw/targetPitch/targetHfov` support — already built in, just needs UI
- **Feature 5 (theater mode)** can be implemented standalone and works alongside any other feature
- **Feature 7 (floor plan)** is Phase 3 and independent of other features