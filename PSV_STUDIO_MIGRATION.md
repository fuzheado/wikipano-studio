# PSV Authoring Environment: Gap Analysis & Migration Path

**Date**: 2026-06-18
**Status**: Research finding — visual authoring tool gap + adaptation plan

---

## Finding: No PSV Visual Authoring Tool Exists

Photo-Sphere-Viewer has an excellent plugin ecosystem (VirtualTourPlugin, MarkersPlugin, GalleryPlugin, PlanPlugin, CompassPlugin, etc.) but **no visual authoring environment** — no equivalent to:
- Panaedit (visual editor for Pannellum)
- Marzipano Tool (desktop hotspot placement)
- Our own studio.js

Anyone who wants to create a PSV tour must hand-edit the VirtualTourPlugin JSON configuration. There is no click-to-place, scene management, or export tooling in the PSV ecosystem.

This creates a unique opportunity: **adapting our existing Pannellum-based studio to Photo-Sphere-Viewer would be the first visual authoring tool for the PSV ecosystem.**

---

## Architecture: What We'd Change vs. What Stays

Our studio is well-structured with a clean separation between:

```
state object (scenes, hotspots, activeSceneId)
    ↓
viewport rendering layer ← ONLY THIS LAYER NEEDS REWRITING
    ↓
scene management + import/export + UI + modals (reusable)
```

### What Changes: Viewport Rendering Layer (~200 lines of studio.js)

| Studio Action | Pannellum (current) | Photo-Sphere-Viewer (replacement) |
|---|---|---|
| **Instantiate viewer** | `pannellum.viewer('viewport', config)` | `new Viewer({ container, plugins: [MarkersPlugin, VirtualTourPlugin, ...] })` |
| **Click-to-capture coords** | `viewer.on('click', ...)` → `mouseEventToCoords(e)` | `viewer.on('click', (e, data) => data.longitude, data.latitude)` — cleaner |
| **Add info hotspot** | `viewer.addHotSpot({ pitch, yaw, type, text })` | `markersPlugin.addMarker({ id, position: { yaw, pitch }, image, tooltip })` |
| **Render hotspots on scene load** | Loop → `addHotSpot()` per hotspot | `markersPlugin.setMarkers(markersArray)` — batch render |
| **Edit hotspot** | Iterate getHotSpots(), remove + re-add | `markersPlugin.updateMarker({ id, ...changes })` — direct update |
| **Delete hotspot** | `viewer.removeHotSpot(id)` | `markersPlugin.removeMarker(id)` |
| **Navigate to hotspot** | `viewer.animate({ yaw, pitch, hfov })` | `markersPlugin.gotoMarker(id, speed)` |
| **Get current coords** | `viewer.getYaw() / getPitch()` | `viewer.getPosition()` → `{ longitude, latitude }` |

### What Stays Exactly the Same

- All scene management (add/delete/reorder) — scene data structure is library-agnostic
- All import/export logic — our JSON abstraction layer converts to Pannellum format; we'd add a PSV conversion path
- All modals (add scene, add hotspot, edit hotspot, properties panel)
- All URL state management (`?page=`, `?scene=`, `history.replaceState`)
- All localStorage preview system
- Commons image resolution (server-side, library-agnostic)
- Yaw normalization to [-180, 180]
- Integrity checks (`validateHotspot()`, `validateTour()`)
- All CSS and HTML structure (layout, sidebar, modals, buttons)

---

## The Scene Links Architecture Difference

This is the most significant architectural difference to understand.

**Pannellum model**: All hotspots (scene links + info markers) are the same entity with `type: "scene"` or `type: "info"`.

**PSV model**: Two separate systems:
- **Info markers** → MarkersPlugin (user-placed points of interest)
- **Scene links** → VirtualTourPlugin (tour navigation arrows between nodes)

The VirtualTourPlugin manages scene-to-scene navigation with 3D arrows, preloading, and GPS positioning. Info markers managed via MarkersPlugin are independent.

In practice this means the studio needs to handle two plugin contexts simultaneously:

```js
// Studio viewport initialization (PSV)
const viewer = new Viewer({
    container: 'viewport',
    plugins: [
        MarkersPlugin,
        [VirtualTourPlugin, {
            positionMode: 'manual', // or 'gps'
            nodes: [...],           // current scene nodes from state
            startNodeId: activeSceneId,
        }],
    ],
});

const markersPlugin = viewer.getPlugin(MarkersPlugin);
const tourPlugin = viewer.getPlugin(VirtualTourPlugin);
```

And when the user links two scenes together, the studio would update the VirtualTourPlugin's node links rather than adding a Pannellum-style hotspot.

---

## PSV Tour Node Format (Cleaner than Pannellum's)

```js
// PSV VirtualTourPlugin node format
{
    id: 'museum',
    panorama: 'https://upload.wikimedia.org/wikipedia/commons/...',
    name: 'Banned Books Museum',
    caption: 'Andrew Lih',
    thumbnail: 'https://.../thumb.jpg',  // 200px for gallery
    links: [
        {
            nodeId: 'street',
            tooltip: 'Road outside, Tallinn',
            // optional: linkOffset for visual position adjustment
        },
        {
            nodeId: 'library',
            tooltip: 'Go to library',
        }
    ],
    markers: [
        // rich info markers embedded in the node
        {
            id: 'info-1',
            position: { yaw: '33.77deg', pitch: '-17.35deg' },
            image: 'pin-blue.png',  // or HTML, SVG, etc.
            tooltip: { content: 'The Satanic Verses by Salman Rushdie', trigger: 'click' },
        }
    ]
}
```

This is actually cleaner than Pannellum's flat hotspot array — nodes own their own markers, which aligns with our scene-based state model.

---

## Migration Effort Estimate

| Component | Effort | Notes |
|---|---|---|
| **PSV viewer instantiation** | ~1 day | Import via CDN/importmap, plugins config |
| **Click-to-capture (dev mode)** | ~4 hours | PSV click event with longitude/latitude; no `hotSpotDebug` equivalent so we add our own |
| **MarkersPlugin CRUD** | ~1 day | addMarker/updateMarker/removeMarker — very similar to existing patterns |
| **VirtualTourPlugin integration** | ~2 days | Scene-to-scene linking, render 3D arrows, sync with scene management |
| **Adapt CSS/styling** | ~1 day | PSV uses different class names; hotspot icons need updating |
| **Rewrite Playwright tests** | ~1 day | Viewport interaction tests need new selectors and PSV API |
| **Server + import/export** | **0 days** | Library-agnostic, reuse as-is |
| **All scene management UI** | **0 days** | Library-agnostic, reuse as-is |
| **Total** | **~6-7 days** | Significant but bounded |

Compare to building a PSV authoring tool from scratch: **3-4 weeks minimum**.

---

## What We Gain from the Migration

| Feature | Pannellum (current) | PSV (after migration) |
|---|---|---|
| **Gallery strip** | ❌ Must custom-build | ✅ Built-in (`GalleryPlugin`) — just add config |
| **Map overview** | ❌ Must custom-build | ✅ Built-in (`PlanPlugin` with OpenStreetMap) |
| **GPS auto-placement** | ❌ Impossible | ✅ EXIF → map positioning via `positionMode: 'gps'` |
| **Rich markers** | Basic info only | HTML/image/video/SVG with CSS animations |
| **Hotspot rendering** | Buggy (Pannellum 2.5.7 container visibility issue) | Clean — PSV doesn't have this |
| **360° video in markers** | Custom work | ✅ Native via `videoLayer` marker type |
| **TypeScript support** | ❌ Vanilla JS | ✅ Better IDE support, catch errors early |
| **Active development** | Low (1 maintainer, time-constrained) | High (active core maintainer, regular releases) |
| **First PSV visual editor** | N/A | ✅ Unique in the ecosystem |

---

## Abstraction Layer Strategy

The key to keeping this manageable is the **abstraction layer** between our wiki storage format and the rendering library.

```
Wiki Page JSON (our format, library-agnostic)
    ↓
Import/Export layer (adapts our format ↔ Pannellum OR PSV)
    ↓
Rendering Library (Pannellum for Phase 2.5, PSV for Phase 3)
```

Our current `importTourData()` and `exportTour()` functions already do this for Pannellum. We'd add PSV conversion paths:

```js
// Conceptual abstraction layer
function importTourData(rawData) {
    // Detect format, parse, store in state
    state.scenes = rawData.scenes;
}

function renderForPannellum(state) {
    // Convert state → Pannellum JSON schema
}

function renderForPSV(state) {
    // Convert state → PSV VirtualTourPlugin node format
}

function exportForPannellum(state) { /* existing */ }
function exportForPSV(state) { /* new: state → PSV node format */ }
```

This keeps the wiki-as-storage layer completely library-agnostic while the rendering layer can swap between Pannellum and PSV.

---

## Dev Mode Note: No `hotSpotDebug` Equivalent

Pannellum has a built-in `hotSpotDebug: true` config that logs yaw/pitch to console on every click. PSV doesn't have this. We'd add our own:

```js
// Studio dev mode — click anywhere to log coords
if (this.devMode) {
    viewer.addEventListener('click', (e, data) => {
        console.log(`yaw: ${(data.longitude * 180 / Math.PI).toFixed(2)}°, pitch: ${(data.latitude * 180 / Math.PI).toFixed(2)}°`);
    });
}
```

Trivial to implement. Not a concern.

---

## Recommendation

**Adapt the existing studio for Photo-Sphere-Viewer.** This is the realistic path:

1. Deploy Phase 2.5 with the current Pannellum-based studio (ship the tool)
2. For Phase 3, migrate the viewport rendering layer to PSV (~6-7 days work)
3. The server, scene management, import/export, and all UI chrome are reusable
4. Result: **first visual authoring tool in the PSV ecosystem**, with GalleryPlugin, PlanPlugin, MarkersPlugin, and VirtualTourPlugin all wired into the wiki storage layer

The migration is bounded, the reusable components are substantial, and the outcome is a genuinely differentiated product.

---

## References

- Photo-Sphere-Viewer MarkersPlugin: https://photo-sphere-viewer.js.org/plugins/markers.html
- Photo-Sphere-Viewer VirtualTourPlugin: https://photo-sphere-viewer.js.org/plugins/virtual-tour.html
- Photo-Sphere-Viewer GalleryPlugin: https://photo-sphere-viewer.js.org/plugins/gallery.html
- Photo-Sphere-Viewer PlanPlugin: https://photo-sphere-viewer.js.org/plugins/plan.html
- COMPETITIVE_ANALYSIS.md: Full competitive landscape and strategic assessment