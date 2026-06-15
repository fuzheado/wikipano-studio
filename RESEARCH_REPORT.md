# Wikimedia 360° Photosphere Tours — Research Report

**Date**: 2026-06-13
**Author**: AI coding agent research for Andrew Lih (User:Fuzheado)

---

## Executive Summary

Wikimedia Commons hosts thousands of 360° equirectangular photos taken on cameras like the Insta360 series. These are currently viewable individually via the `{{Pano360}}` template which links to `panoviewer.toolforge.org` (a Toolforge-hosted Pannellum viewer). However, there is no collaborative way to link multiple 360° photos together into a walkthrough "tour" — the kind of experience offered by commercial tools like Kuula and Matterport.

This report investigates:
1. The landscape of open-source 360° panorama viewers
2. Their tour/hotspot capabilities
3. Existing visual authoring tools
4. A feasible architecture for wiki-based collaborative tour authoring

**Key finding**: A pragmatic Phase 1 prototype can be built by extending the existing `panoviewer` Toolforge tool to fetch tour JSON definitions from wiki pages, requiring minimal new infrastructure. For the longer term, Photo-Sphere-Viewer offers a richer plugin ecosystem and more actively maintained codebase.

---

## 1. Library Comparison

### 1.1 Pannellum (Currently Deployed)

| Attribute | Detail |
|---|---|
| **Repository** | https://github.com/mpetroff/pannellum |
| **Stars** | 4,821 |
| **License** | MIT |
| **Language** | JavaScript (plain) |
| **Last Release** | v2.5.7 (February 2026) |
| **Last Commit** | May 2026 |
| **Maintainer** | Matthew Petroff (responsive but time-constrained) |
| **Wikimedia Status** | ✅ Deployed at panoviewer.toolforge.org |

**Tour Capabilities**:
- Built-in tour mode with `scenes` dictionary and `default` config
- `sceneFadeDuration` for animated transitions between scenes
- Two hotspot types: `scene` (links to another scene) and `info` (URL or tooltip)
- `targetYaw`, `targetPitch`, `targetHfov` for controlling the view when arriving at a scene
- `hotSpotDebug` mode logs yaw/pitch on click for hotspot placement
- Custom tooltip functions and click handlers
- Autorotate with configurable speed
- Compass overlay (reads GPano XMP metadata)
- Device orientation (gyroscope) support

**Key Limitations**:
- No plugin architecture — monolithic codebase
- No GPS-based automatic hotspot/link placement
- No map, gallery, or floor plan overlays
- Monolithic tour JSON format (all scenes in one file)
- NPM releases lag far behind master (last npm release ~5 years ago per issues)
- 213 open issues

### 1.2 Photo-Sphere-Viewer (mistic100) ⭐ Recommended for Long Term

| Attribute | Detail |
|---|---|
| **Repository** | https://github.com/mistic100/Photo-Sphere-Viewer |
| **Stars** | 2,284 |
| **License** | MIT |
| **Language** | TypeScript |
| **Last Release** | v5.14.1 (January 2026) |
| **Weekly Downloads** | ~10,000 (core) |
| **Maintainer** | Damien Sorel (very active) |
| **Wikimedia Status** | ❌ Not deployed |

**Tour Capabilities (VirtualTourPlugin)**:
- Two data modes: **client** (all nodes upfront) and **server** (nodes loaded on-demand via async callback — perfect for wiki API)
- Two positioning modes: **manual** (yaw/pitch) and **GPS** (longitude/latitude/altitude from EXIF — automatic!)
- Three.js-based 3D arrow rendering with overlap detection
- Configurable transitions: fade, rotation animation, preloading
- Integration with Gallery, Map, Plan, Compass, Markers plugins

**Full Plugin Ecosystem**:
| Plugin | Purpose |
|---|---|
| `virtual-tour-plugin` | Link multiple panoramas into tours |
| `markers-plugin` | Points of interest (HTML, images, SVG, polygons, polylines) |
| `gallery-plugin` | Bottom thumbnail strip for scene navigation |
| `map-plugin` | Custom image map overlay with hotspots |
| `plan-plugin` | Geographic map (OpenStreetMap, etc.) with GPS markers |
| `compass-plugin` | Direction compass overlay |
| `gyroscope-plugin` | Device orientation control |
| `autorotate-plugin` | Automatic rotation with configurable speed |
| `settings-plugin` | User-configurable settings panel |
| `resolution-plugin` | Multiple resolution switching |
| `overlays-plugin` | Custom HTML overlays on the viewer |
| `stereo-plugin` | Stereo/VR mode for headsets |
| `video-plugin` | 360° video controls |
| `visible-range-plugin` | Show range of visible area on a minimap |

**Key Advantages for Wikimedia**:
- Server mode enables wiki-backed tour data — viewer fetches only the node it needs
- GPS mode enables automatic link placement from photo EXIF data
- TypeScript + modular architecture = easier to extend and maintain
- Rich marker system far beyond Pannellum's simple hotspots
- PlanPlugin could show tours on OpenStreetMap

### 1.3 Marzipano (Google)

| Attribute | Detail |
|---|---|
| **Repository** | https://github.com/google/marzipano |
| **Stars** | 2,217 |
| **License** | Apache 2.0 |
| **Last Push** | October 2023 |
| **Status** | ⚠️ Appears abandoned by Google |

Has a nice desktop tool for generating tours locally (drag-and-drop, visual hotspot placement, export as ZIP). However, the abandoned status, desktop-only editor model, and lack of server-mode loading make it unsuitable for a collaborative wiki-based system.

### 1.4 Other Libraries

| Library | Notes |
|---|---|
| **View360** (Naver) | React/Vue/Svelte components, newer, smaller community |
| **Panolens.js** | Three.js based, used by 3Sixty-WebTour-Maker, niche |
| **A-Frame** | WebVR framework, used by HumAngle VRTourEditor. More VR/XR focused |

---

## 2. Existing Tour Authoring Tools

### 2.1 Panaedit (`laszloekovacs/panaedit`)

- **Stack**: React + TypeScript + Redux
- **Features**: Scene list, visual hotspot placement (click to place at center of view), link scenes together, info hotspots, rename scenes, export Pannellum JSON
- **Status**: Active (last push May 2025), 8 stars
- **Live**: https://laszloekovacs.github.io/panaedit/
- **Limitation**: Local file model only — no wiki integration
- **Relevance**: Best starting point for a visual editor. The Pannellum integration code (hotspot placement at current view) is directly reusable.

### 2.2 Pannellum Tour Maker (`zhenyanghua/pannellum-tour-maker`)

- **Stack**: Java/Spring Boot + MongoDB + RabbitMQ + Docker
- **Features**: Upload ZIP of equirectangular images → auto multires tiles → visual hotspot editor → export JSON
- **Limitation**: Massive infrastructure requirements, overkill for wiki use case
- **Relevance**: Good reference for multires tile pipeline ideas

### 2.3 Pannellum Generator (`codemonauts/pannellum-generator`)

- **Stack**: Python script + in-browser JS editor
- **Features**: Generates static HTML tour from folder of images, in-browser hotspot editor, optional DynamoDB backend for persistence
- **Relevance**: Simple "persistent mode" pattern is closest to what we'd build for wiki

### 2.4 Marzipano Tour Editor (`tunnaduong/marzipano-importer`)

- **Stack**: Pure HTML/JS, no framework
- **Features**: Create/edit/import/export Marzipano tours as ZIP. Visual hotspot placement. Drag-and-drop image upload.
- **Relevance**: Good UX reference but ties you to Marzipano

### 2.5 Other Tools

| Tool | Notes |
|---|---|
| **HumAngle VRTourEditor** | A-Frame based, custom `.hvrj` JSON format, visual editor, designed for media orgs |
| **3Sixty-WebTour-Maker** | Electron desktop app using Panolens.js, free tour maker |
| **Visit360** | Pannellum-based, web page editor for university building tours |
| **Next Paranoma** | Next.js + Three.js + React Three Fiber, interactive editor with blur effects |

### 2.6 Key Gap

**None of these tools are wiki-connected.** They all assume local file storage + local editing by a single user. The fundamental innovation needed is making the tour definition a wiki page that any authenticated user can edit, with full revision history, talk pages, and collaborative workflows — and having tools that read from and write back to that wiki page.

---

## 3. Panoviewer Current Architecture

### 3.1 How It Works

The `panoviewer.toolforge.org` source is at https://github.com/toollabs/panoviewer.

**Flow**:
1. User visits `https://panoviewer.toolforge.org/#File:Example.jpg`
   - URL is generated by the `{{Pano360}}` template on Commons
2. Static HTML/JS frontend loads Pannellum
3. JS makes a request to `config.php?file=Example.jpg`
4. PHP backend:
   - Checks Wikimedia DB replica for image metadata (width, height, timestamp)
   - Compares with cached version on NFS
   - If image is small enough → downloads from Commons, returns JSON with direct URL
   - If image is large → spawns a Toolforge grid job to generate multires tiles, polls for completion
   - Returns Pannellum JSON config with tile URLs
5. Pannellum renders the panorama in the browser

### 3.2 Components

- `public_html/` — Static HTML/JS frontend (embeds Pannellum)
- `public_html/config.php` — JSON config generator (fetches images, manages cache, spawns tile jobs)
- `public_html/cache.php` — Cache management
- Grid engine job scripts — Multires tile generation using Pannellum's `generate.py`

### 3.3 Phabricator Context

- **T105789**: Original "panoramic viewer for Commons" proposal
- **T138933**: Exploring moving Panoviewer into production (possibly as a MediaWiki extension)
- **T319953**: Migrating from Grid Engine to Kubernetes (Toolforge deprecation)

---

## 4. Proposed Architecture

### 4.1 Phase 1: Wiki-Based Tour Definitions (Minimal Extension)

```
┌──────────────────────────────────────────────────┐
│  Wikimedia Commons Wiki Page                      │
│  e.g. User:Fuzheado/Panellum_Tour                │
│  ┌──────────────────────────────────────────────┐ │
│  │ JSON tour definition stored as page content  │ │
│  │ (could be in <syntaxhighlight> block,        │ │
│  │  or raw JSON in a /Tour: namespace)          │ │
│  │                                              │ │
│  │ {                                            │ │
│  │   "default": { "firstScene": "museum", ... },│ │
│  │   "scenes": {                                │ │
│  │     "museum": {                              │ │
│  │       "panorama": "File:Hackathon_2024.jpg", │ │
│  │       "title": "Banned Books Museum",         │ │
│  │       "hotSpots": [...]                      │ │
│  │     }                                        │ │
│  │   }                                          │ │
│  │ }                                            │ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────┬───────────────────────────┘
                       │ fetch via action=raw
                       ▼
┌──────────────────────────────────────────────────┐
│  Toolforge: panoviewer (extended)                 │
│  config.php?tour=User:Fuzheado/Panellum_Tour      │
│  ┌──────────────────────────────────────────────┐ │
│  │ 1. Fetch raw page content from Commons API   │ │
│  │ 2. Parse JSON tour definition                │ │
│  │ 3. Resolve File: references → Commons URLs   │ │
│  │ 4. Generate multires tiles (reuse existing)  │ │
│  │ 5. Return full Pannellum tour config JSON    │ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────┬───────────────────────────┘
                       │ Pannellum tour config
                       ▼
┌──────────────────────────────────────────────────┐
│  Browser: Pannellum Viewer (existing frontend)    │
│  Renders tour with scene transitions & hotspots   │
└──────────────────────────────────────────────────┘
```

**Key benefit**: Zero new infrastructure. Only extends `config.php` with a `tour=` parameter. Tour JSON is editable by any Wikimedian with full wiki collaboration features.

### 4.2 Phase 2: Visual Tour Studio

A new Toolforge-hosted SPA that provides a Kuula-like visual editing experience:

- **Tech**: React + TypeScript (adapting panaedit's Pannellum integration)
- **Auth**: Wikimedia OAuth 1.0a for authenticated editing
- **Image Source**: Commons search API + direct URL/file input
- **Editor Features**:
  - Split pane: 360° viewport + editor controls
  - Click to place hotspots at current view
  - Drag hotspots to reposition
  - Live preview of what end-users will see
  - Round-trip: load JSON → edit → save back to wiki
  - Validation: check 2:1 ratio, verify Commons URLs resolve
- **Tech Details**:
  - Embeds Pannellum in the viewport with `hotSpotDebug` for coordinate capture
  - Reads/writes wiki pages via MediaWiki Action API with OAuth
  - Generates Pannellum-compatible JSON

### 4.3 Phase 3: Photo-Sphere-Viewer Migration (Long Term)

Replace Pannellum with Photo-Sphere-Viewer for richer features:

- Server-mode node loading from wiki API
- GPS-based automatic link placement from EXIF
- Map/Plan/Gallery integration
- Richer marker system (HTML, images, video in hotspots)
- Compass and gyroscope improvements

The wiki-based tour definition format remains the same — only the frontend viewer changes.

---

## 5. Key Design Decisions

### 5.1 Tour JSON Storage on Wiki

**Option A: Raw JSON in a dedicated namespace** (Recommended)
- Create a `/Tour:` namespace (or use User: namespace for prototyping)
- Page content is pure JSON
- Pros: Simple, tooling-friendly, easy to parse
- Cons: Not human-readable for non-technical editors (mitigated by the visual editor)

**Option B: Template-based structured format**
- Use wiki templates like `{{Tour scene|id=museum|file=Hackathon_2024.jpg|...}}`
- Pros: Human-editable, familiar wiki syntax
- Cons: Complex to parse, hard to express nested structures like hotspot arrays

**Option C: Scribunto/Lua data module**
- Store as a Lua table in a Module: page
- Pros: Programmatically accessible from wiki templates
- Cons: Lua syntax, not standard JSON, harder for external tools

**Recommendation**: Start with raw JSON on user pages (Option A) for Phase 1 prototyping. Evaluate a dedicated namespace if adoption grows.

### 5.2 Viewer Library Choice

| Factor | Pannellum | Photo-Sphere-Viewer |
|---|---|---|
| Already deployed on Toolforge | ✅ | ❌ |
| Existing Commons template integration | ✅ (`{{Pano360}}`) | ❌ |
| Wikimedia community familiarity | ✅ | ❌ |
| Active development | ⚠️ (slow) | ✅ (very active) |
| Plugin ecosystem | ❌ (monolithic) | ✅ (rich) |
| TypeScript | ❌ | ✅ |
| Tour server mode | ❌ (all-at-once) | ✅ (on-demand) |
| GPS-based positioning | ❌ | ✅ |
| Map/plan integration | ❌ | ✅ |
| NPM packaging | ⚠️ (stale) | ✅ (current) |

**Recommendation**: Start with Pannellum for Phase 1 (leverage existing infrastructure). Re-evaluate Photo-Sphere-Viewer for Phase 3.

### 5.3 Authentication Model

- **Viewer**: No authentication needed (public tours)
- **Editor (Phase 2)**: OAuth 1.0a via Wikimedia's OAuth provider
  - Toolforge tools have established patterns for this
  - Users authenticate with their Wikimedia account
  - Editor writes tour JSON back to their wiki page
- **API rate limits**: Cache wiki page fetches, respect `action=raw` caching

### 5.4 Image Resolution Handling

- Pannellum has a 4096px recommended max width for WebGL
- Commons images can be 8000px+ wide
- Existing panoviewer multires tiling pipeline handles this
- Need to ensure it works for multiple images in a tour (possibly pre-generate tiles on tour save in Phase 2)

---

## 6. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Commons images not actually equirectangular | Add validation in editor (2:1 ratio check, GPano XMP presence) |
| Pannellum development stalls | Design JSON format to be library-agnostic; plan Phase 3 migration |
| Tour JSON too complex for wiki editing | Phase 2 visual editor eliminates need to hand-edit JSON |
| XSS via malicious JSON configs | Pannellum already has `escapeHTML` option and recent XSS fixes (v2.5.7); validate JSON server-side |
| Toolforge resource limits | Reuse existing multires caching; paginate large tours |
| Copyright of 360 photos in tours | Commons already handles this; tours only reference existing Commons files |

---

## 7. References

- **Pannellum**: https://pannellum.org/ | https://github.com/mpetroff/pannellum
- **Photo-Sphere-Viewer**: https://photo-sphere-viewer.js.org/ | https://github.com/mistic100/Photo-Sphere-Viewer
- **Marzipano**: https://www.marzipano.net/ | https://github.com/google/marzipano
- **Panoviewer source**: https://github.com/toollabs/panoviewer
- **Panoviewer live**: https://panoviewer.toolforge.org/
- **{{Pano360}} template**: https://commons.wikimedia.org/wiki/Template:Pano360
- **Example tour JSON**: https://commons.wikimedia.org/wiki/User:Fuzheado/Panellum_Tour
- **Panaedit (visual editor)**: https://github.com/laszloekovacs/panaedit
- **Pannellum Tour Maker**: https://github.com/zhenyanghua/pannellum-tour-maker
- **Marzipano Tour Editor**: https://github.com/tunnaduong/marzipano-importer
- **Phabricator T138933** (panoviewer production migration): https://phabricator.wikimedia.org/T138933
- **Phabricator T319953** (Kubernetes migration): https://phabricator.wikimedia.org/T319953
- **Toolforge**: https://wikitech.wikimedia.org/wiki/Portal:Toolforge
