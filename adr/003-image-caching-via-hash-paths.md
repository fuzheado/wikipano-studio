# ADR-003: Image Caching via SHA-256 Hash File Paths

**Date**: 2026-06-13
**Status**: Accepted
**Supersedes**: Earlier base64url proxy approach (discarded)

## Context

Pannellum needs to load 360° equirectangular images to render as WebGL textures. In the prototype, images come from Wikimedia Commons (`upload.wikimedia.org`). Loading them directly from Commons causes two problems:

1. **CORS issues**: While Commons sets `Access-Control-Allow-Origin: *`, Pannellum's XHR-based image loading can hit intermittent failures in real browsers.
2. **Network reliability**: Large images (5-8MB) from Commons CDN can timeout or fail on slow connections.

The production `panoviewer.toolforge.org` solves this by proxying all images through its PHP backend.

## Iterations

### Attempt 1: Direct Commons URLs (discarded)
Passed raw `https://upload.wikimedia.org/...` URLs to Pannellum. Caused "could not be accessed" errors in real browsers despite working in headless Chrome.

### Attempt 2: Base64URL Proxy (discarded)
Encoded Commons URLs as base64url, served through `/api/image/<key>` endpoint. Pannellum failed to load these long, complex proxy URLs. Root cause: the base64-encoded URLs were too long and contained characters that Pannellum's URL handling couldn't process reliably.

### Attempt 3: Hash-Based Cache Paths (accepted)
Download images from Commons, cache them locally, and serve through simple paths like `/images/abc123.jpg`.

## Decision

**Cache Commons images locally using SHA-256 hash filenames, served as static files.**

## Implementation

```javascript
function cacheImage(sourceUrl) {
    const hash = createHash('sha256').update(sourceUrl).digest('hex').substring(0, 16);
    const ext = sourceUrl.match(/\.(jpg|jpeg|png|webp)(\?|$)/i)?.[1] || 'jpg';
    const filename = `${hash}.${ext}`;  // e.g., "3b3625c00fa4245e.jpg"
    // Download, save to images/, return path
    return `/images/${filename}`;
}
```

## Rationale

1. **Simple, short paths**: `/images/3b3625c00fa4245e.jpg` — Pannellum handles these without issues.
2. **Same-origin serving**: No CORS concerns; images are on the same domain as the viewer.
3. **No special routing**: The existing static file server handles `/images/*` automatically.
4. **Deterministic**: Same Commons URL always produces the same cache filename (idempotent).
5. **Self-cleaning**: Old cached images can be cleaned by TTL or disk space monitoring.
6. **Matches production pattern**: panoviewer already downloads and caches Commons images.

## Trade-offs

- **Disk usage**: Cached images consume local storage. Mitigated by 1-hour TTL and small number of images per tour.
- **Cold start latency**: First load downloads from Commons (5-8MB). Mitigated by 1-hour cache; future loads are instant.
- **Not suitable for serverless**: Requires persistent disk. Fine for Toolforge (NFS available).

## Consequences

- `images/` directory holds cached JPEGs with 1-hour TTL
- API returns paths like `/images/<hash>.jpg` for each scene's `panorama` field
- Future Toolforge deployment can reuse the existing panoviewer NFS cache
