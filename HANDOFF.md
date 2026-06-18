# Handoff — Photosphere Tours (2026-06-18, final)

## Quick Start

```bash
cd /Users/alih/Documents/ai/photospheres/prototype
node tour_server.mjs
# Studio: http://localhost:8765/studio.html?page=User:Fuzheado/Panellum_Tour.json&scene=Museum
# Viewer: http://localhost:8765/tour_viewer.html
```

## Current State

| Feature | Status | Notes |
|---|---|---|
| Scene link navigation | ✅ | Click navigates. Icon invisible (see below) |
| Info click-to-toggle | ✅ | Click icon → popup. Click again or × → dismiss |
| 👁 Show all / Hide all | ✅ | Toggle button in viewer footer |
| `&open=0,2` URL param | ✅ | Auto-opens info popups at indices |
| Audio 🎵 | ✅ | Green icon visible, playback works |
| Video icon (purple ▶️) | ✅ | CSS renders correctly |
| Video playback | ✅ | Click overlay opens |
| Video URL in export | ✅ | FIXED — was missing `if (hs.videoUrl) h.videoUrl = hs.videoUrl` in `exportTour()` |
| Validation warnings | ✅ | `validateTour()` checks missing audioUrl/videoUrl/sceneId before export/preview |
| Export (all/current scene) | ✅ | Radio buttons, uses _original Commons URLs |
| Yaw normalization | ✅ | [-180, 180] at capture/export/preview |
| Viewport preservation | ✅ | No reset on add/edit/delete |
| `?scene=` URL param | ✅ | Direct-link, URL stays in sync |
| JSON validator | ✅ | `node scripts/validate-pannellum.mjs <file> [--fix]` |

## Remaining Issue: Scene Hotspot Icon Invisible

**Symptom**: Scene link icons don't render in the 360° viewport. Clicking the area DOES navigate.

**Root cause found**: Pannellum 2.5.7 hotspot sprite icons require a CHILD element:
```css
.pnlm-hotspot.pnlm-scene   { background-position: 0 -130px; }  /* ← scene arrow icon */
.pnlm-hotspot.pnlm-info    { background-position: 0 -104px; }  /* ← info "i" icon */
```

These classes go on a child `.pnlm-hotspot` div inside `.pnlm-hotspot-base`. Scene hotspots in 2.5.7 have NO children — Pannellum doesn't create the `.pnlm-hotspot.pnlm-scene` element. Info hotspots DO get a child (`.pnlm-hotspot.pnlm-undefined` — the `pnlm-undefined` class confirms Pannellum reads `type` as `undefined` during rendering).

Additionally, the base div has `visibility: hidden` by default and Pannellum must set it to `visible` via JS.

**To fix**: Investigate why Pannellum 2.5.7 doesn't create child `.pnlm-hotspot` elements for scene hotspots. May be a 2.5.7 tour-mode regression. Options:
- Check Pannellum 2.5.7 source for `Hotspot` creation in tour mode
- Compare with Pannellum 2.5.5/2.5.6 behavior
- Try downgrading CDN to `pannellum@2.5.5` to see if scene icons render
- Force-create the child element via `createTooltipFunc`: `div.innerHTML = '<div class="pnlm-hotspot pnlm-scene pnlm-sprite"></div>'`

## Warning: Wiki Page Has Stale Video Hotspot

The test file `User:Fuzheado/Panellum_Tour.json` on Commons has a video hotspot WITHOUT `videoUrl`:
```json
{"pitch":-12.63, "yaw":108.09, "type":"info", "text":"Video", "hotspotSubtype":"video"}
// ← no "videoUrl" — added before the export fix was applied
```

**Fix**: Delete this hotspot from the wiki, add it again via the studio (which now correctly exports `videoUrl`), and re-export.

## Key Files

| File | What |
|---|---|
| `prototype/tour_viewer.html` | Viewer CSS + JS. `enrichHotspots()` tags hotspot types |
| `prototype/studio.js` | Editor. `confirmAddHotspot()` handles video/audio/export |
| `prototype/studio.html` | Editor CSS. Hotspot icons in viewport |
| `scripts/validate-pannellum.mjs` | JSON validator |
| `CAVEATS.md` | 14-section gotchas reference |
| `HANDOVER.md` | Previous session log |
| `PRD.md` | Product requirements + test cases |
| `DEVELOPMENT.md` | Build status + roadmap |

## Pannellum 2.5.7 Hotspot DOM

| Type | Base div classes | Child element | Icon via |
|---|---|---|---|
| Scene | `pnlm-hotspot-base scene-hotspot pnlm-pointer pnlm-tooltip` | **None** (bug) | `.pnlm-hotspot.pnlm-scene` child (missing) |
| Info | `pnlm-hotspot-base pnlm-hotspot pnlm-sprite pnlm-undefined pnlm-pointer` | `.pnlm-hotspot.pnlm-sprite` | CSS sprite background-position |

CSS from `pannellum.css`:
```css
.pnlm-hotspot-base { position:absolute; visibility:hidden; top:0; z-index:1; }
.pnlm-hotspot { height:26px; width:26px; border-radius:13px; }
.pnlm-hotspot.pnlm-scene { background-position: 0 -130px; }
.pnlm-hotspot.pnlm-info  { background-position: 0 -104px; }
```

## Playwright Debug Commands

```bash
playwright-cli open
playwright-cli goto http://localhost:8765/tour_viewer.html

# Load tour
playwright-cli eval "document.getElementById('tourInput').value='User:Fuzheado/Panellum_Tour.json'; document.getElementById('loadBtn').click(); 'ok'"
sleep 4

# Check scene hotspot children
playwright-cli eval "var sh=document.querySelector('.scene-hotspot'); 'children:'+sh.children.length+' visible:'+getComputedStyle(sh).visibility"

# Check all hotspot classes
playwright-cli eval "Array.from(document.querySelectorAll('.pnlm-hotspot-base')).map(function(e,i){return i+':'+e.className+' children:'+e.children.length}).join('|')"

# Check for pnlm-scene elements
playwright-cli eval "document.querySelectorAll('.pnlm-scene').length + ' pnlm-scene elements'"

# Force-create scene icon for testing
playwright-cli eval "var sh=document.querySelector('.scene-hotspot'); var icon=document.createElement('div'); icon.className='pnlm-hotspot pnlm-scene pnlm-sprite'; sh.appendChild(icon); 'added'"
```
