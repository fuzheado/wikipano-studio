# Visual Debugging Guide — Photosphere Tours

How to debug the Photosphere Tour Studio and Viewer using `playwright-cli` (already installed).

## Contents

- [The Core Challenge: WebGL Canvas](#the-core-challenge)
- [Quick Reference](#quick-reference)
- [Session Lifecycle](#session-lifecycle)
- [Studio: Exploration & Interaction](#studio-exploration--interaction)
- [The 360° Viewport (Pannellum)](#the-360-viewport-pannellum)
- [Hotspot Workflows](#hotspot-workflows)
- [Import / Export / Preview](#import--export--preview)
- [Tour Viewer Debugging](#tour-viewer-debugging)
- [Network & API Debugging](#network--api-debugging)
- [Visual Review (User Feedback)](#visual-review)
- [Recording Bug Sessions](#recording-bug-sessions)
- [Troubleshooting](#troubleshooting)
- [Script Automation](#script-automation)

---

## The Core Challenge

The Studio has a **three-layer architecture** that requires different inspection techniques:

| Layer | What's Here | Debug Method |
|---|---|---|
| **1. DOM** | Toolbar, scene list, properties panel, modals | `snapshot` + `click`/`fill` — standard accessibility tree |
| **2. Network/JS** | API calls to Commons, image resolution, console logging | `console` + `requests` — watch for 404s, CORS errors, timeouts |
| **3. WebGL Canvas** | Pannellum 360° viewport, hotspot sprites, scene transitions | `eval` — call Pannellum's and studio's JS APIs directly |

**The key insight**: You cannot find hotspot icons or 360° content in the accessibility tree — it's a GPU-rendered `<canvas>`. Instead, `eval` into the page to inspect `state.*` and `state.pannellumViewer.*`.

---

## Quick Reference

```bash
# ── Start the server ──
cd prototype && node tour_server.mjs
# Server: http://localhost:8765

# ── Open session ──
playwright-cli open http://localhost:8765/studio.html
playwright-cli open http://localhost:8765/tour_viewer.html

# ── Inspect ──
playwright-cli snapshot                      # accessibility tree with element refs
playwright-cli snapshot --boxes              # include bounding boxes
playwright-cli screenshot                     # visual capture
playwright-cli console                        # JS errors and logs
playwright-cli requests                       # network requests & responses

# ── Interact ──
playwright-cli click e5                       # by snapshot ref
playwright-cli fill e44 "File:Photo.jpg"      # fill text field
playwright-cli press Enter                    # keyboard
playwright-cli eval "state.activeSceneId"     # peek at JS state
playwright-cli run-code script.js             # execute full Playwright JS

# ── 360° Viewport ──
playwright-cli eval "state.pannellumViewer.getYaw()"
playwright-cli eval "state.pannellumViewer.lookAt(0, 90, 110)"
playwright-cli eval "state.scenes[state.activeSceneId].hotSpots.length"

# ── Visual Review ──
playwright-cli show --annotate                # user marks up live page

# ── Recording ──
playwright-cli video-start debug.webm
playwright-cli video-chapter "Bug found" --duration=3000
playwright-cli video-stop

# ── Cleanup ──
playwright-cli close
playwright-cli close-all
```

---

## Session Lifecycle

```bash
# Start fresh
playwright-cli open http://localhost:8765/studio.html

# Use named session for multiple windows
playwright-cli -s=studio open http://localhost:8765/studio.html
playwright-cli -s=viewer open http://localhost:8765/tour_viewer.html
playwright-cli -s=studio click e5
playwright-cli -s=studio close

# After each command, you get:
#   - Page URL + title (confirm you're on the right page)
#   - Console entries (errors first — red flag)
#   - Snapshot (find element refs for next interaction)
#   - Screenshot path (if requested)

# Close when done
playwright-cli close
```

---

## Studio: Exploration & Interaction

### Initial state

Open the studio. The viewport shows `🏞️ Add a scene to get started` and the scene list is empty.

```bash
playwright-cli open http://localhost:8765/studio.html
playwright-cli snapshot
```

Expected refs after loading:
- `e3` — "🎬 Photosphere Tour Studio" heading
- `e5` — Import button
- `e6` — Export button
- `e7` — Preview button
- `e10` — "📍 Scenes" heading
- `e12` — "+ Add Scene" button
- `e20` — "Scene title" textbox (properties)
- `e24` — HFOV spinbutton (default 110)
- `e27` — Yaw spinbutton (default 0)
- `e30` — Pitch spinbutton (default 0)
- `e33` — "👁 Show All" button
- `e44` — Add Scene modal: file input
- `e48` — Add Scene modal: title input
- `e50` — Add Scene modal: Cancel
- `e51` — Add Scene modal: Add Scene

### Adding a scene

```bash
# Open the modal
playwright-cli click e12

# Fill in the form
playwright-cli fill e44 "File:Tallinn_Aerial_360.jpg"
playwright-cli fill e48 "Tallinn Old Town"

# Check console first — any errors before confirming?
playwright-cli console

# Confirm
playwright-cli click e51

# Check for resolution errors
playwright-cli console error

# Verify scene was created
playwright-cli eval "state.sceneOrder.length"
playwright-cli eval "state.scenes[state.activeSceneId].title"
```

**Common failure pattern**: The `/api/resolve` endpoint returns 404 when the file doesn't exist on Commons or the `File:` prefix is mangled. Check with:

```bash
# Manually test resolution
curl "http://localhost:8765/api/resolve?file=Tallinn_Aerial_360.jpg"
```

### Working with modals

All modals (Add Scene, Add Hotspot, Import, Export) support:

```bash
# Dismiss via × button
playwright-cli click e42    # close button

# Dismiss via Escape
playwright-cli press Escape

# Dismiss via click outside
playwright-cli mousemove 10 10
playwright-cli mousedown
```

When a modal is open, the snapshot will show it as a top-level element in the tree. Most modal controls have `[active]` attribute when the modal is showing.

---

## The 360° Viewport (Pannellum)

This is the most important technique section. Pannellum renders into a WebGL canvas — you cannot interact with hotspot icons via `click e15`. You must use the JavaScript API.

### Checking viewport state

```bash
# Is Pannellum initialized?
playwright-cli eval "!!state.pannellumViewer"

# Is the current scene loaded?
playwright-cli eval "state.pannellumViewer.isLoaded ? 'loaded' : 'not loaded'"

# Current camera position
playwright-cli eval "state.pannellumViewer.getYaw()"
playwright-cli eval "state.pannellumViewer.getPitch()"
playwright-cli eval "state.pannellumViewer.getHfov()"
```

### Programmatic navigation

```bash
# Look at a specific direction
playwright-cli eval "state.pannellumViewer.lookAt(0, 45, 110)"

# Animate to a hotspot
playwright-cli eval "state.pannellumViewer.lookAt(-17.35, 33.77, 110)"

# Cycle through existing hotspots (calls the studio's cycleHotspots())
playwright-cli eval "cycleHotspots()"
```

### Simulating viewport clicks

Pannellum's `mouseEventToCoords()` needs a real mouse event. You can't fake it with `eval`. Instead:

**Option A**: Use Playwright mouse commands on the viewport DOM element:
```bash
# Click at pixel (400, 300) in the viewport
playwright-cli mousemove 400 300
playwright-cli mousedown
playwright-cli mouseup

# Check if coordinates were captured
playwright-cli eval "state.capturedCoords"
```

**Option B**: Programmatically add a hotspot at known coordinates (bypass clicking):
```bash
# Directly inject a scene-link hotspot
playwright-cli eval "
  const hs = { pitch: -17.35, yaw: 33.77, type: 'scene', text: 'Go outside', sceneId: 'scene_1234567890' };
  state.scenes[state.activeSceneId].hotSpots.push(hs);
  loadSceneIntoViewport(state.activeSceneId);
"
```

### Verifying hotspot rendering

```bash
# Count hotspots in active scene
playwright-cli eval "state.scenes[state.activeSceneId].hotSpots.length"

# Get all hotspot details
playwright-cli eval "JSON.stringify(state.scenes[state.activeSceneId].hotSpots, null, 2)"

# Check hotspot types
playwright-cli eval "state.scenes[state.activeSceneId].hotSpots.map(h => ({text: h.text, type: h.type, yaw: h.yaw.toFixed(1), pitch: h.pitch.toFixed(1)}))"
```

### Viewport visual verification

```bash
# Screenshot the full page
playwright-cli screenshot --filename=viewport-state.png

# If only the viewport container, crop later or use run-code
playwright-cli run-code script.js   # where script.js does element-level screenshot
```

---

## Hotspot Workflows

### Adding a hotspot (click in viewport)

```bash
# 1. Move mouse to where you want the hotspot
#    (the viewport area starts roughly at x=260, y=50)
playwright-cli mousemove 500 300

# 2. Click to capture coordinates
playwright-cli mousedown
playwright-cli mouseup

# 3. Verify capture
playwright-cli eval "state.capturedCoords"

# 4. Click the "Place Hotspot Here" button
#    (find its ref from snapshot — typically after capturing)
playwright-cli snapshot
playwright-cli click e60   # ref varies; check snapshot

# 5. Fill in the hotspot modal
playwright-cli select e63 "scene"   # type
playwright-cli fill e65 "Enter the courtyard"
# For scene links, select target:
playwright-cli select e67 "scene_1234"
# For info hotspots:
playwright-cli select e63 "info"
playwright-cli fill e69 "https://en.wikipedia.org/wiki/Tallinn"

# 6. Confirm
playwright-cli click e71

# 7. Verify
playwright-cli eval "state.scenes[state.activeSceneId].hotSpots.length"
```

### Adding a hotspot (programmatic — faster for testing)

```bash
playwright-cli eval "
  state.capturedCoords = { pitch: -10.5, yaw: 45.2 };
  // Then call addHotspot to open modal...
"
# Or bypass entirely:
playwright-cli eval "
  state.scenes[state.activeSceneId].hotSpots.push({
    pitch: -10.5, yaw: 45.2, type: 'scene',
    text: 'Go to museum', sceneId: 'scene_other'
  });
  loadSceneIntoViewport(state.activeSceneId);
"
```

### Editing a hotspot

```bash
# Find hotspot index
playwright-cli eval "state.scenes[state.activeSceneId].hotSpots.length"

# Edit via JS (bypasses modal)
playwright-cli eval "
  const hs = state.scenes[state.activeSceneId].hotSpots[0];
  hs.text = 'Updated text';
  hs.yaw = 90;
  loadSceneIntoViewport(state.activeSceneId);
"
```

### Deleting a hotspot

```bash
playwright-cli eval "deleteHotspot(state.activeSceneId, 0)"
```

### "Show All" cycle

```bash
playwright-cli click e33   # "👁 Show All" button
# Each click cycles to next hotspot. After last, wraps to first.
```

---

## Import / Export / Preview

### Import from wiki page

```bash
# Click Import
playwright-cli click e5

# Enter wiki page title
playwright-cli fill e72 "User:Fuzheado/Panellum_Tour"

# Confirm
playwright-cli click e73

# Wait for loading, then check
playwright-cli eval "state.sceneOrder.length"
playwright-cli eval "Object.keys(state.scenes)"
```

### Import from JSON

```bash
playwright-cli click e5
playwright-cli fill e72 '{"default":{"firstScene":"s1"},"scenes":{"s1":{"panorama":"File:Test.jpg","hotSpots":[]}}}'
playwright-cli click e73
```

### Export and verify

```bash
playwright-cli click e6     # Open export modal
playwright-cli eval "JSON.parse(document.getElementById('modal-export-text').value)"
```

### Preview in new tab

```bash
# The studio writes to localStorage then opens a new tab
playwright-cli click e7     # Preview button

# New tab opens — list tabs
playwright-cli tab-list
playwright-cli tab-select 1   # if viewer opened in tab 1

# Check the preview data was stored
playwright-cli -s=studio eval "localStorage.getItem('photosphere-preview-tour')"
```

---

## Tour Viewer Debugging

### Loading from wiki

```bash
playwright-cli open "http://localhost:8765/tour_viewer.html#User:Fuzheado/Panellum_Tour"
playwright-cli console
playwright-cli requests
playwright-cli snapshot
```

### Loading preview from studio

```bash
# In studio, set preview data then open viewer with hash
playwright-cli eval "localStorage.setItem('photosphere-preview-tour', JSON.stringify({...}))"
playwright-cli goto "http://localhost:8765/tour_viewer.html#preview=local"
playwright-cli console
```

### Verifying Wikipedia info cards

Hover over info-type hotspots to trigger the Wikipedia API card:

```bash
# Trigger hover on a hotspot
playwright-cli hover e22    # if hotspot is a DOM element
# OR use eval to check the card data:
playwright-cli eval "document.querySelector('.pnlm-hotspot-card')?.textContent"
```

---

## Network & API Debugging

### Monitor API calls

```bash
# See all network requests (live after opening page)
playwright-cli requests

# Filter by type
playwright-cli requests XHR
playwright-cli requests JS
playwright-cli requests Image
```

### Common API endpoints to watch

| Endpoint | Purpose | Expected Status |
|---|---|---|
| `/api/tour?page=...` | Fetch and parse tour from wiki | 200 |
| `/api/resolve?file=...` | Resolve single Commons file | 200 or 404 |
| `/api/resolve-url?url=...` | Cache and proxy a direct URL | 200 |
| `/api/preview` (POST) | Store tour for preview | 200 with `{key}` |
| `/api/preview/:key` (GET) | Retrieve stored preview | 200 or 404 |
| `https://upload.wikimedia.org/...` | Commons image downloads | 200 or 404 |
| `https://en.wikipedia.org/api/rest_v1/page/summary/...` | Info card data | 200 or 404 |

### Testing endpoints directly

```bash
# Test image resolution from bash
curl -s "http://localhost:8765/api/resolve?file=Tallinn_Aerial_360.jpg" | jq .

# Test tour fetch
curl -s "http://localhost:8765/api/tour?page=User:Fuzheado/Panellum_Tour" | jq '.scenes | keys'
```

### Image caching

Resolved images are cached in `prototype/cache/` as JSON metadata and in `prototype/images/` as actual files:

```bash
ls prototype/images/      # cached Commons images (hash-based names)
ls prototype/cache/       # API response cache (base64-encoded keys)
```

To clear cache and force re-download:
```bash
rm -rf prototype/cache/* prototype/images/*
```

---

## Visual Review

When you need **human judgment** on visual rendering (hotspot icon placement, color, layout):

```bash
# Open the studio in a Playwright session
playwright-cli open http://localhost:8765/studio.html

# Launch the screen-share annotation tool
playwright-cli show --annotate
```

This opens a live screencast in Pi's UI. The user can:
- Draw bounding boxes around issues
- Type comments about what's wrong
- Scroll and interact naturally

You receive: annotated screenshot, snapshot of marked region, and notes.

Use this for questions like:
- "Does this hotspot icon look right at this position?"
- "The export JSON button should be blue, is it?"
- "Is the scene thumbnail loading correctly in the list?"

---

## Recording Bug Sessions

For bugs that are hard to reproduce or need sharing:

```bash
# Start recording
playwright-cli video-start bug-hotspot-overlap.webm

# Reproduce the steps
playwright-cli click e12
playwright-cli fill e44 "File:Test_360.jpg"
playwright-cli click e51

# Mark a chapter
playwright-cli video-chapter "Scene added" --duration=2000

# Continue...
playwright-cli mousemove 500 300
playwright-cli mousedown
playwright-cli video-chapter "Hotspot placed" --duration=3000

# Stop
playwright-cli video-stop
```

### Full trace (for JS errors, timing issues)

```bash
playwright-cli tracing-start
playwright-cli click e5
playwright-cli fill e44 "File:Missing.jpg"
playwright-cli click e51
playwright-cli tracing-stop
# Trace file contains full timeline with source maps, timing, network
```

---

## Troubleshooting

### "Viewer not loading" or blank viewport

```bash
# 1. Check console for errors
playwright-cli console error

# 2. Check if Pannellum initialized
playwright-cli eval "!!state.pannellumViewer"

# 3. Check the panorama URL that was resolved
playwright-cli eval "state.scenes[state.activeSceneId].panorama"
playwright-cli eval "state.scenes[state.activeSceneId]._thumb"
playwright-cli eval "state.scenes[state.activeSceneId]._original"

# 4. If panorama is still a File: ref, resolution failed
#    Test the endpoint directly:
curl -s "http://localhost:8765/api/resolve?file=Your_File.jpg"

# 5. Check if image was cached locally
ls prototype/images/ | grep <hash>
```

### "Hotspot won't place" or coordinates not captured

```bash
# Check if coordinates were captured
playwright-cli eval "state.capturedCoords"

# Check if the capture button appeared
playwright-cli snapshot | grep "Place Hotspot"

# If not, the mousedown handler didn't fire
# — try clicking at a different position in the viewport
playwright-cli mousemove 600 400
playwright-cli mousedown
playwright-cli eval "state.capturedCoords"
```

### Scene list not updating

```bash
# Check the data model directly
playwright-cli eval "state.sceneOrder.length"
playwright-cli eval "Object.keys(state.scenes).length"

# Force re-render
playwright-cli eval "renderSceneList()"
```

### Preview not working

```bash
# Check if localStorage was set
playwright-cli eval "localStorage.getItem('photosphere-preview-tour')"

# Open viewer manually
playwright-cli goto "http://localhost:8765/tour_viewer.html#preview=local"

# Check console for errors
playwright-cli console error
```

### Modal stuck open

```bash
# Force close
playwright-cli press Escape

# Or from JS
playwright-cli eval "modalHide('modal-add-hs')"
```

---

## Script Automation

For complex or repeated debugging tasks, write a Playwright script and run it with `run-code`:

```javascript
// scripts/debug-scenes.js
// Run: playwright-cli run-code scripts/debug-scenes.js

// Check scene state in detail
const dump = await page.evaluate(() => {
  const scenes = state.sceneOrder.map(id => ({
    id,
    title: state.scenes[id].title,
    hasViewer: !!state.pannellumViewer,
    viewportLoaded: state.pannellumViewer?.isLoaded,
    hotspotCount: (state.scenes[id].hotSpots || []).length,
    hotspots: state.scenes[id].hotSpots.map((h, i) => ({
      index: i,
      text: h.text,
      type: h.type,
      yaw: h.yaw.toFixed(2),
      pitch: h.pitch.toFixed(2),
      target: h.sceneId || h.URL?.substring(0, 40)
    }))
  }));
  return scenes;
});

console.log(JSON.stringify(dump, null, 2));
await page.screenshot({ path: 'scene-debug.png', fullPage: true });
```

```javascript
// scripts/simulate-hotspot.js
// Quickly place a scene-link hotspot without modal interaction
const hs = {
  pitch: -10,
  yaw: 45,
  type: 'scene',
  text: 'Quick test hotspot',
  sceneId: sceneId,  // set this
};
await page.evaluate(({ hs, sceneId }) => {
  state.scenes[sceneId].hotSpots.push(hs);
  loadSceneIntoViewport(sceneId);
}, { hs, sceneId });

// Verify
const count = await page.evaluate(() => 
  state.scenes[state.activeSceneId].hotSpots.length
);
console.log(`Hotspots after insert: ${count}`);
```

### Full automation: create a 2-scene tour

```javascript
// scripts/create-demo-tour.js
await page.evaluate(() => {
  // Scene 1
  addScene('File:Scene1_360.jpg', 'Entrance');
  
  // Scene 2
  addScene('File:Scene2_360.jpg', 'Main Hall');
  
  // Switch to scene 1
  selectScene(state.sceneOrder[0]);
  
  // Add a scene-link hotspot pointing to scene 2
  state.capturedCoords = { pitch: -5, yaw: 30 };
  state.scenes[state.activeSceneId].hotSpots.push({
    pitch: -5, yaw: 30, type: 'scene',
    text: 'Enter Main Hall',
    sceneId: state.sceneOrder[1]
  });
  loadSceneIntoViewport(state.activeSceneId);
});

const report = await page.evaluate(() => ({
  sceneCount: state.sceneOrder.length,
  titles: state.sceneOrder.map(id => state.scenes[id].title),
  hotspots: state.sceneOrder.map(id => ({
    scene: state.scenes[id].title,
    count: (state.scenes[id].hotSpots || []).length
  }))
}));
console.log(JSON.stringify(report, null, 2));
```

---

## Pattern Summary

| What you need | How to get it |
|---|---|
| See the page | `screenshot` |
| Find a button | `snapshot`, look for `[ref=eN]` |
| Click something | `click eN` |
| Fill a form | `fill eN "value"` |
| Check for errors | `console` (check after every action) |
| Check network | `requests` |
| Inspect JS state | `eval "state.something"` |
| Click 360° viewport | `mousemove` + `mousedown` |
| Place hotspot programmatically | `eval "state.scenes[...].hotSpots.push(...)"` |
| Verify scene loaded | `eval "state.pannellumViewer.isLoaded"` |
| Navigate to scene | `eval "selectScene('scene_id')"` |
| Show live to user | `show --annotate` |
| Record bug | `video-start` + `video-stop` |
| Trace timeline | `tracing-start` + `tracing-stop` |
