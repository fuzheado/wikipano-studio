# Phase 1 Prototype: Wiki-Based Photosphere Tour Viewer

## What This Does

Enables viewing a 360° photosphere tour defined as a JSON page on Wikimedia Commons. The tour JSON lives on a wiki page (collaboratively editable), and this prototype resolves `File:` references to actual image URLs and renders the tour using Pannellum.

## Architecture

```
Wiki Page (JSON) ──→ tour_config.php (resolves File: refs) ──→ Pannellum (renders tour)
```

## Quick Start

### Prerequisites
- PHP 7.4+ with `allow_url_fopen` enabled (or cURL extension)
- A web browser with WebGL support

### Run Locally

```bash
cd prototype
php -S localhost:8000
```

Then open: **http://localhost:8000/tour_viewer.html**

The demo auto-loads the example tour at `User:Fuzheado/Panellum_Tour` on Commons.

### Using a Different Tour

Enter any Commons wiki page title containing tour JSON, e.g.:
- `User:Fuzheado/Panellum_Tour` (the demo tour)
- `User:YourName/MyTour` (your own tour)

Or use the URL hash:
```
http://localhost:8000/tour_viewer.html#User:Fuzheado/Panellum_Tour
```

## Creating a New Tour

1. Create a wiki page on Commons (e.g., `User:YourName/MyTour`)
2. Add JSON in this format:

```json
{
    "default": {
        "firstScene": "scene1",
        "author": "Your Name",
        "sceneFadeDuration": 1000
    },
    "scenes": {
        "scene1": {
            "title": "My First Scene",
            "hfov": 110,
            "pitch": 0,
            "yaw": 0,
            "type": "equirectangular",
            "panorama": "File:Your_360_Photo.jpg",
            "hotSpots": [
                {
                    "pitch": 0,
                    "yaw": 45,
                    "type": "scene",
                    "text": "Go to Scene 2",
                    "sceneId": "scene2"
                },
                {
                    "pitch": -10,
                    "yaw": -30,
                    "type": "info",
                    "text": "Learn more on Wikipedia",
                    "URL": "https://en.wikipedia.org/wiki/Example"
                }
            ]
        },
        "scene2": {
            "title": "My Second Scene",
            "type": "equirectangular",
            "panorama": "File:Another_Photo.jpg",
            "hotSpots": []
        }
    }
}
```

3. Save the page
4. Load it in the viewer: `http://localhost:8000/tour_viewer.html#User:YourName/MyTour`

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
    "text": "The Satanic Verses",
    "URL": "https://en.wikipedia.org/wiki/The_Satanic_Verses"
}
```

For a full reference of Pannellum configuration options, see:
https://pannellum.org/documentation/reference/

## Files

| File | Purpose |
|---|---|
| `tour_config.php` | Backend: fetches wiki page, resolves File: refs, returns JSON |
| `tour_viewer.html` | Frontend: Pannellum viewer with scene navigation sidebar |
| `cache/` | Auto-created directory for resolved file URL cache |

## How File Resolution Works

When a scene has `"panorama": "File:Example.jpg"`:

1. The backend calls the Commons API (`action=query&prop=imageinfo`)
2. Gets the direct upload URL and a 4096px thumbnail URL
3. If the image is wider than 4096px, uses the thumbnail (WebGL compatibility)
4. Results are cached for 1 hour

Direct URLs (`https://...`) are passed through unchanged.

## Limitations (Phase 1)

- No visual hotspot editor (use `hotSpotDebug: true` in config and browser console)
- No OAuth authentication (tour pages are manually edited on wiki)
- No multires tiling (uses direct Commons URLs/thumbnails)
- CORS requires running behind a web server (local PHP dev server works)
- File caching is file-based (not suitable for multi-server deployment)

## Deploying to Toolforge

To deploy on Toolforge as an extension of panoviewer:

1. Add `tour_config.php` to the panoviewer tool directory
2. Ensure `cache/` directory is writable on NFS
3. The existing `public_html/` frontend already embeds Pannellum
4. Update `{{Pano360}}` template or create a `{{PanoTour}}` template that generates links like:
   ```
   https://panoviewer.toolforge.org/#tour=User:Example/MyTour
   ```

## Next Steps (Phase 2)

- Visual "studio" editor for hotspot placement
- OAuth-based authentication for saving tours back to wiki
- Tour validation (2:1 ratio check, GPano metadata verification)
- `{{PanoTour}}` Commons template for easy tour discovery
