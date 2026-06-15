# ADR-005: Node.js Prototype Server with PHP Production Path

**Date**: 2026-06-13
**Status**: Accepted
**Superseded by**: None

## Context

The prototype needs a server to:
1. Serve the viewer HTML and static files
2. Provide a tour API endpoint (`/api/tour?page=...`)
3. Cache and serve Commons images

The eventual production deployment target is **Toolforge**, where the existing `panoviewer.toolforge.org` runs on a PHP backend. However, PHP is not available in the local development environment.

## Options Considered

| Option | Local Dev | Toolforge Compatible | Dependencies | Iteration Speed |
|---|---|---|---|---|
| **Node.js prototype** | ✅ Available | ❌ Needs porting | None (built-in modules) | ✅ Fast |
| Python | ✅ Available | ❌ Needs porting | None | ✅ Fast |
| PHP directly | ❌ Not available locally | ✅ Native | None | ❌ Can't test locally |

## Decision

**Use Node.js for the local prototype with zero external dependencies. Keep a PHP version ready for Toolforge deployment.**

## Implementation

The prototype server (`tour_server.mjs`) uses only Node.js built-in modules:
- `node:http` — HTTP server
- `node:fs/promises` — file I/O and caching
- `node:crypto` — SHA-256 hashing for cache filenames
- `node:path`, `node:url` — path resolution and URL parsing

The `tour_config.php` file contains equivalent logic in PHP for future Toolforge deployment.

## Rationale

1. **Zero installation**: `node tour_server.mjs` — that's it. No `npm install`, no `composer install`, no virtual environments.
2. **Rapid iteration**: Changes are tested immediately; no build step.
3. **Modern JS features**: `fetch()` API, async/await, ES modules — clean, readable code.
4. **PHP path preserved**: The `tour_config.php` file captures the same logic in PHP syntax, making Toolforge porting straightforward.
5. **Python also available**: If needed, `python3 -m http.server` can serve static files for simple testing.

## Trade-offs

- **Porting required**: The Node.js server must be ported to PHP for Toolforge deployment. Mitigated by:
  - Simple, well-documented logic (few hundred lines)
  - `tour_config.php` already written as a reference
  - The core API logic is straightforward: fetch page → parse → resolve files → cache images → return JSON
- **No hot reload**: Server must be restarted on changes. Acceptable for prototype.
- **Single-threaded**: Node.js serves requests sequentially. Fine for single-user prototype; Toolforge deployment would use PHP-FPM or similar.

## Consequences

- Development uses `node tour_server.mjs`
- `tour_config.php` is kept in sync with the Node.js logic (manually)
- Phase 1.5 (Toolforge deployment) will port the server logic to the existing panoviewer PHP codebase
- The TOML parser would need to be reimplemented in PHP (or use an existing library)
