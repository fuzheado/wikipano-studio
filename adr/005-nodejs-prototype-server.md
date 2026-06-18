# ADR-005: Node.js Prototype Server, Node.js on Toolforge

**Date**: 2026-06-17
**Status**: Accepted
**Supersedes**: ADR-005 v1 (2026-06-13)

## Context

The prototype uses Node.js for local development (zero deps, `node tour_server.mjs`). For Phase 2.5 Toolforge deployment, we had two options:

1. **Modify existing panoviewer tool** — port Node.js logic to PHP, integrate into `panoviewer.toolforge.org`
2. **Create a new Toolforge tool** — deploy the Node.js prototype directly as a brand new tool

The original ADR-005 (v1) assumed option 1 (PHP target). We now adopt option 2.

## Why a New Tool Instead of Modifying Panoviewer

Toolforge supports Node.js natively as a first-class web service backend:
```
webservice --backend=kubernetes node start
```

The existing `tour_server.mjs` uses **zero external dependencies** — only Node.js built-in modules (`node:http`, `node:fs`, `node:crypto`, `node:path`, `node:url`). It runs as-is on Toolforge without any porting.

Modifying `panoviewer.toolforge.org` would require PHP porting, coordination with the existing tool's maintainers, and potential conflicts — all avoidable.

## Decision

**Use Node.js for local development and deploy the prototype directly as a new Toolforge tool.**

## Implementation

### Local Development
```bash
cd prototype
node tour_server.mjs
# Serves on http://localhost:8765/
```

### Toolforge Deployment
```bash
# 1. Create the tool
ssh login.toolforge.org toolforge tools create wikipano

# 2. Deploy files
rsync -avz ./prototype/ user@login.toolforge.org:/data/project/wikipano/

# 3. Start Node.js web service
ssh login.toolforge.org "become wikipano; webservice --backend=kubernetes node start"
```

The `tour_server.mjs` file is the web service entry point (Node.js detects it automatically on the `node` backend). No wrapper script needed.

## Server Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/tour?page=...` | Fetch + parse tour JSON from Commons wiki page |
| `GET /api/resolve?file=...` | Resolve `File:` → cached image path |
| `GET /api/resolve-url?url=...` | Cache + resolve direct URL |
| `POST /api/preview` / `GET /api/preview/:key` | Server-side preview storage |
| `GET /` | Static file server (tour_viewer.html, studio.html, cached images) |

## Trade-offs

| | New Tool | Integrate with Panoviewer |
|---|---|---|
| Code porting | ✅ None — deploy as-is | ❌ Node.js → PHP |
| Maintenance | ✅ Independent versioning, release cycle | ❌ Coupled to panoviewer release |
| Coordination | ✅ No outside maintainers needed | ❌ Requires panoviewer maintainer buy-in |
| URL | `wikipano.toolforge.org` | `panoviewer.toolforge.org/tours/...` |
| TOML parser | Native JS | Must reimplement in PHP |

## Consequences

- `tour_config.php` remains as a standalone PHP reference (for environments that need it), but is not deployed
- The tool name is `wikipano` — not part of `panoviewer`
- Phase 2.5 scope reduces to: create tool, deploy, create `{{PanoTour}}` template
- Multires tiling pipeline can be built in Node.js rather than adapted from panoviewer's Python scripts