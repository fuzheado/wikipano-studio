# ADR-001: Use Pannellum for Phase 1 Viewer

**Date**: 2026-06-13
**Status**: Accepted
**Superseded by**: None

## Context

We need a 360° panorama viewer that can render photosphere tours — multiple equirectangular images linked by clickable hotspots with fade transitions. The viewer must be:
- Open source (MIT or compatible)
- Self-hostable (no external service dependency)
- Compatible with Wikimedia Commons image hosting
- Capable of tour mode (scene-to-scene navigation)

## Options Considered

| Library | License | Tour Support | Active Dev | Wikimedia Deployed? |
|---|---|---|---|---|
| **Pannellum** | MIT | ✅ Built-in | ⚠️ Slow but active (v2.5.7, Feb 2026) | ✅ panoviewer.toolforge.org |
| **Photo-Sphere-Viewer** | MIT | ✅ VirtualTourPlugin | ✅ Very active (v5.14.1, Jan 2026) | ❌ |
| **Marzipano** | Apache 2.0 | ✅ Via desktop tool | ❌ Dormant (last push Oct 2023) | ❌ |
| **View360 (Naver)** | MIT | ❌ No tour mode | ⚠️ Newer, smaller | ❌ |

## Decision

**Use Pannellum for Phase 1.** Defer evaluation of Photo-Sphere-Viewer to Phase 3.

## Rationale

1. **Existing deployment**: Pannellum is already running on Toolforge as `panoviewer.toolforge.org` with the `{{Pano360}}` template integrated into Commons. This proves the technology works in Wikimedia's environment. We deploy our own tool but benefit from Pannellum's proven battle-tested reliability.

2. **Community familiarity**: Wikimedia editors already know the `{{Pano360}}` → panoviewer flow. Adding tour support with a `{{PanoTour}}` template follows the same pattern.

3. **Proven reliability**: Pannellum has been serving Commons 360° images since 2016 on `panoviewer.toolforge.org`. The multires tiling pipeline, caching, and Commons image resolution are all battle-tested on Wikimedia infrastructure.

4. **Tour features sufficient for Phase 1**: Pannellum's built-in tour mode supports scene transitions, `scene` and `info` hotspot types, fade animations, custom tooltips, and `hotSpotDebug` for coordinate placement.

## Trade-offs

- **Limited plugin ecosystem** vs Photo-Sphere-Viewer's rich plugin set (maps, galleries, GPS, compass). Acceptable for Phase 1; re-evaluate in Phase 3.
- **Monolithic architecture** (no plugin system) limits extensibility.
- **Slow NPM releases** — master branch has features not yet on npm. Mitigated by using the CDN build directly.
- **No TypeScript** — maintenance burden is higher.

## Consequences

- Phase 1 prototype uses Pannellum from CDN (jsDelivr)
- Tour JSON format is Pannellum-compatible (but library-agnostic enough for future migration)
- Phase 2 Visual Studio will embed Pannellum for the editing viewport
- Phase 3 will evaluate whether Photo-Sphere-Viewer's richer feature set justifies migration
