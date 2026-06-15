# ADR-002: Wiki Pages as Tour Definition Storage

**Date**: 2026-06-13
**Status**: Accepted
**Superseded by**: None

## Context

360° photosphere tours need a definition format that specifies:
- Which Commons images to use for each scene
- Where hotspots are placed (yaw/pitch coordinates)
- How scenes link together
- Metadata (author, title, transitions)

This definition needs to be collaboratively edited by Wikimedians, version-controlled, and accessible to both human editors and automated tools.

## Options Considered

| Option | Collaboration | Tool-friendly | Existing Practice |
|---|---|---|---|
| **Wiki page (raw JSON/TOML)** | ✅ Full wiki features | ✅ Easy to parse | ✅ User:Fuzheado/Panellum_Tour already exists |
| **Commons template-based** | ✅ Familiar wiki syntax | ❌ Complex to parse nested structures | ⚠️ Would require new template system |
| **Scribunto/Lua data module** | ⚠️ Lua-only editors | ⚠️ Not standard JSON | ❌ No existing practice |
| **External database** | ❌ Separate auth, no wiki history | ✅ Full control | ❌ Against Wikimedia practices |

## Decision

**Store tour definitions as wiki pages with raw JSON or TOML content.**

## Rationale

1. **Zero new infrastructure**: Wiki pages already have revision history, talk pages, watchlists, user permissions, and API access. No database, no auth system, no new storage to maintain.

2. **Proven model**: The existing `User:Fuzheado/Panellum_Tour` page already demonstrates this pattern — a TOML tour definition stored on Commons, collaboratively editable.

3. **API simplicity**: `action=raw` returns the page content directly, making it trivial for tools to fetch and parse.

4. **Wiki collaboration benefits**: Edit history shows who changed what. Talk pages allow discussion. Watchlists notify contributors of changes. Reverting bad edits is a single click.

5. **Two format support discovered during prototype**:
   - **TOML**: Easier for humans to read and edit by hand on wiki (the existing tour uses this)
   - **JSON**: Easier for tools to generate and parse programmatically
   - The system auto-detects format from content

## Trade-offs

- **Merge conflicts** on large tours if multiple people edit simultaneously (mitigated by wiki edit conflict detection)
- **No schema enforcement** — invalid tours are caught at render time rather than edit time (mitigated by validation in the API and future editor)
- **JSON/TOML not visually rich** for non-technical editors (mitigated by Phase 2 Visual Studio, which will provide a GUI)

## Consequences

- Tour definitions live on Commons wiki pages (user space for now, possibly a dedicated `/Tour:` namespace later)
- The `tour_server.mjs` fetches pages via `action=raw` and auto-detects format
- Future Visual Studio will use OAuth to write back to wiki pages
- `{{PanoTour}}` template can wrap wiki page links for discovery
