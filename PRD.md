# PRD: Wikimedia 360° Photosphere Tours — Phase 1 Prototype

**Version**: 1.0
**Date**: 2026-06-17
**Status**: Draft

> **Deployment note (2026-06-17)**: Production deploys as a **new Toolforge tool** (`wikipano.toolforge.org`), not as an extension of the existing `panoviewer.toolforge.org`. Toolforge's native Node.js backend (`webservice --backend=kubernetes node`) runs `tour_server.mjs` directly — no PHP porting required.

---

## 1. Overview

### 1.1 Problem Statement

Wikimedia Commons hosts thousands of 360° equirectangular photos, but there is no way to link them together into interactive walkthrough tours. Currently, each photo can only be viewed individually via the `{{Pano360}}` template → `panoviewer.toolforge.org` pipeline. Users who want to create a virtual tour (e.g., through a museum, a historic site, or a city neighborhood) must use proprietary commercial tools like Kuula or Matterport.

**This project**: A new tool (deployed independently on Toolforge) lets Wikimedians define tours as wiki pages and view them in a Pannellum-based viewer with hotspot navigation.

### 1.2 Phase 1 Goal

Enable Wikimedians to **collaboratively define 360° photosphere tours** by storing a tour definition as a JSON page on wiki, and viewing it through a dedicated Pannellum-based viewer deployed on Toolforge.

### 1.3 Success Criteria

1. A user can create a wiki page containing a Pannellum-compatible tour JSON definition
2. Visiting `https://wikipano.toolforge.org/#User:Example/MyTour` (or `#tour=User:Example/MyTour`) renders the tour in the Pannellum viewer
3. Users can click hotspots to navigate between scenes with fade transitions
4. Info hotspots display tooltip text and link to external URLs
5. The prototype handles at least 2 scenes with bidirectional links

### 1.4 Phase 2 Success Criteria (Studio Behaviors)

#### SC-2.1: Hotspot Click → Edit Modal (No Viewport Reset)
When editing a tour in the Studio, clicking a hotspot node in the 360° viewport opens the edit modal **without** navigating away from or resetting the current view. The viewport stays at exactly the same position (pitch, yaw, hfov) where the user clicked.

**Rationale**: The edit modal should be a non-destructive overlay. Navigating away and reloading the scene would disrupt the editing workflow and be visually jarring.

**Verification**: Click a hotspot node → modal opens → close modal → viewport still at same position.

#### SC-2.2: Hotspot Card List — Click to View, Not Hover
In the Studio's right-panel hotspot list:
- **Hovering** a hotspot card does NOT move the viewport
- **Clicking** a hotspot card smoothly pans (not jumps) the viewport to face that hotspot
- **Clicking** the ✎ (pencil) icon opens the edit modal for that hotspot without moving the viewport
- **Clicking** the × (delete) icon deletes the hotspot without moving the viewport

**Rationale**: Hover-triggered viewport movement is distracting and makes it hard to scan the list. Users should intentionally click to inspect a hotspot's location. Edit/delete actions should not cause unintended viewport movement.

### 1.5 Non-Goals (Deferred to Phase 2+)

- OAuth-authenticated save-back to wiki
- GPS-based automatic link placement
- Gallery/map/plan overlays
- Multires tiling for tour scenes (use direct Commons URLs for prototyping)
- Mobile-optimized editor
- Validation of 2:1 ratio or GPano metadata

---

## 2. Architecture

### 2.1 System Diagram

```
┌──────────────────────────────────────────────────────┐
│  Wikimedia Commons Wiki                               │
│  Page: User:Fuzheado/Panellum_Tour                   │
│  Content: JSON/TOML tour definition                  │
│  Fetched via: action=raw                              │
└──────────────────────┬───────────────────────────────┘
                       │ HTTP GET
                       ▼
┌──────────────────────────────────────────────────────┐
│  wikipano.toolforge.org (new Toolforge tool)          │
│  Node.js server: tour_server.mjs                      │
│  GET /api/tour?page=User:Fuzheado/Panellum_Tour       │
│  ┌──────────────────────────────────────────────────┐ │
│  │ 1. Detect 'page' / 'tour' query param            │ │
│  │ 2. Fetch page from Commons API (action=raw)      │ │
│  │ 3. Parse JSON or TOML, validate structure        │ │
│  │ 4. Resolve File: → cached Commons image          │ │
│  │ 5. Return Pannellum-compatible tour JSON         │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────┬───────────────────────────────┘
                       │ JSON response
                       ▼
┌──────────────────────────────────────────────────────┐
│  Browser: Pannellum viewer                            │
│  tour_viewer.html (standalone, served by Node.js)     │
│  Renders tour with scenes, hotspots, transitions      │
└──────────────────────────────────────────────────────┘
```

### 2.2 Component Changes

#### 2.2.1 New: `tour_server.mjs` — Node.js Server

The Node.js server handles all backend logic:

```
GET /api/tour?page=User:Fuzheado/Panellum_Tour
  → fetch wiki page, parse JSON/TOML, resolve File: refs, return tour JSON

GET /api/resolve?file=File:Example.jpg
  → download + cache image, return /images/<hash> path

GET /images/<hash>.jpg
  → serve cached Commons image

GET /
  → serve static files (tour_viewer.html, studio.html)
```

Deployed directly to Toolforge via `webservice --backend=kubernetes node start`. Zero external dependencies — uses only Node.js built-in modules.

#### 2.2.2 New: `tour_viewer.html` — Viewer Frontend

Standalone Pannellum viewer loaded by the browser. Accepts tour page from URL hash (`#User:Example/MyTour` or `#tour=User:Example/MyTour`). Fetches tour config from the Node.js server.

#### 2.2.3 New: `studio.html` — Visual Editor

Visual editor for creating and editing tours. Features click-to-place hotspots, scene management, and export to wiki page format.

#### 2.2.4 Deferred: Multires Tile Pipeline

For Phase 1, bypass multires tiling and use direct Commons thumbnail/upload URLs (max 4096px). Future: build a Node.js tiling pipeline for large tour images.

---

## 3. Tour JSON Format

### 3.1 Wiki Page Format

The wiki page contains the tour JSON. Two storage options:

**Option A: Raw JSON as page content** (Recommended for Phase 1)
```
{
    "default": {
        "firstScene": "museum",
        "author": "Andrew Lih",
        "sceneFadeDuration": 1000
    },
    "scenes": {
        "museum": {
            "title": "Banned Books Museum",
            "hfov": 120,
            "pitch": -5,
            "yaw": -177,
            "type": "equirectangular",
            "panorama": "File:Wikimedia_Hackathon_2024_-_Banned_Books_Museum_06.jpg",
            "hotSpots": [
                {
                    "pitch": -17.35,
                    "yaw": 33.77,
                    "type": "scene",
                    "text": "Road Outside, Tallinn",
                    "sceneId": "road"
                },
                {
                    "pitch": -15,
                    "yaw": -273,
                    "type": "info",
                    "text": "The Satanic Verses, by Salman Rushdie",
                    "URL": "https://en.wikipedia.org/wiki/The_Satanic_Verses"
                }
            ]
        },
        "road": {
            "title": "Road in Vanalinn, Tallinn",
            "hfov": 110,
            "pitch": -4,
            "yaw": -85,
            "type": "equirectangular",
            "panorama": "File:Tallinn,_Estonia_–_Vanalinn,_Vene_–_2024-05-03_02.jpg",
            "hotSpots": [
                {
                    "pitch": -15,
                    "yaw": 250,
                    "type": "scene",
                    "text": "Banned Books Museum",
                    "sceneId": "museum"
                }
            ]
        }
    }
}
```

**Option B: JSON wrapped in `<syntaxhighlight>`**
```html
<syntaxhighlight lang="json">
{ ... tour JSON ... }
</syntaxhighlight>
```

This makes the page human-readable with syntax highlighting but requires stripping the wrapper before parsing.

### 3.2 Panorama Field Resolution

The `panorama` field in each scene supports two formats:

| Format | Example | Resolution Strategy |
|---|---|---|
| `File:` reference | `File:Example.jpg` | Resolve to Commons URL via API; thumbnail-scale if needed |
| Direct URL | `https://upload.wikimedia.org/...` | Use directly |
| Toolforge path | `/images/example.jpg` | Resolve relative to tool base |

### 3.3 Resolving File References to URLs

For `File:` references, we need to get the actual image URL. Options:

1. **Commons API**: `action=query&titles=File:Example.jpg&prop=imageinfo&iiprop=url&iiurlwidth=4096`
   - Returns both the full URL and a thumbnail URL
   - Use `iiurlwidth=4096` to get a WebGL-safe size
2. **Hardcoded URL pattern**: `https://upload.wikimedia.org/wikipedia/commons/{hash}/{filename}`
   - Requires knowing the MD5 hash path (available from API above)
3. **Thumbnail URL pattern**: `https://commons.wikimedia.org/wiki/Special:FilePath/{filename}?width=4096`
   - Redirects to the actual file; simple but adds redirect latency

**Recommendation**: Use the Commons API approach (1) with caching to avoid hitting the API on every tour load.

---

## 4. Implementation Plan

### 4.1 Prototype Scope

The prototype is a **Node.js server** (`tour_server.mjs`) with zero external dependencies, demonstrating the full tour viewing and editing workflow:

1. **`tour_server.mjs`**: Node.js server (built-in modules only):
   - Serves `GET /api/tour?page=PageTitle`
   - Fetches wiki page content via `action=raw`
   - Parses JSON or TOML
   - Resolves `File:` references to cached Commons images
   - Returns Pannellum-compatible tour JSON

2. **`tour_viewer.html`**: Standalone Pannellum viewer:
   - Embeds Pannellum
   - Fetches tour config from `tour_server.mjs/api/tour`
   - Renders the tour

3. **`studio.html`**: Visual editor for creating/editing tours

4. **Test data**: Use the existing `User:Fuzheado/Panellum_Tour` page as the first test tour.

### 4.2 Files to Create

```
photospheres/
├── RESEARCH_REPORT.md          # ✅ Done
├── PRD.md                      # ✅ This file
├── prototype/
│   ├── tour_server.mjs         # Node.js server: fetch + resolve tour (zero deps)
│   ├── tour_viewer.html        # HTML frontend: embed Pannellum + load tour
│   ├── studio.html             # Visual editor UI
│   ├── studio.js               # Editor logic
│   ├── tour_config.php         # PHP reference (not deployed — standalone equivalent)
│   └── README.md               # Setup and usage instructions
```

### 4.3 Implementation Steps

1. **Write `tour_server.mjs`**:
   - HTTP server with `/api/tour`, `/api/resolve`, `/images/` endpoints
   - Fetch wiki page via `action=raw`
   - Parse JSON or TOML
   - Resolve `File:` references via Commons API
   - Cache images with SHA-256 hash paths
   - Serve static files
2. **Write `tour_viewer.html`**:
   - Load Pannellum
   - Fetch tour config from `/api/tour?page=...`
   - Handle the tour rendering
3. **Write `studio.html` + `studio.js`**:
   - Visual hotspot editor with click-to-place
   - Scene management
   - Export to JSON
4. **Test** with the existing `User:Fuzheado/Panellum_Tour` page
5. **Deploy to Toolforge** as a new tool (see Section 5)

### 4.4 Key Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| JSON storage format | Raw JSON as page content | Simplest parsing, no wrapper stripping needed |
| File reference resolution | Commons API `imageinfo` | Reliable, returns thumbnail URL for sizing |
| CORS handling | Node.js sets `Access-Control-Allow-Origin: *` | Allows the viewer HTML to fetch from any origin |
| Error handling | Return JSON with `error` field | Pannellum can show error messages |
| Caching | File-based cache with TTL | Avoid hitting Commons API on every page load |
| Thumbnail sizing | Request 4096px width | Pannellum's recommended max for WebGL |
| Deployment target | New Toolforge tool `wikipano` (Node.js) | Deploy prototype directly, no PHP porting |
| Development language | Node.js (zero deps) | Available locally; matches production |
| Production language | Node.js (Toolforge native) | No porting needed — deploy as-is |

---

## 5. API Design

### 5.1 `tour_server.mjs` — Node.js Server

**Tour endpoint**: `GET /api/tour?page={pageTitle}`

| Parameter | Required | Description |
|---|---|---|
| `page` | Yes | Wiki page title containing tour JSON/TOML (URL-encoded) |

**Response** (200 OK):
```json
{
    "default": {
        "firstScene": "museum",
        "author": "Andrew Lih",
        "sceneFadeDuration": 1000
    },
    "scenes": {
        "museum": {
            "title": "Banned Books Museum",
            "hfov": 120,
            "type": "equirectangular",
            "panorama": "https://upload.wikimedia.org/wikipedia/commons/3/3c/Wikimedia_Hackathon_2024_-_Banned_Books_Museum_06.jpg",
            "hotSpots": [...]
        }
    }
}
```

**Error Response** (400/404/500):
```json
{
    "error": "Failed to fetch tour page: Page not found"
}
```

**CORS Headers**:
```
Access-Control-Allow-Origin: *
Content-Type: application/json
```

**File resolution**: `GET /api/resolve?file={FileName}` — resolves `File:` references to cached image paths

**Static assets**: Cached images served at `/images/<hash>.jpg`

### 5.2 Commons API Usage

**File resolution** (one call per unique file, cached):
```
GET https://commons.wikimedia.org/w/api.php
  ?action=query
  &titles=File:Wikimedia_Hackathon_2024_-_Banned_Books_Museum_06.jpg
  &prop=imageinfo
  &iiprop=url
  &iiurlwidth=4096
  &format=json
```

Returns the direct upload URL and a 4096px thumbnail URL.

---

## 6. Testing Plan

### 6.1 Manual Test Cases

| # | Test | Expected Result |
|---|---|---|
| T1 | Load tour with 2 scenes, bidirectional links | Tour loads, click hotspots to navigate, fade transitions work |
| T2 | Info hotspot with external URL | Hover shows tooltip, click opens URL in new tab |
| T3 | Tour with `File:` references in panorama field | Files resolved to Commons URLs, images display correctly |
| T4 | Tour with direct URLs in panorama field | URLs used directly, images display correctly |
| T5 | Invalid tour page title | Graceful error message |
| T6 | Malformed JSON on wiki page | Graceful error message with details |
| T7 | Scene with missing panorama field | Error for that scene, others still work |
| T8 | Large image (>4096px wide) | Uses scaled thumbnail, renders without WebGL issues |
| T9 | Click hotspot node in viewport → edit modal opens | Modal opens; viewport does NOT navigate or reset (SC-2.1) |
| T10 | Hover hotspot card in right panel | Viewport does NOT move (SC-2.2) |
| T11 | Click hotspot card in right panel | Viewport smoothly pans to face that hotspot (SC-2.2) |
| T12 | Click ✎ pencil on hotspot card | Edit modal opens; viewport does NOT move (SC-2.2) |
| T13 | Click × delete on hotspot card | Hotspot deleted; viewport does NOT move (SC-2.2) |

### 6.2 Test Tour

Use the existing `User:Fuzheado/Panellum_Tour` page on Commons as the primary test fixture. It contains:
- 2 scenes (Banned Books Museum, Road Outside)
- Bidirectional scene links
- Info hotspots with Wikipedia URLs

---

## 7. Open Questions

1. **Namespace**: Should tours live in a dedicated namespace (e.g., `/Tour:`) or in user space? Start user-space for prototyping.
2. **JSON validation**: Should we validate tour JSON against a schema? Worth doing server-side to catch errors early.
3. **Multires tiling**: Defer to Phase 2. Use scaled thumbnails via Commons API for Phase 1.
4. **Caching strategy**: How long to cache resolved file URLs? commons file URLs are stable; a 1-hour TTL with purge on demand is reasonable.
5. **XSS concerns**: Pannellum v2.5.7 has XSS fixes. We should also sanitize fields server-side.
6. **Template integration**: Eventually, a `{{PanoTour|page=User:Example/MyTour}}` template on Commons would make tour discovery easy.

---

## 8. Success Metrics

- One working demo tour with 2+ scenes navigable via hotspot clicks
- Tour definition stored as a wiki page, editable by anyone
- `tour_server.mjs` successfully fetches and resolves the tour JSON
- Documentation for creating a new tour from scratch
- Prototype deployed to a new Toolforge tool (Node.js backend)
