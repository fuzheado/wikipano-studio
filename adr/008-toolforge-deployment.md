# ADR-008: Toolforge Deployment — New Tool vs. Extension

**Date**: 2026-06-17
**Status**: Accepted

## Context

The prototype is ready for production deployment on Toolforge. Two options exist:

1. **Extend the existing `panoviewer.toolforge.org` install** — modify the existing PHP-based tool to serve tours alongside single panoramas
2. **Create a new Toolforge tool** (`wikipano`) — deploy the Node.js prototype as a standalone tool

The existing `panoviewer` tool:
- Hosts the `{{Pano360}}` template viewer at panoviewer.toolforge.org
- Is PHP-based (older Toolforge convention)
- Has an established user base and template dependency

The prototype:
- Is Node.js-based (zero external dependencies)
- Uses `tour_server.mjs` as its entry point
- Serves its own static files (tour_viewer.html, studio.html)

## Options Considered

### Option A: Extend panoviewer
- Modify panoviewer's PHP code to also handle tour endpoints
- Add routes for `/api/tour`, studio, etc. alongside the existing viewer
- Keep the same domain

### Option B: New tool `wikipano` (Selected)
- Create a fresh Toolforge tool via `toolforge tools create wikipano`
- Deploy prototype directly to `/data/project/wikipano/`
- Use Toolforge's native Node.js backend: `webservice --backend=kubernetes node20 start`
- Separate domain: wikipano.toolforge.org
- The `{{PanoTour}}` template links to the new tool

## Decision

Create a new Toolforge tool named **`wikipano`**.

## Rationale

- **No risk to existing panoviewer** — millions of {{Pano360}} uses remain untouched
- **Zero code changes required** — prototype deploys as-is
- **Node.js native** — Toolforge's node20 backend matches our stack exactly
- **Clean separation of concerns** — single-pano viewer vs. multi-scene tours are fundamentally different products
- **Independent lifecycle** — can update, restart, or rollback without affecting panoviewer

## Trade-offs

- **+** No PHP porting needed (prototype deploys directly)
- **+** No risk of breaking existing Pano360 functionality
- **+** Dedicated subdomain (wikipano.toolforge.org) is cleaner for users and templates
- **-** Users need to learn a new tool name and URL
- **-** Two Toolforge tools to maintain instead of one

## Consequences

- The `{{PanoTour}}` Commons template must be created to link to the new tool
- Deployment is: `rsync prototype/ → /data/project/wikipano/www/js/`
- Web service start: `webservice --backend=kubernetes node20 start`
- Images and cache directories must be created with tool-group write permissions
- The panoviewer tool can remain untouched indefinitely
