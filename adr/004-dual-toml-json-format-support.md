# ADR-004: Dual TOML + JSON Format Support

**Date**: 2026-06-13
**Status**: Accepted
**Superseded by**: None

## Context

Tour definitions need to be stored on wiki pages. Two natural format options emerged during prototyping:

1. **TOML**: The existing `User:Fuzheado/Panellum_Tour` tour is authored in TOML, wrapped in `<nowiki>` tags. This is what a human naturally wrote. TOML is readable, comment-friendly, and familiar to developers.
2. **JSON**: The format Pannellum consumes natively. Easier for tools to generate, validate against schema, and parse programmatically. Supported by every language.

We discovered this during prototype testing — the initial code assumed JSON, but the live wiki page was TOML.

## Options Considered

| Option | Human-friendly | Tool-friendly | Existing Content |
|---|---|---|---|
| JSON only | ⚠️ No comments, strict syntax | ✅ | ❌ Would break existing tour |
| TOML only | ✅ Comments, cleaner syntax | ⚠️ Fewer tools, needs conversion | ✅ Existing tour |
| **Both (auto-detect)** | ✅ | ✅ | ✅ |

## Decision

**Support both TOML and JSON formats with automatic detection.**

## Implementation

The `extractTourDefinition()` function tries parsing strategies in order:

1. Strip `<nowiki>` and `<pre>` wrappers (MediaWiki may add these)
2. Try `JSON.parse()` — if it succeeds, return as JSON
3. If content looks TOML-like (starts with `key =`, `[section]`, or `[[array]]`), parse as TOML
4. Last resort: HTML-entity-decode and try JSON again

```javascript
function extractTourDefinition(content) {
    // Strip wiki wrappers
    // Try JSON first
    try { return { format: 'json', data: JSON.parse(inner) }; } catch {}
    // Try TOML
    if (/^\s*(\w+\s*=|\[)/m.test(inner)) return { format: 'toml', data: parseTOML(inner) };
    // Last resort
    try { return { format: 'json', data: JSON.parse(inner) }; } catch {}
    throw new Error('Could not parse tour definition');
}
```

## Rationale

1. **Backward compatibility**: The existing TOML tour on Commons works without modification.
2. **Future flexibility**: Tools (like the Phase 2 Visual Studio) can output JSON, while humans can hand-edit TOML.
3. **No migration needed**: TOML users don't need to convert their tours.
4. **Format is an implementation detail**: The system converts everything to the same internal representation before passing to Pannellum.

## Trade-offs

- **Parser maintenance**: The TOML parser must handle the subset of TOML used in tour definitions (sections, arrays of tables, strings, numbers, booleans). Not a full TOML parser, but enough for the tour use case.
- **Format ambiguity edge case**: If content could be valid in both formats, JSON is tried first. In practice, the formats are syntactically distinct enough that this isn't an issue.
- **TOML subset risk**: If someone uses advanced TOML features (inline tables, multiline strings, dates), parsing may fail. Mitigated by documentation and future validation.

## Consequences

- `_meta.sourceFormat` in API response indicates which format was detected
- Documentation covers both formats with examples
- Visual Studio will likely default to JSON output
- If TOML edge cases cause problems, a JSON-only recommendation can be phased in
