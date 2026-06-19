# Competitive Analysis & Strategic Assessment
## Wikimedia Photosphere Tours — Phase 2 Complete

**Date**: 2026-06-18
**Author**: AI coding agent (analysis session)
**Status**: Strategic recommendation document

---

## Executive Summary

Wikimedia Commons hosts thousands of 360° equirectangular photos but lacks a collaborative way to link them into walkthrough tours. This project built a wiki-native authoring pipeline on top of Pannellum, achieving Phase 1 (viewer) and Phase 2 (visual studio) complete. This report evaluates whether the current Pannellum-based architecture is the right long-term foundation, or whether the project should migrate to Photo-Sphere-Viewer for Phase 3.

**Key finding**: The wiki-as-storage approach is correct and worth preserving. The Pannellum rendering layer is the constraint. Migration to Photo-Sphere-Viewer for Phase 3 is recommended — but the existing Node.js server, visual studio, import/export pipeline, and wiki integration are largely reusable.

---

## 1. Competitive Landscape

### 1.1 Primary Contenders

| Library | Stars | License | Last Release | Active Development | Wikimedia Status |
|---|---|---|---|---|---|
| **Pannellum** | 4,821 | MIT | v2.5.7 (Feb 2026) | Low-moderate (maintenance) | ✅ Deployed at panoviewer.toolforge.org |
| **Photo-Sphere-Viewer** | 2,284 | MIT | v5.14.1 (Jan 2026) | High | ❌ Not deployed |
| **Marzipano** | 2,217 | Apache 2.0 | Oct 2023 | Low (abandoned by Google) | ❌ Not deployed |
| **A-Frame** | 14,700+ | MIT | Ongoing | Very high | ❌ Not deployed |

### 1.2 Commercial SaaS Platforms

The commercial virtual tour market is dominated by hosted SaaS platforms — proprietary, cloud-hosted, closed-source services that store tours on their own infrastructure. **Kuula** is the most relevant comparison because it's the closest to what we're building (and was explicitly cited in the project's original problem statement):

#### Kuula — Feature Deep Dive

**Overview**: Kuula (kuula.co) is a browser-based virtual tour platform — upload 360° photos, connect them with hotspots in a visual editor, and publish embedded tours. It's the closest commercial analogue to our Studio + Viewer pipeline.

| Aspect | Details |
|---|---|
| **Stack** | Proprietary cloud SaaS (closed source) |
| **Pricing** | Free (limited), PRO ~$12/mo, Business ~$36/mo |
| **Hosting** | Kuula-hosted only — tours live on kuula.co domains or embeds |
| **Open Source** | No — entirely proprietary |
| **Wikimedia compatibility** | None — no Commons integration, no wiki storage, no CC licensing |

**What Kuula Does Well (features we should study):**

| Feature | Kuula Implementation | Relevance to Us |
|---|---|---|
| **Visual editor** | Click-to-place hotspots with icon, label, and action config | Directly parallels our Studio — their UX is more polished |
| **Walkthrough Mode** | Auto-aligns camera orientation between connected shots | We don't have this — Pannellum lacks native orientation inheritance |
| **4 hotspot action types** | Go to post, Open URL, Open card, Play audio | Our info/scene/audio/video covers similar ground but less unified |
| **Interactive Cards** | Click hotspot → rich card with video, text, image, links, embeds | We have Wikipedia info cards — Kuula's cards are more general-purpose |
| **Custom hotspot icons** | Upload PNG icons, set size/color/animation (bounce, pulse, glow) | We have colored icons (red ➤ blue ⓘ green 🎵 purple 🎬) but not custom uploads |
| **Floor plans** | Upload flat images as floor plans, overlay hotspot pins | PSV's PlanPlugin can do this; Pannellum cannot |
| **Background audio** | Per-tour music loops + per-scene audio (voiceovers, ambient) | We have per-hotspot audio but not per-tour background audio |
| **Video in hotspots** | YouTube embeds inside interactive cards | We have video popup overlays (Commons + YouTube) |
| **Transition effects** | Multiple animated transitions between scenes | Pannellum has `sceneFadeDuration` only |
| **White-label / branding** | Custom logos, hidden Kuula branding (PRO+), embed customization | N/A for wiki — but template customization matters for Commons |
| **Player API** | ~1KB JS library for programmatic embed control | Interesting for wiki template integration |
| **Nadir/zenith patches** | Upload flat images to patch tripod cap or sky | We don't have this; Pannellum doesn't support it natively |
| **Thumbnail strip** | Bottom gallery bar showing all scenes in tour | PSV GalleryPlugin has this; Pannellum does not |
| **Tour duplication** | Copy tours for versioning or localization | Wiki pages inherently support this via page history |
| **Level correction** | Horizon leveling in the editor | Pannellum has `northOffset`/`haov`/`vaov` but no visual leveler |

**What Kuula Cannot Do (our advantages):**

| Capability | Kuula | Us (wikipano) |
|---|---|---|
| **Collaborative editing** | ❌ Single user owns a tour | ✅ Wiki pages — anyone can edit, full revision history |
| **Version history** | ❌ No diff/rollback | ✅ MediaWiki page history, diffs, rollback |
| **Talk pages / discussion** | ❌ No per-tour discussion | ✅ Wiki talk pages for coordination |
| **Watchlists** | ❌ | ✅ Watch a tour page, get notified on changes |
| **CC licensing** | ❌ Proprietary hosting, no structured licensing | ✅ Commons files with SDC, CC licensing metadata |
| **Commons integration** | ❌ Must upload images to Kuula | ✅ Direct `File:` references to existing Commons photos |
| **Open data** | ❌ Tour data locked in Kuula's DB | ✅ TOML/JSON on wiki pages — machine-readable, exportable, open |
| **Structured Data** | ❌ | ✅ SDC depicts/copyright statements on Commons files |
| **Free pricing** | Freemium — features gated behind $12–36/mo | ✅ Fully free, no paywalls |
| **Self-hosted** | ❌ Kuula-hosted only | ✅ Toolforge deploy, or run locally |
| **Offline / air-gapped** | ❌ Requires internet | ✅ Local Node.js server works offline |

**Strategic takeaway**: Kuula proves the product category works — visual tour editors are valuable, and features like walkthrough mode, floor plans, and interactive cards are table stakes for professional use. But Kuula is architecturally incompatible with Wikimedia: proprietary hosting, no wiki integration, no CC licensing, no collaborative editing. We can't build on Kuula, but we should **match its feature bar** (especially walkthrough mode and floor plans) as we design Phase 3.

#### Other SaaS Platforms (Brief)

| Platform | Model | Key Differentiator | Why Not for Wikimedia |
|---|---|---|---|
| **Matterport** | SaaS ($20–309/mo) | True 3D mesh + dollhouse view, auto-measurements | Heavy infra, proprietary scanning hardware, no wiki integration |
| **CloudPano** | SaaS | Lead-capture focus, CRM integrations | Real-estate-specific, no CC/open-data model |
| **3DVista** | Self-hosted desktop app | One-time license ($500+), self-hosted | Desktop-only authoring, no collaboration |
| **EyeSpy360** | SaaS | AI-powered staging, 3D dollhouse | Proprietary, no wiki integration |
| **Zillow 3D Home** | Free (Zillow ecosystem) | MLS integration, free for real estate | Locked to Zillow, US residential only |

### 1.3 Open-Source Tour Authoring Tools

None of the existing open-source tour tools are wiki-connected. They all assume local file storage + single-user editing:

| Tool | Stack | Best Feature | Limitation |
|---|---|---|---|
| **Panaedit** | React + TypeScript | Visual hotspot placement, Pannellum export | Local file model only |
| **Pannellum Tour Maker** | Java/Spring Boot + MongoDB | ZIP upload → multires tiles → visual editor | Massive infra, overkill for wiki |
| **Pannellum Generator** | Python + in-browser JS | Simple persistent mode | Desktop-only generation |
| **Marzipano Tour Editor** | Pure HTML/JS | Desktop tool, clean export | Abandoned, desktop-only |
| **3Sixty-WebTour-Maker** | Electron + Panolens.js | Free desktop app | Niche, not wiki-connected |

**Key gap**: No existing tool — commercial or open-source — stores tour definitions as wiki pages with collaborative editing, revision history, and talk page workflows. This is the project's primary innovation.

### 1.4 The SDC Superpower: Auto-Generating Hotspots from Structured Data

No commercial tour tool can auto-generate hotspots from metadata. They all require manual placement — click by click, scene by scene. But Wikimedia Commons has a unique asset that no SaaS platform can match: **Structured Data on Commons (SDC)** — machine-readable statements on every media file, powered by the same Wikibase technology that runs Wikidata.

This opens a fundamentally different authoring workflow:

```
Traditional (Kuula, Matterport, etc.):
  Upload photo → Manually place every hotspot → Repeat for every scene

SDC-powered (wikipano):
  Import Commons photo → Depicts statements become hotspot candidates → Auto-generated hotspots with labels → Human refines positions → Done
```

**How it works — the data pipeline:**

```
┌──────────────────────────────────────────────────────────────────┐
│  Wikimedia Commons MediaInfo Entity (M ID)                       │
│                                                                  │
│  depicts (P180):                                                 │
│    → Q1234 (Banned Books Museum)   → info hotspot + label       │
│    → Q5678 (typewriter)           → info hotspot + label       │
│    → Q9012 (Johannes Gutenberg)    → info hotspot + label       │
│                                                                  │
│  coordinates of the point of view (P1259):                      │
│    → 52.5°N, 13.4°E              → position on map overlay      │
│                                                                  │┐
│  coordinate location (P625) on depicted items:                  │
│    → GPS coords per depicted item → floor plan pin placement    │
│                                                                  │
│  depicts (P180) → Q9xxx is itself a panorama file:             │
│    → File:Another_Photo.jpg       → scene-link hotspot candidate │
└──────────────────────────────────────────────────────────────────┘
```

**Concrete example:** A photo of a museum interior on Commons has SDC `depicts` statements for the museum building, a typewriter on display, and a portrait on the wall. Each `depicts` QID can become an info hotspot with a Wikidata-powered label and thumbnail. If one of the depicted items is itself an equirectangular photo (another Commons File), it becomes a scene-link hotspot candidate. If the depicted items have `P625` coordinate data, those pins can appear on a floor plan overlay.

**Why this is impossible for Kuula, Matterport, or any SaaS tool:**
1. They don't store structured depiction metadata on images — we do (SDC)
2. They don't link to a knowledge graph of 100M+ entities — we do (Wikidata)
3. They don't have coordinate metadata per depicted subject — we do (P1259, P625)
4. They don't have multilingual labels for depicted items — we do (Wikidata labels in 300+ languages)
5. Their data is siloed in proprietary databases — ours is open, linked, and queryable via SPARQL

**The workflow in Studio:**
- User imports a Commons photo → server fetches SDC depicts statements
- Studio presents a list: "3 items depicted — generate hotspots?"
- User selects which depicts items to add as hotspots
- Studio auto-creates info hotspots with Wikidata labels
- User drags/adjusts positions in the 360° viewport
- SDC hotspots and manual hotspots coexist; SDC is the starting point, not the final word

**Impact on Phase 3 library choice:** Photo-Sphere-Viewer's MarkerPlugin and PlanPlugin are a better rendering substrate for SDC-generated hotspots (rich HTML markers, map pin overlays) than Pannellum's basic `info`/`scene` hotspot types. This further supports the PSV migration recommendation.

---

## 2. Feature Comparison Matrix

| Feature | Pannellum | Photo-Sphere-Viewer | Marzipano | A-Frame |
|---|---|---|---|---|
| **Tour navigation (scene-to-scene)** | ✅ Built-in | ✅ VirtualTourPlugin | ✅ | ✅ (manual linking) |
| **Visual hotspot editor** | ❌ (must build) | ❌ | ✅ (desktop tool) | ❌ |
| **Wiki integration layer** | ❌ (ours — unique) | ❌ | ❌ | ❌ |
| **Gallery thumbnail strip** | ❌ (must custom-build) | ✅ Built-in | ❌ | ❌ |
| **Map/plan overlay** | ❌ (must custom-build) | ✅ PlanPlugin (OSM, etc.) | ❌ | ❌ |
| **Compass overlay** | ✅ (GPano XMP based) | ✅ Plugin | ❌ | ❌ |
| **Server-side node loading** | ❌ (all scenes upfront) | ✅ Async callback per node | ❌ | ❌ |
| **GPS-based auto-placement** | ❌ | ✅ EXIF → map positioning | ❌ | ❌ |
| **360° video tours** | ⚠️ (Video.js integration) | ✅ Native | ❌ | ✅ |
| **VR headset support** | ❌ | ❌ | ❌ | ✅ |
| **Rich markers (HTML, images, video in hotspots)** | ❌ (basic info only) | ✅ MarkerPlugin | ⚠️ (basic) | ✅ |
| **Stereo/3D mode** | ❌ | ✅ StereoPlugin | ❌ | ✅ |
| **Autorotate** | ✅ | ✅ AutorotatePlugin | ✅ | ✅ |
| **Gyroscope support** | ✅ | ✅ GyroscopePlugin | ✅ | ❌ |
| **Multires tiling** | ✅ (generate.py) | ✅ ResolutionPlugin | ✅ (native) | ⚠️ (manual) |
| **Language** | Vanilla JavaScript | TypeScript | Vanilla JavaScript | HTML + JavaScript |
| **Plugin architecture** | ❌ (monolithic) | ✅ (10+ official plugins) | ❌ (monolithic) | ✅ (component system) |
| **Weekly npm downloads** | N/A (no npm package) | ~10,000 | ~2,000 | ~80,000 |
| **Architecture** | Single-file, zero deps | Modular, Three.js-based | Modular, Three.js-based | Entity-component system |
| **SDC-driven hotspot generation** | ❌ | ❌ | ❌ | ❌ |
| **Wiki JSON schema fit** | ✅ Excellent (flat, declarative) | ⚠️ Complex (callbacks, hooks) | ✅ Clean (data.js) | ⚠️ HTML markup |

---

## 3. What We've Built vs. What Pannellum Provides

### 3.1 Pannellum Natively Provides
- WebGL equirectangular panorama renderer
- Declarative JSON schema for scenes and hotspots
- Built-in tour mode with `sceneFadeDuration` transitions
- `scene` and `info` hotspot types
- `hotSpotDebug` mode for coordinate capture
- Autorotate, compass (GPano-based), gyroscope support
- Multires tile generation pipeline (`generate.py`)
- XSS protection (v2.5.7 security patches)

### 3.2 What We've Built on Top (Unique Differentiation)

| Component | What We Built | Why It Matters |
|---|---|---|
| **Node.js server** | Zero-dependency wiki integration server | Wiki page fetching, TOML parsing, SHA-256 image cache, direct Toolforge deployment |
| **Commons API integration** | File: reference resolution, thumbnail generation | Transparent image loading from Wikimedia Commons |
| **Wikipedia rich info cards** | REST API fetch for lead image + extract on hotspot hover | Transforms info hotspots into Wikipedia reading experiences |
| **Visual Studio** | Click-to-place hotspots, scene management, import/export | Kuula-like authoring without leaving the browser |
| **Audio hotspots (🎵)** | Custom subtype pattern with Commons audio playback | Pannellum doesn't natively support audio — we extended it |
| **Video hotspots (🎬)** | Popup overlay player for Commons files and YouTube | Pannellum doesn't natively support video hotspots — we extended it |
| **Yaw normalization** | Auto-normalize to [-180, 180] at capture, export, preview | Data integrity across the toolchain |
| **Viewport preservation** | No editing operation resets the view | Core usability requirement for professional workflows |
| **JSON validator** | `node scripts/validate-pannellum.mjs [--fix]` | Batch repair of wiki tour pages |
| **Integrity checks** | `validateHotspot()` + `validateTour()` at all data boundaries | 5-step rule for every new field |
| **Documentation** | CAVEATS.md (15 gotchas), DEBUGGING.md (734 lines), 7 ADRs, PRD | Institutional knowledge preservation |
| **SDC-driven hotspot generation** *(Phase 3+)* | Read `depicts` (P180) statements from Commons Structured Data to auto-generate hotspots; use coordinate metadata (P1259/P625) to position hotspots on a plan/map overlay | No other tool — commercial or open-source — has access to SDC. This is a Wikimedia-only superpower that turns static metadata into interactive tour content with zero manual hotspot placement |

### 3.3 The Honest Summary

**This project is a wiki integration layer with a visual editor, built on top of Pannellum as the rendering substrate.** The actual innovation is the wiki-as-database approach — collaborative editing, revision history, watchlists, talk pages, no new infrastructure. Pannellum is the right choice for Phase 1 and 2. Phase 3 requirements expose its structural limits.

---

## 4. Pannellum's Structural Ceiling

### 4.1 No Plugin Architecture

Pannellum is a monolithic viewer. Any advanced UI component — gallery strip, floor plan, compass, map overlay — requires a complete custom build from scratch. Photo-Sphere-Viewer ships these as official, tested, maintained plugins. The gap widens with every Phase 3 feature we want to add.

### 4.2 No Server-Side Node Loading

Pannellum loads all scenes in a tour upfront. For a 20-scene museum tour, the initial JSON payload includes all 20 panorama URLs and hotspot configurations. Photo-Sphere-Viewer's VirtualTourPlugin has an async callback mode where the viewer requests only the current node's data, fetching the next node's data only when the user initiates navigation. This is a natural fit for wiki storage where each scene could theoretically be its own wiki page.

### 4.3 No GPS-Based Positioning

Photo-Sphere-Viewer reads longitude/latitude/altitude from photo EXIF data via the VirtualTourPlugin's GPS mode. Scene nodes are automatically positioned on an OpenStreetMap overlay. Users can see the tour as a map, drag nodes to adjust, and navigate spatially. This is completely impossible to implement on Pannellum without rearchitecting the entire tour system.

### 4.4 Monolithic JSON Format

All tour scenes must live in a single JSON file. This works for small tours but creates a scaling problem: a 50-scene city tour produces a multi-megabyte JSON blob. Photo-Sphere-Viewer's server mode allows each scene to be its own JSON blob, stored as its own wiki page — which aligns perfectly with our wiki-native architecture.

### 4.5 Active Development is Slow

Pannellum is maintained by one person (Matthew Petroff) who is explicitly time-constrained. The library is "feature-complete and stable" — which means it solves its original design goals well, but will not evolve. Critical security patches (v2.5.7 XSS fixes) are maintained, but the library is not moving forward. Photo-Sphere-Viewer has an active core maintainer (Damien Sorel) with regular releases, dependency updates, and community engagement.

### 4.6 Wiki JSON Schema Fit Is a Double-Edged Sword

Both research reports correctly identify that Pannellum's flat, declarative JSON schema maps cleanly to wiki page storage. This is an advantage for Phase 1 simplicity. However, it also means the schema cannot express richer concepts — custom marker types, plugin configurations, GPS coordinates, async loading directives — without our own custom extensions that Pannellum's viewer ignores.

---

## 5. Photo-Sphere-Viewer Deep Dive

### 5.1 VirtualTourPlugin Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  VirtualTourPlugin (Photo-Sphere-Viewer)                     │
│                                                              │
│  ┌─ Node Data Modes ──────────────────────────────────────┐ │
│  │  CLIENT mode: All nodes loaded upfront (like Pannellum)│ │
│  │  SERVER mode: Nodes loaded on-demand via async callback│ │
│  │            → Perfect for wiki API integration          │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─ Positioning Modes ────────────────────────────────────┐ │
│  │  MANUAL mode: Yaw/pitch coordinates (current approach)  │ │
│  │  GPS mode: Long/lat/alt from EXIF → auto map position   │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─ Built-in Features ────────────────────────────────────┐ │
│  │  • 3D arrow rendering with overlap detection            │ │
│  │  • Scene preloading on hover (smooth transitions)       │ │
│  │  • Gallery, Map, Plan, Compass, Markers plugins         │ │
│  │  • Configurable transitions (fade, rotate, preload)      │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Plugin Ecosystem

| Plugin | Wikimedia Relevance | Complexity to Build on Pannellum |
|---|---|---|
| **GalleryPlugin** | Thumbnail strip navigation between scenes | High (must build from DOM, no WebGL integration) |
| **MapPlugin** | Custom image map with hotspot overlay | High (custom canvas work) |
| **PlanPlugin** | OpenStreetMap/Google Maps with GPS markers | Very high (requires map tile infrastructure) |
| **CompassPlugin** | Heading overlay with configurable design | Low-medium (we have GPano-based compass already) |
| **MarkersPlugin** | Rich HTML/image/video/SVG markers with interactions | Medium (we built basic info hotspots) |
| **GyroscopePlugin** | Device orientation for mobile | Low (Pannellum has this) |
| **AutorotatePlugin** | Configurable auto-rotation | Low (Pannellum has this) |
| **ResolutionPlugin** | Multiple resolution switching per panorama | Medium (multires pipeline exists) |
| **VisibleRangePlugin** | Show visible area on minimap | High |
| **StereoPlugin** | VR headset / anaglyph mode | Low (Pannellum lacks this) |

### 5.3 Wiki Integration Challenge

Photo-Sphere-Viewer's strength (rich, complex configuration) is a weakness for wiki storage. VirtualTourPlugin nodes embed JavaScript callback hooks, custom marker DOM strings, and specialized plugin objects. A flat wiki JSON schema cannot directly express these. An **abstraction layer** would be required:

```
Wiki Page JSON (flat, declarative) → Abstraction Layer → Photo-Sphere-Viewer config (complex)
```

This is additional work, but manageable. The abstraction layer converts our clean, wiki-friendly JSON format into Photo-Sphere-Viewer's native configuration. Our existing server-side `importTourData()` / `exportTour()` functions become the abstraction layer, rewritten for PSV's schema.

---

## 6. Migration Cost-Benefit Analysis

### 6.1 Reusable Components (Low Migration Cost)

| Component | Reusability | Why |
|---|---|---|
| `tour_server.mjs` | ✅ Fully reusable | Wiki fetching, TOML parsing, image caching, Commons API — all library-agnostic |
| Visual studio (studio.html/js) | ⚠️ Partially reusable | Scene management, hotspot placement, import/export logic reusable; viewport rendering layer needs rewrite |
| `importTourData()` / `exportTour()` | ✅ Partially reusable | Conversion functions need PSV schema adaptation, logic patterns reuse |
| JSON validator | ⚠️ Partially reusable | Yaw normalization, structure validation reusable; PSV schema rules added |
| Wikipedia rich info cards | ✅ Reusable | API-based, library-agnostic |
| Audio/video hotspots | ⚠️ Reusable as PSV markers | Need PSV MarkerPlugin adaptation instead of Pannellum custom type pattern |
| Integrity check system | ✅ Fully reusable | Data boundary validation is format-agnostic |
| ADRs, PRD, CAVEATS, DEBUGGING | ✅ Fully reusable | All documentation is architectural, not library-specific |

**Estimated migration effort for reusable components**: ~60% of current codebase is directly reusable or adaptable.

### 6.2 Components Requiring Rewrite (High Migration Cost)

| Component | Effort | Why |
|---|---|---|
| `tour_viewer.html` | High | Complete rewrite — new viewer, new API, new plugins |
| Pannellum viewport in studio.js | High | Replace `pannellum.viewer()` with PSV viewer instantiation; hotspot placement via different API |
| Hotspot rendering CSS | High | Pannellum's `.pnlm-hotspot-base` / `.pnlm-render-container` classes replaced by PSV's marker system |
| Info popup system | Medium | Current click-to-toggle system adapts to PSV MarkersPlugin's popup system |
| Tour data schema | Medium | Convert Pannellum's flat JSON to PSV VirtualTourPlugin node format |
| Integration tests | High | All Playwright tests for viewport behaviors need rewriting |

**Estimated migration effort for rewrite components**: ~40% of current codebase requires significant rewrite.

### 6.3 Estimated Total Cost

| Phase | Effort | Description |
|---|---|---|
| Schema design | 1-2 days | Design PSV-compatible tour JSON schema with abstraction layer |
| Viewer rewrite | 3-5 days | Rewrite tour_viewer.html with PSV VirtualTourPlugin |
| Studio viewport | 3-4 days | Replace Pannellum viewport with PSV viewer in studio.js |
| Marker adaptation | 2-3 days | Adapt audio/video hotspots to PSV MarkerPlugin |
| Testing | 2-3 days | Rewrite Playwright tests for new UI |
| **Total** | **~11-17 days** | Significant but bounded |

---

## 7. Strategic Recommendation

### 7.1 Decision Framework

The choice between staying on Pannellum and migrating to Photo-Sphere-Viewer is not about which library is "better" in the abstract — it's about which approach minimizes total long-term effort while maximizing user value.

| Factor | Pannellum (Stay) | Photo-Sphere-Viewer (Migrate) |
|---|---|---|
| **Phase 2.5 (deployment)** | ✅ Immediate — deploy as-is | ❌ Delay — requires migration first |
| **Phase 3 (gallery)** | ❌ Custom build, high effort | ✅ Built-in, tested |
| **Phase 3 (map/plan)** | ❌ Custom build, very high effort | ✅ Built-in, OSM integration |
| **Phase 3 (GPS)** | ❌ Impossible without rearchitecture | ✅ Native EXIF → map |
| **Phase 3 (markers)** | ⚠️ Basic only | ✅ Rich HTML/image/video/SVG |
| **Long-term maintenance** | High (build everything from scratch) | Low (plugin updates from PSV team) |
| **Visual studio adaptation** | ✅ Stable (works well) | ⚠️ Significant rewrite needed |
| **Wiki JSON compatibility** | ✅ Direct storage | ⚠️ Requires abstraction layer |
| **Community trust** | ✅ Already on Toolforge | ⚠️ New dependency |

### 7.2 Recommendation: Migrate to Photo-Sphere-Viewer

**Stay on Pannellum is the right call for Phase 2.5 deployment. Migrate to Photo-Sphere-Viewer for Phase 3.**

The wiki-as-storage architecture is the correct long-term bet. It enables collaborative editing, no new infrastructure, and natural alignment with Wikimedia's existing workflows. Preserving it while swapping the rendering engine maximizes reuse while eliminating the structural ceiling.

Specifically:

1. **Deploy Phase 2.5 as-is on Pannellum.** The visual studio works. The viewer works. Deploy to Toolforge as `wikipano` and ship.

2. **For Phase 3, migrate the rendering layer to Photo-Sphere-Viewer.** The server, wiki integration, visual studio logic, and import/export pipeline are largely reusable. Only the viewer instantiation and hotspot rendering need significant rewriting.

3. **Design a wiki-native PSV tour JSON schema.** Our flat, declarative schema maps well to Pannellum. For PSV, we need an abstraction layer that converts our schema to PSV's VirtualTourPlugin node format. Design this schema before migration begins.

4. **Evaluate VirtualTourPlugin server mode.** If we store each scene as its own wiki page, PSV's async callback mode could fetch scene data on demand — a significant architectural win for large tours.

### 7.3 What We Lose If We Stay

If we stay on Pannellum and build Phase 3 features ourselves:

| Feature | Pannellum Build Effort | PSV Effort |
|---|---|---|
| Gallery strip | 2-3 weeks (custom DOM + WebGL) | 1 day (plugin config) |
| Map overlay | 3-4 weeks (tile infrastructure + canvas) | 1 day (PlanPlugin) |
| GPS auto-placement | Not feasible | 1 day (GPS mode) |
| Rich markers | Basic info only | Native support |
| **Total custom build cost** | **5-7 weeks of custom work** | **Plugin configuration** |

Every feature we build on Pannellum is custom work that Photo-Sphere-Viewer ships for free.

### 7.4 What We Gain If We Migrate

| Gain | Impact |
|---|---|
| **10+ official plugins** | Gallery, map, compass, markers, stereo — no custom builds |
| **GPS-based tour overview** | Users see their tour on a map, auto-positioned from EXIF |
| **Server node loading** | Scales to large tours; natural wiki-per-scene storage |
| **TypeScript codebase** | Better typed, more maintainable |
| **Active development** | PSV team handles Three.js updates, browser compatibility, new features |
| **Better VR support** | Stereo mode built-in for headset viewing |

---

## 8. Phased Roadmap

### Phase 2.5: Deploy (Immediate) — Pannellum
- [ ] Create `wikipano` Toolforge tool
- [ ] Deploy `prototype/` via rsync
- [ ] Start `webservice --backend=kubernetes node`
- [ ] Create `{{PanoTour}}` Commons template
- [ ] Configure tool maintainers
- [ ] Documentation for tour creation

### Phase 3: Migration — Photo-Sphere-Viewer
- [ ] Design PSV-compatible tour JSON schema with abstraction layer
- [ ] Rewrite `tour_viewer.html` with PSV VirtualTourPlugin
- [ ] Rewrite `studio.js` viewport layer for PSV viewer
- [ ] Adapt audio/video hotspots to PSV MarkerPlugin
- [ ] Implement GalleryPlugin (bottom thumbnail strip)
- [ ] Implement PlanPlugin (OSM tour overview map)
- [ ] Implement GPS auto-placement from EXIF data
- [ ] Rewrite Playwright tests
- [ ] Deploy migrated version to Toolforge

### Phase 3: SDC-Driven Hotspot Generation
- [ ] Read `depicts` (P180) statements from Commons MediaInfo entities via Wikibase Action API
- [ ] Map depicts items to hotspot candidates — each `depicts` QID becomes a potential info hotspot
- [ ] Fetch Wikidata labels + descriptions for depicted items (multilingual)
- [ ] Use `coordinates of the point of view` (P1259) / `coordinate location` (P625) from depicted items to position hotspots on floor plan or map overlays
- [ ] Auto-generate scene-link hotspots from `depicts` items that are themselves panoramas (P180 → File: → check if equirectangular)
- [ ] Studio UI: "Import from SDC" button that populates hotspot list from depicts statements
- [ ] Viewer: hotspot tooltips show Wikidata-powered labels + thumbnails for depicted items
- [ ] Deduplication: merge SDC-generated hotspots with manually-placed ones (SDC as starting point, human-curated final result)

### Phase 3+: Wikimedia-Only Features (Impossible for SaaS Competitors)

These features exploit our unique position inside the Wikimedia ecosystem — access to Wikidata, Commons SDC, Wikipedia, and MediaWiki infrastructure that no closed platform can replicate.

#### 🟢 Easy (days — API calls + UI tweaks)

- [ ] **Multilingual hotspot labels via Wikidata** — Every depicted Wikidata item has labels in 300+ languages. Hotspot tooltips render in the viewer's browser language automatically. No commercial tool offers auto-translation of hotspot text. (Fetch via `wbgetentities` labels.)
- [ ] **Wikipedia sitelink cards** — Current info cards show English Wikipedia extract. Use Wikidata sitelinks to show the article in the viewer's language, or link to all available language editions. A depicted painting (Q-ID) might have articles in 40+ Wikipedias.
- [ ] **Inventory number → museum page** — Depicted artworks often have `inventory number` (P217) + `collection` (P195) on Wikidata. Info hotspot auto-links to the museum's online catalog entry for that exact object. Kuula has no idea what object is in the photo, let alone its accession number.
- [ ] **Captions from SDC** — Commons MediaInfo entities have multilingual captions (`labels` on M-IDs). Use these as scene titles/descriptions instead of requiring manual entry. Already-cataloged metadata becomes UI text.
- [ ] **License overlay** — Read `copyright license` (P275) and `copyright status` (P6216) from SDC and display a proper attribution bar (CC-BY-SA 4.0, etc.) with author credit. Kuula hides licensing; we surface it as a feature.

#### 🟡 Medium (1-2 weeks — SPARQL + new UI components)

- [ ] **Nearby Panoramas Discovery** — SPARQL `wikibase:around` query: given a tour's GPS coordinates (P1259 on the Commons file), find all other equirectangular panoramas within 500m / 1km / 5km on Commons. Offer them as scene-link candidates: "3 other 360° photos found nearby — add to tour?" This is our answer to Kuula's manual scene linking, but powered by a global database of free imagery.
- [ ] **Auto-Tour Builder** — Given a Wikidata item (e.g., Q1344 — Brandenburg Gate), query: (1) all Commons files with `depicts` → that item, (2) filter for equirectangular (category or GPano XMP), (3) sort by P1259 coordinates, (4) generate a tour skeleton with scenes in geographic order. One-click tour creation from a Wikidata concept.
- [ ] **Time Slider for Historical Sites** — Wikidata has `inception` (P571) and `dissolved/demolished` (P576) dates. For a building that was demolished and replaced, show a time-aware tour: "View as 1920" vs "View as 2024", switching between panoramas of the same location across eras. Depicted items also have time periods — "show only objects from the 17th century."
- [ ] **Accessibility: Wikidata-powered alt text** — Use depicts statements + Wikidata descriptions to generate fallback text for screen readers. "360° panorama of the Banned Books Museum interior depicting a typewriter, bookshelf, and portrait" — auto-composed from P180 labels.
- [ ] **WikiProject Tagging** — Tour pages can carry WikiProject banners. A tour of a heritage site could auto-notify WikiProject Heritage, appear in their tracking categories, and get reviewed by subject-matter experts. No SaaS tool has a community review workflow.

#### 🔴 Ambitious (3+ weeks — new subsystems, cross-wiki integration)

- [ ] **Wikidata → Floor Plan Generator** — For museum/gallery tours, query Wikidata for `instance of` (P31) → museum room (Q/Q), `part of` (P361) the building, `has layout` → OSM indoor map data. Generate a floor plan overlay with pin positions derived from P1259 coordinates of each panorama. This replaces Kuula's manual floor plan upload with auto-generated building schematics.
- [ ] **GLAM Collection Deep Tour** — Given a museum's Wikidata item, pull all artworks in its collection (P195 → reverse query). For each artwork: image (P18), title, artist, date, inventory number (P217). Generate a virtual gallery room with artwork hotspots that link to the object's Wikidata page and Wikipedia articles. A self-assembling museum tour from linked open data.
- [ ] **OpenStreetMap Integration** — Panoramas with P1259 coordinates → plot on OSM. Use Overpass API to find building footprints, walkable paths, and nearby POIs. Generate a walking tour: "Start at gate, walk 200m north, enter building through west door." Kuula has no geographic awareness beyond a static uploaded floor plan.
- [ ] **Live Wikipedia Article Embed** — For a depicted subject with a Wikipedia article, embed the live article (via REST API HTML) inside a hotspot card. When Wikipedia updates, the tour updates. A living tour that reflects current knowledge, not a snapshot.
- [ ] **Wikimedia Commons Category → Tour** — Given a Commons category (e.g., `Category:Equirectangular photographs of the Louvre`), enumerate all files, filter for 360°, sort by GPS proximity, generate a complete tour. Category watchers get notified of new photos → the tour grows organically as photographers upload.
- [ ] **Tour as Linked Data** — Write tour definitions back to Wikidata as `spherical panorama image` (P4640) statements on building/location items, and `ground level 360 degree view URL` (P5282) linking to our tool. Tours become discoverable from Wikidata, and Wikidata queries can find all locations with virtual tours. Our tours become part of the global linked data graph.

### Phase 3++: Rich Features (Rendering)
- [ ] CompassPlugin for heading overlay
- [ ] VisibleRangePlugin for minimap
- [ ] StereoPlugin for VR headsets
- [ ] Multilingual tour support
- [ ] Tour discovery: category system, featured tours

---

## 9. Conclusion

This project has built something genuinely novel: a wiki-native collaborative authoring environment for 360° photosphere tours. The wiki-as-storage architecture is the right long-term bet — it requires no new infrastructure, enables full wiki collaboration workflows, and stores tour definitions as first-class wiki pages.

Pannellum was the correct choice for Phase 1 and Phase 2. Its clean JSON schema, zero dependencies, and existing Toolforge deployment allowed rapid iteration and a working prototype. The visual studio is complete and functional.

However, Pannellum has reached its ceiling. The library is monolithic, lacks a plugin architecture, loads all scenes upfront, and has no GPS or map integration. Phase 3's features (gallery, map, GPS positioning) would require custom builds that Photo-Sphere-Viewer ships natively.

**The project is worth continuing.** The architecture is sound. The differentiation is real. The migration to Photo-Sphere-Viewer is a bounded, well-understood effort that preserves the wiki integration layer and swaps only the rendering engine.

---

## References

- Pannellum: https://pannellum.org/ | https://github.com/mpetroff/pannellum
- Photo-Sphere-Viewer: https://photo-sphere-viewer.js.org/ | https://github.com/mistic100/Photo-Sphere-Viewer
- Marzipano: https://www.marzipano.net/ | https://github.com/google/marzipano
- A-Frame: https://aframe.io/
- Panaedit (visual editor reference): https://github.com/laszloekovacs/panaedit
- RESEARCH_REPORT.md (2026-06-13): Original library landscape analysis
- RESEARCH_REPORT_GEMINI.md (2026-06-13): Alternative competitive evaluation
- PRD.md: Product requirements document
- HANDOVER.md: Current state and session log
- adr/001-007: Architecture decision records