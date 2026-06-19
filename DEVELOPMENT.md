# Development Log: Wikimedia Photosphere Tours

## What We've Built

### Phase 1 Prototype (COMPLETE ✅)

A working end-to-end system that enables collaborative, wiki-based 360° photosphere tour authoring:

```
Wiki Page (TOML/JSON) ──→ tour_server.mjs ──→ Pannellum Viewer
                              │
                              ├── Fetches tour definition from Commons wiki
                              ├── Auto-detects TOML or JSON format
                              ├── Resolves File: references via Commons API
                              ├── Downloads & caches images locally (avoids CORS)
                              └── Returns Pannellum-compatible tour config
```

### Phase 2 Visual Studio (COMPLETE ✅)

A Kuula-like visual editor for creating photosphere tours:

- **360° viewport** with click-to-capture hotspot coordinates (`mouseEventToCoords`)
- **Yaw normalization**: coordinates auto-normalized to [-180, 180] per Pannellum JSON Schema, applied at capture time, on export, and on preview
- **Scene management**: add/delete/reorder scenes from Commons `File:` refs or URLs
- **Hotspot editor**: info hotspots (URL + tooltip) and scene links, with edit-in-place
- **Import**: load existing tours from wiki pages (`?page=` param) or paste JSON
- **Export**: download JSON or copy to clipboard, with scope selector (Entire project / Current scene only)
- **Export path resolution**: panorama fields use original Commons URLs (`_original`) instead of cached `/images/` paths
- **Preview**: localStorage-based preview (no server dependency)
- **Thumbnails**: Commons 200px thumbnail images in scene list
- **Modals**: dismissable (× button, click-outside, Escape key)
- **JSON Validator**: `node scripts/validate-pannellum.mjs <file.json> [--fix]` — validates against official Pannellum JSON Schema, detects yaw range violations, URL encoding issues, and cross-references sceneId links

### Wikipedia Rich Info Cards (COMPLETE ✅)

Hotspots linking to Wikipedia articles automatically display rich tooltips:
- Fetches article summary via `en.wikipedia.org/api/rest_v1/page/summary/`
- Shows: lead image, article title, first paragraph (truncated to 300 chars)
- "Read on Wikipedia →" link
- Graceful fallback if API fails (title + link)
- Auto-detects Wikipedia URLs (`/wiki/`, `qrwp.org/`)

### Files

```
photospheres/
├── RESEARCH_REPORT.md          # Library landscape analysis & architecture proposal
├── PRD.md                      # Phase 1 product requirements & test plan
├── DEVELOPMENT.md              # This file — what's been built (log)
├── FEATURE_REQUESTS.md         # Backlog of planned features
├── DEPLOYMENT.md               # Step-by-step Toolforge + Commons template deployment guide
├── CAVEATS.md                  # Gotchas & debugging lessons
├── DEBUGGING.md                # Visual debugging with playwright-cli
├── HANDOVER.md                 # Session log + current-state quick reference
├── README.md                   # Project overview
├── PROMPT.txt                  # Original research prompt
├── adr/                        # Architecture Decision Records
│   ├── README.md               # ADR index & template
│   ├── 001-use-pannellum-for-phase-1.md
│   ├── 002-wiki-page-as-tour-definition.md
│   ├── 003-image-caching-via-hash-paths.md
│   ├── 004-dual-toml-json-format-support.md
│   ├── 005-nodejs-prototype-server.md
│   ├── 006-toml-json-yaml-format-decision.md
│   └── 007-hotspot-icon-visibility-postmortem.md
├── scripts/
│   ├── validate-pannellum.mjs  # JSON Schema validator + auto-fix
│   ├── dump-state.js           # Playwright state introspection
│   └── create-panotour-templates.py  # Pywikibot script for template creation
├── tests/
│   ├── tour-viewer.spec.js       # Tour viewer URL params, scene nav, status, state
│   ├── studio-behaviors.spec.js  # Studio interaction behavior tests
│   └── mobile-gyro.spec.js       # Mobile gyroscope toggle tests
└── prototype/
    ├── tour_server.mjs          # Node.js server (zero deps): API + static files + image cache
    ├── tour_viewer.html         # Pannellum viewer with scene sidebar + Wikipedia cards
    ├── studio.html              # Visual tour editor
    ├── studio.js                # Editor logic
    ├── tour_config.php          # Standalone PHP equivalent (reference only, not deployed)
    ├── sample_tour.json         # Example tour definition
    ├── HOW_TO_CREATE_A_TOUR.txt # Tutorial for wiki-based tour authoring
    └── README.md                # Setup & usage docs
```

### Key Technical Decisions

| Decision | Rationale | ADR |
|---|---|---|
| Pannellum for Phase 1 | Already deployed on Toolforge, existing Commons integration | ADR-001 |
| Wiki pages as tour storage | Zero new infrastructure, full wiki collaboration | ADR-002 |
| Hash-based image cache paths | Avoids CORS, URL-encoding issues with proxy URLs | ADR-003 |
| Dual TOML + JSON format support | JSON canonical, TOML for hand-editing, YAML excluded | ADR-004, ADR-006 |
| Node.js prototype server | No deps, rapid iteration; deploys directly to Toolforge | ADR-005 |
| localStorage for preview | No server dependency, reliable cross-tab data transfer | ADR-005 |
| Wikipedia REST API for rich cards | Auto-fetches lead image, title, extract on hotspot hover | — |

### Verified Working

- Tour API fetches wiki page, auto-detects format, parses, resolves files
- **Multi-wiki support**: `prefix:Page` format (e.g., `en:Wikipedia_tour`), default `commons:`
- Image caching downloads Commons images, serves from local `/images/` directory
- Pannellum renders tours with clickable scene hotspots and info hotspots
- Sidebar shows scene list, author info, link to source wiki page
- Error handling for missing pages, invalid JSON/TOML, missing files

---

## Development Path

### Phase 1: Core Viewer (DONE ✅)
- [x] Research report
- [x] PRD
- [x] TOML + JSON parser with auto-detection (ADR-006)
- [x] Commons image resolution & caching
- [x] Pannellum tour viewer with scene sidebar
- [x] ADRs for all key decisions

### Phase 2: Visual Studio (DONE ✅)
- [x] 360° viewport with click-to-capture coordinates
- [x] Scene management (add/delete/reorder)
- [x] Hotspot editor (info + scene link, add/edit/delete)
- [x] Import from wiki pages (`?page=` param) or paste JSON
- [x] Export as JSON (download or copy to clipboard)
- [x] Export scope selector: Entire project / Current scene only (instant radio toggle)
- [x] Export panorama path fix: uses original Commons URLs, not cached `/images/` paths
- [x] Yaw auto-normalization to [-180, 180] at capture, export, and preview
- [x] Preview via localStorage (cross-tab, no server dependency)
- [x] Commons 200px thumbnails in scene list
- [x] Wikipedia rich info cards (auto-fetch lead image + extract)
- [x] Modals with dismiss (× button, click-outside, Escape)
- [x] Pannellum JSON Schema validator (`scripts/validate-pannellum.mjs`) with `--fix` support
- [x] Server `/api/resolve-url` flat response fix (was nested `{url: {url:...}}`)
- [x] SC-2.0: Viewport stability — no editing operation resets the view (add/edit/delete hotspots)
- [x] SC-2.1: Hotspot click in viewport → edit modal (no viewport reset)
- [x] SC-2.2: Hotspot card list — click to view, not hover (was hover-to-warp)
- [x] Playwright test suite for SC-2.1 and SC-2.2 (`tests/studio-behaviors.spec.js`)
- [x] Audio hotspot type (🎵) — custom subtype pattern with Commons audio playback in viewer
- [x] `?scene=` URL parameter — direct-link to a scene for editing; URL stays in sync via replaceState
- [x] SC-2.3: Canonical media references — all stored as direct URLs, never `File:` references
- [x] Video hotspot (🎬) — popup overlay player supporting Commons files and YouTube embeds
- [x] Info popup click-to-toggle — hidden by default, click to show/dismiss, × button, Show All toggle
- [x] `&open=0,2` URL parameter — auto-open info popups at specified hotspot indices
- [x] Scene hotspot icon fix — force .pnlm-render-container .pnlm-scene to visible (Pannellum 2.5.7 quirk)
- [x] Integrity checks at all data boundaries — validateHotspot() + validateTour() at add/edit/import/export/preview
- [x] 5-step rule for new hotspot fields: storage, import, export, preview, validation
- [x] CAVEATS.md — 15 gotchas (transform, paths, yaw, container hunting, enrichHotspots, DOM order, ...)
- [x] **Mobile gyroscope toggle** (🧭 button using Pannellum's startOrientation() API)
- [x] iOS 13+ permission prompt handling via DeviceOrientationEvent.requestPermission()
- [x] Hotspot icon size variants (`iconStyle`: normal, small, large, huge)
- [x] Icon consistency — Studio and Viewer use identical CSS for all hotspot types
- [x] DEPLOYMENT.md — step-by-step Toolforge deployment guide
- [x] **Tour Viewer `?page=` + `?scene=` URL parameters** — same params as Studio; hash-based routing preserved
- [x] **Tour Viewer test suite** (`tests/tour-viewer.spec.js`) — 15 tests covering URL params, scene nav, sidebar, status, viewer state

### Phase 2.5: New Toolforge Tool Deployment ✅ (2026-06-18)
**Goal**: Deploy prototype as a brand new Toolforge tool named **`wikipano`**. Toolforge's native Node.js backend runs `tour_server.mjs` directly — no PHP porting needed.

- [x] Tool created: `toolforge tools create wikipano`
- [x] Prototype deployed to `/data/project/wikipano/www/js/` via rsync
- [x] Web service started: `webservice --backend=kubernetes node20 start`
- [x] `{{PanoTour}}` template — instructions in `DEPLOYMENT.md` (manual creation on Commons needed)
- [x] Mobile gyroscope toggle (🧭 button) — deployed and working on HTTPS
- [x] Tour Viewer live at: https://wikipano.toolforge.org/tour_viewer.html
- [x] Visual Studio live at: https://wikipano.toolforge.org/studio.html
- [x] API live at: https://wikipano.toolforge.org/api/tour?page=User:Fuzheado/Panellum_Tour
- [ ] Handle multires tiling for large tour images (reuse existing pipeline)
- [ ] OAuth-authenticated save-to-wiki from Studio
- [ ] Documentation: how to create, edit, and share a tour

### Phase 2.6: Scope & Compliance (2026-06-18)
**Goal**: Multi-wiki support + Wikimedia content restrictions

- [x] **FR-01: Multi-wiki tour loading** — `prefix:Page` format (e.g., `en:Wikipedia_tour`), default `commons:`
- [ ] FR-02: Audio/video source restriction (Commons only + `ALLOW_ALL_SOURCES` flag)
- [ ] FR-03: Panorama source validation (Commons only)
- [ ] FR-04: Info hotspot external link warning (visual indicator)
- [ ] FR-05: Export validation (compliance rules)

### Phase 3: Rich Features & Migration
**Goal**: Production-grade experience matching commercial tools

- [ ] Evaluate Photo-Sphere-Viewer migration for richer plugin ecosystem
- [ ] GPS-based automatic link placement from EXIF data
- [ ] Map/Plan integration (OpenStreetMap tour overview)
- [ ] Gallery plugin (thumbnail strip navigation)
- [ ] Floor plan overlays
- [ ] Multilingual support for Commons internationalization
- [ ] Tour discovery: category, search, "featured tour" system
- [ ] Custom hotspot icons via `cssClass` in editor

---

## Running

### Live (Toolforge)
- **Tour Viewer**: https://wikipano.toolforge.org/tour_viewer.html#User:Fuzheado/Panellum_Tour
- **Tour Viewer (query string)**: https://wikipano.toolforge.org/tour_viewer.html?page=User:Fuzheado/Panellum_Tour&scene=Museum
- **Visual Studio**: https://wikipano.toolforge.org/studio.html?page=User:Fuzheado/Panellum_Tour

### Local Development
```bash
cd prototype
node tour_server.mjs
# Open http://localhost:8765/tour_viewer.html
```

The demo auto-loads the Banned Books Museum ↔ Tallinn road tour from `User:Fuzheado/Panellum_Tour` on Commons.

## Creating a New Tour

See `prototype/HOW_TO_CREATE_A_TOUR.txt` for TOML and JSON format templates.

Quick start:
1. Upload 360° photos to Commons
2. Create a wiki page at `User:YourName/YourTour`
3. Paste the TOML or JSON tour definition
4. View at `http://localhost:8765/tour_viewer.html#User:YourName/YourTour`
