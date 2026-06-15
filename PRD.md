# PRD: Wikimedia 360° Photosphere Tours — Phase 1 Prototype

**Version**: 1.0
**Date**: 2026-06-13
**Status**: Draft

---

## 1. Overview

### 1.1 Problem Statement

Wikimedia Commons hosts thousands of 360° equirectangular photos, but there is no way to link them together into interactive walkthrough tours. Currently, each photo can only be viewed individually via the `{{Pano360}}` template → `panoviewer.toolforge.org` pipeline. Users who want to create a virtual tour (e.g., through a museum, a historic site, or a city neighborhood) must use proprietary commercial tools like Kuula or Matterport.

### 1.2 Phase 1 Goal

Enable Wikimedians to **collaboratively define 360° photosphere tours** by storing a tour definition as a JSON page on wiki, and viewing it through the existing `panoviewer.toolforge.org` infrastructure.

### 1.3 Success Criteria

1. A user can create a wiki page containing a Pannellum-compatible tour JSON definition
2. Visiting `https://panoviewer.toolforge.org/#tour=User:Example/MyTour` renders the tour in the Pannellum viewer
3. Users can click hotspots to navigate between scenes with fade transitions
4. Info hotspots display tooltip text and link to external URLs
5. The prototype handles at least 2 scenes with bidirectional links

### 1.4 Non-Goals (Deferred to Phase 2+)

- Visual "studio" editor for hotspot placement
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
┌─────────────────────────────────────────────────┐
│  Wikimedia Commons Wiki                          │
│  Page: User:Fuzheado/Panellum_Tour              │
│  Content: JSON tour definition                   │
│  Fetched via: action=raw                         │
└──────────────────────┬──────────────────────────┘
                       │ HTTP GET
                       ▼
┌─────────────────────────────────────────────────┐
│  panoviewer.toolforge.org                        │
│  config.php?tour=User:Fuzheado/Panellum_Tour     │
│  ┌─────────────────────────────────────────────┐ │
│  │ 1. Detect 'tour' parameter                  │ │
│  │ 2. Fetch page from Commons API (action=raw) │ │
│  │ 3. Parse JSON, validate structure           │ │
│  │ 4. Resolve File: → Commons upload URL       │ │
│  │ 5. Return Pannellum-compatible tour JSON    │ │
│  └─────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────┘
                       │ JSON response
                       ▼
┌─────────────────────────────────────────────────┐
│  Browser: Pannellum viewer                       │
│  public_html/index.htm (existing, no changes)    │
│  Renders tour with scenes, hotspots, transitions │
└─────────────────────────────────────────────────┘
```

### 2.2 Component Changes

#### 2.2.1 New: `config.php` — Tour Mode

Add a `tour` parameter handling path in `config.php`:

```php
if (isset($_GET['tour'])) {
    // Tour mode: fetch JSON from wiki page, resolve Commons files
    handleTourRequest($_GET['tour']);
    exit;
}
```

**Logic**:
1. Sanitize the tour page title
2. Fetch page content from `https://commons.wikimedia.org/w/index.php?title={title}&action=raw`
3. JSON-decode and validate the structure
4. For each scene, resolve `panorama` field:
   - If it starts with `File:` → resolve to Commons upload URL
   - If it's a URL → use directly
5. Optionally generate multires tiles for large images
6. Return the resolved JSON

#### 2.2.2 Existing: `public_html/index.htm`

No changes needed. Pannellum's standalone viewer already accepts a `config` URL parameter pointing to a JSON config. The existing frontend already does this for single images; it works identically for tour configs.

#### 2.2.3 Existing: Multires Tile Pipeline

For Phase 1, we can bypass multires tiling and use direct Commons thumbnail/upload URLs. Pannellum has a 4096px recommended max width — many Commons 360 photos fit this. For larger images, we can use Commons' built-in thumbnail scaling (e.g., `File:Example.jpg/4096px-Example.jpg`).

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

The prototype will be a **standalone PHP script** (not deployed to Toolforge initially) that demonstrates the core concept:

1. **`tour_config.php`**: A PHP script that:
   - Accepts `?tour=PageTitle` parameter
   - Fetches the wiki page content via `action=raw`
   - Parses JSON
   - Resolves `File:` references to Commons URLs
   - Returns Pannellum-compatible JSON

2. **`tour_viewer.html`**: A standalone HTML page that:
   - Embeds Pannellum
   - Points at `tour_config.php?tour=User:Fuzheado/Panellum_Tour`
   - Renders the tour

3. **Test data**: Use the existing `User:Fuzheado/Panellum_Tour` page as the first test tour.

### 4.2 Files to Create

```
photospheres/
├── RESEARCH_REPORT.md          # ✅ Done
├── PRD.md                      # ✅ This file
├── prototype/
│   ├── tour_config.php         # PHP backend: fetch + resolve tour JSON
│   ├── tour_viewer.html        # HTML frontend: embed Pannellum + load tour
│   ├── pannellum/              # Pannellum library files (local copy)
│   │   ├── pannellum.js
│   │   └── pannellum.css
│   └── README.md               # Setup and usage instructions
```

### 4.3 Implementation Steps

1. **Clone Pannellum locally** for the viewer
2. **Write `tour_config.php`**:
   - Parse `tour` parameter
   - Fetch wiki page via `file_get_contents` or cURL
   - Extract JSON (handle optional `<syntaxhighlight>` wrapper)
   - Resolve `File:` references via Commons API
   - Output resolved JSON with CORS headers
3. **Write `tour_viewer.html`**:
   - Load Pannellum
   - Initialize with config pointing at `tour_config.php`
   - Handle the tour rendering
4. **Test** with the existing `User:Fuzheado/Panellum_Tour` page
5. **Document** the workflow for creating a new tour

### 4.4 Key Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| JSON storage format | Raw JSON as page content | Simplest parsing, no wrapper stripping needed |
| File reference resolution | Commons API `imageinfo` | Reliable, returns thumbnail URL for sizing |
| CORS handling | PHP sets `Access-Control-Allow-Origin: *` | Allows the viewer HTML to fetch from any origin |
| Error handling | Return JSON with `error` field | Pannellum can show error messages |
| Caching | File-based cache with TTL | Avoid hitting Commons API on every page load |
| Thumbnail sizing | Request 4096px width | Pannellum's recommended max for WebGL |

---

## 5. API Design

### 5.1 `tour_config.php`

**Endpoint**: `GET /tour_config.php?tour={pageTitle}`

**Parameters**:
| Parameter | Required | Description |
|---|---|---|
| `tour` | Yes | Wiki page title containing tour JSON (URL-encoded) |

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
- `tour_config.php` successfully fetches and resolves the tour JSON
- Documentation for creating a new tour from scratch
- Path identified for deploying to Toolforge
