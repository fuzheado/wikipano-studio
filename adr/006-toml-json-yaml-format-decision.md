# ADR-006: TOML as Hand-Editing Format, JSON as Canonical Format, YAML Excluded

**Date**: 2026-06-15
**Status**: Accepted
**Supersedes**: ADR-004 (extended)
**Superseded by**: None

## Context

Tour definitions need to support two use cases:
1. **Hand-editing on wiki** — Wikimedians typing directly into a browser textarea
2. **Programmatic generation** — tools (Studio, scripts, bots) producing tour configs

The existing `User:Fuzheado/Panellum_Tour` page was authored in TOML. Pannellum's native format is JSON. YAML was raised as a third candidate.

## Validation of Existing TOML

The existing tour page was tested against Python's built-in `tomllib` parser (Python 3.11+) and found to be **100% valid TOML**:

```
✅ Valid TOML
   autoLoad = true           # boolean
   sceneFadeDuration = 1_000 # integer with underscore separator
   yaw = -273                # negative integer
   [[scenes.Museum.hotSpots]] # array of tables
   [scenes."Road Outside"]    # quoted key in section header
```

All features used are standard TOML v1.0. No parser guesswork was required.

## Options Considered

| Format | Hand-edit friendly | Whitespace-sensitive | Pannellum native | Existing tours |
|---|---|---|---|---|
| **JSON** | ⚠️ No comments, strict commas | No | ✅ | ❌ |
| **TOML** | ✅ Comments, clean syntax | No | ❌ (needs conversion) | ✅ |
| **YAML** | ✅ Very readable | ✅ Yes — fragile | ❌ | ❌ |

## Decision

**Support both JSON and TOML. Exclude YAML.**

JSON is the canonical format — what Pannellum consumes, what the Studio exports, what schema validation targets. TOML is the hand-editing format — what humans write on wiki pages.

The server auto-detects format (`try JSON → fallback TOML`) and normalizes to JSON for Pannellum.

YAML is excluded because its significant-whitespace requirement (exact indentation) is fragile in browser textareas. A single stray space or tab character silently breaks the entire document. TOML's whitespace-agnostic `[section]` headers are far more robust for wiki editing.

## Rationale

1. **Backward compatibility**: The existing TOML tour works without modification.
2. **No migration forced**: TOML authors can keep using TOML. JSON authors can use JSON. Tools can emit either.
3. **Zero-cost TOML support**: The parser is ~60 lines of JavaScript with no dependencies. It handles the subset of TOML used by tour definitions (sections, arrays of tables, strings, numbers, booleans).
4. **YAML fragility**: Indentation-sensitive formats cause silent failures in wiki editing environments where copy-paste, tab characters, and inconsistent spacing are common.
5. **Two-format ceiling**: Adding a third format increases cognitive load without proportional benefit. TOML and JSON together cover the full spectrum of use cases.

## Consequences

- `extractTourDefinition()` tries JSON first, then TOML
- `_meta.sourceFormat` in API response indicates which was used
- Studio exports JSON (can add TOML export later if requested)
- Documentation covers both formats with examples
- YAML support will not be added
- A `_comment` convention in JSON (`"_comment": "..."`) partially mitigates JSON's lack of comments
