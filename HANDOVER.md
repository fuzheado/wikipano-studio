# Handover Document - Wikimedia Photosphere Tours

**Date**: 2026-06-17 (updated)
**Session**: Phase 2 bug fixes (export scope, panorama paths, yaw normalization), Pannellum JSON Schema validator

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
- Pannellum-based 360° viewer with scene sidebar
- Loads tours from wiki pages: `#User:Fuzheado/Panellum_Tour`
- Loads previews from localStorage: `#preview=local`
- Wikipedia rich info cards on hotspot hover (fetches lead image + extract from REST API)
- Handles TOML + JSON formats via server API

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
- Red ➤ icons for scene links, blue i for info hotspots (pulsing, glowing)

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
- Custom hotspot icons via `cssClass` in studio
- Tour discovery: category system, featured tours
- Multilingual support
