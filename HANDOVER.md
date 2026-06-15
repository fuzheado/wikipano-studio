# Handover Document — Wikimedia Photosphere Tours

**Date**: 2026-06-15
**Session**: Phase 1 + 2 complete, ready for Phase 2.5 (Toolforge deployment)

---

## Quick Start (Next Session)

```bash
cd /Users/alih/Documents/ai/photospheres/prototype
node tour_server.mjs
# Open http://localhost:8765/studio.html
# Demo: http://localhost:8765/studio.html?page=User:Fuzheado/Panellum_Tour
```

Do NOT run `rm -rf cache images` on startup — that wipes cached Commons images and breaks previews. The images cache is now managed with 1-hour TTL.

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
- Export as JSON (download or copy)
- Preview via localStorage (no server dependency)
- Cycle hotspots with "Show All" button
- Hover hotspot cards → viewport pans to face them
- Red ➤ icons for scene links, blue ⓘ for info hotspots (pulsing, glowing)

### Server (`tour_server.mjs`)
- Zero external dependencies (Node.js built-ins only)
- Endpoints:
  - `GET /api/tour?page=...` — fetch + parse + resolve tour from Commons wiki
  - `GET /api/resolve?file=...` — resolve Commons File: → cached image path
  - `GET /api/resolve-url?url=...` — cache + resolve direct URL
  - `POST /api/preview` / `GET /api/preview/:key` — server-side preview storage
  - Static files: `tour_viewer.html`, `studio.html`, cached images at `/images/`
- TOML parser (subset: sections, arrays of tables, strings, numbers, booleans)
- Commons image download + SHA-256 hash caching with 1-hour TTL
- Commons thumbnail URL generation (200px for scene list)

### PHP Reference (`tour_config.php`)
- Equivalent logic for future Toolforge deployment
- Not currently used (Node.js server handles everything)

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
└── prototype/
    ├── tour_server.mjs       # Server (the main entry point)
    ├── tour_viewer.html      # End-user viewer
    ├── studio.html           # Visual editor UI
    ├── studio.js             # Editor logic (~650 lines)
    ├── tour_config.php       # PHP reference
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
| 005 | Node.js prototype, PHP for Toolforge | No deps for rapid dev; PHP matches production |
| 006 | JSON canonical, TOML supported, YAML excluded | TOML is valid (tested against tomllib), YAML too fragile for wiki |
| 007 | Hotspot icon visibility postmortem | Pannellum sprite override, solid colors, glow, pulsing |

---

## Known Issues & Gotchas

1. **Don't clear cache on restart** — `rm -rf cache images` breaks active previews and forces re-download of 7MB images
2. **TOML parser is a subset** — handles sections, arrays of tables, basic types. Doesn't support inline tables or multiline strings
3. **`File:` references in studio** — resolved server-side on save, not live in the viewport. The studio shows the pre-resolution path
4. **Headless Chrome `readPixels`** — returns black because Pannellum doesn't set `preserveDrawingBuffer: true`. This is normal; use DOM inspection instead of pixel reading for tests
5. **`window.open()` in tests** — Playwright opens tabs in a shared context; localStorage IS shared but sessionStorage may not be
6. **Pannellum inline styles** — use `!important` + combined selectors (`.my-class.pnlm-sprite`) to override default hotspot appearance

---

## Next Steps (Phase 2.5: Toolforge Deployment)

1. **Port to PHP** — adapt `tour_config.php` logic into the panoviewer codebase at https://github.com/toollabs/panoviewer
2. **Create `{{PanoTour}}` template** on Commons — generates links to the viewer
3. **Handle multires tiling** — reuse panoviewer's existing `generate.py` pipeline for large tour images
4. **OAuth save-to-wiki** — add authenticated save from Studio back to Commons wiki pages
5. **Deploy viewer + studio** to `panoviewer.toolforge.org` or a new tool

## Future (Phase 3)

- Evaluate Photo-Sphere-Viewer migration for GPS, maps, gallery plugins
- Custom hotspot icons via `cssClass` in studio
- Tour discovery: category system, featured tours
- Multilingual support
