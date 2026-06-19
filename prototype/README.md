# Phase 1 & 2 Prototype: Wikimedia Photosphere Tour System

## What This Does

Enables viewing and authoring 360° photosphere tours defined as JSON/TOML pages on Wikimedia Commons. The Node.js server resolves `File:` references to actual image URLs and renders tours using Pannellum.

## Architecture

```
Wiki Page (JSON/TOML) ──→ tour_server.mjs (resolves File: refs, caches images) ──→ Pannellum (renders tour)
                                       │
                                       └──→ Studio (visual editor)
```

## Quick Start

### Live (Toolforge)
- **Tour Viewer**: https://wikipano.toolforge.org/tour_viewer.html#User:Fuzheado/Panellum_Tour
- **Visual Studio**: https://wikipano.toolforge.org/studio.html?page=User:Fuzheado/Panellum_Tour

### Local Development

**Requires**: Node.js 18+ (zero external dependencies)

```bash
cd prototype
node tour_server.mjs
# Open http://localhost:8765/studio.html
# Demo: http://localhost:8765/studio.html?page=User:Fuzheado/Panellum_Tour
```

The demo auto-loads the Banned Books Museum ↔ Tallinn road tour from `User:Fuzheado/Panellum_Tour` on Commons.

### Using a Different Tour

Enter any Commons wiki page title containing tour JSON/TOML, e.g.:
- `User:Fuzheado/Panellum_Tour` (the demo tour)
- `User:YourName/MyTour` (your own tour)

Or use the URL hash:
```
http://localhost:8765/tour_viewer.html#User:YourName/MyTour
```

## Files

| File | Purpose |
|---|---|
| `tour_server.mjs` | Node.js server: API, static files, image caching (entry point) |
| `tour_viewer.html` | Pannellum viewer with scene navigation + Wikipedia cards |
| `studio.html` | Visual tour editor UI |
| `studio.js` | Editor logic (~650 lines) |
| `tour_config.php` | Standalone PHP equivalent (reference only, not used) |
| `sample_tour.json` | Example tour definition |
| `HOW_TO_CREATE_A_TOUR.txt` | Tutorial for wiki-based tour authoring |
| `cache/` | Auto-created directory for cached Commons images |
| `images/` | Auto-created directory for served cached images |

## Features

### Viewing
- Pannellum-based 360° rendering with scene transitions
- Wikipedia rich info cards on hotspot hover
- Mobile gyroscope toggle (🧭 button, requires HTTPS)
- Audio 🎵 and Video 🎬 hotspot support
- Scene sidebar with thumbnails

### Authoring
- Click in 360° viewport to place hotspots
- Scene management (add/delete/reorder)
- Import from Commons wiki pages or paste JSON
- Export as JSON (download or copy, full or current scene)
- Preview via localStorage
- Yaw auto-normalized to [-180, 180]
- Icon size variants (`iconStyle`: normal, small, large, huge)
- Integrity checks at all data boundaries

## Creating a New Tour

See `HOW_TO_CREATE_A_TOUR.txt` for TOML and JSON format templates.

Quick start:
1. Upload 360° photos to Commons
2. Create a wiki page at `User:YourName/YourTour`
3. Paste the TOML or JSON tour definition
4. View at `http://localhost:8765/tour_viewer.html#User:YourName/YourTour`

## Tour JSON Format

### `default` section
| Field | Required | Description |
|---|---|---|
| `firstScene` | ✅ | ID of the first scene to display |
| `author` | No | Author name shown in viewer |
| `sceneFadeDuration` | No | Fade animation duration in ms (default: 1000) |

### `scenes` section — each scene
| Field | Required | Description |
|---|---|---|
| `panorama` | ✅ | `File:Example.jpg` (Commons file) or direct URL |
| `type` | No | `equirectangular` (default) |
| `title` | No | Scene title |
| `hfov` | No | Initial horizontal field of view (default: 100) |
| `pitch` | No | Initial pitch in degrees |
| `yaw` | No | Initial yaw in degrees |
| `hotSpots` | No | Array of hotspot objects |

### Hotspot types

**Scene link** (navigates to another scene):
```json
{
    "pitch": -17.35,
    "yaw": 33.77,
    "type": "scene",
    "text": "Go to Museum",
    "sceneId": "museum",
    "targetYaw": 0,
    "targetPitch": 0
}
```

**Info hotspot** (shows tooltip, links to URL):
```json
{
    "pitch": -15,
    "yaw": -30,
    "type": "info",
    "text": "Learn more",
    "URL": "https://en.wikipedia.org/wiki/Example"
}
```

**Audio hotspot** (plays sound):
```json
{
    "pitch": -10,
    "yaw": 20,
    "type": "info",
    "hotspotSubtype": "audio",
    "text": "Listen",
    "audioUrl": "https://upload.wikimedia.org/wikipedia/commons/.../file.ogg"
}
```

**Video hotspot** (popup player):
```json
{
    "pitch": -5,
    "yaw": 45,
    "type": "info",
    "hotspotSubtype": "video",
    "text": "Watch",
    "videoUrl": "https://upload.wikimedia.org/wikipedia/commons/.../video.webm"
}
```

**Icon size variant** (applies to any hotspot type):
```json
{
    "iconStyle": "large",
    ...
}
```
Values: `normal` (default, 44-50px), `small` (32px), `large` (60px), `huge` (80px).

For a full reference of Pannellum configuration options, see:
https://pannellum.org/documentation/reference/

## How File Resolution Works

When a scene has `"panorama": "File:Example.jpg"`:

1. The server calls the Commons API (`action=query&prop=imageinfo`)
2. Gets the direct upload URL
3. Downloads and caches the image locally (SHA-256 hash path)
4. Serves from `/images/<hash>.jpg` (avoids CORS)

Direct URLs (`https://...`) are proxied and cached the same way. Image cache has a 1-hour TTL.

## Deploying to Toolforge

See `../DEPLOYMENT.md` for the complete step-by-step guide.

Quick steps:
```bash
# Create tool
ssh login.toolforge.org
toolforge tools create wikipano

# Deploy
rsync -avz --exclude='node_modules' --exclude='cache' --exclude='images' \
    ./ alih@login.toolforge.org:/data/project/wikipano/www/js/

# Start
ssh alih@login.toolforge.org "become wikipano; webservice --backend=kubernetes node20 start"
```

## Limitations (Phase 1 & 2)
- No OAuth authentication (tour pages are manually edited on wiki)
- No multires tiling (uses direct Commons URLs/thumbnails)
- No mobile-optimized studio (authoring is desktop-oriented)
- File caching is file-based (not suitable for multi-server deployment)

## Before Editing Code
Read `../CAVEATS.md` — 15 gotchas from hard-won debugging sessions (Pannellum 2.5.7 quirks, hotspot CSS, yaw normalization, etc.).
