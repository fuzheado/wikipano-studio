# Architecture Decision Records

This directory captures significant architectural decisions made during the development of the Wikimedia Photosphere Tour system.

Each ADR describes a decision, the context that led to it, the options considered, the rationale for the choice, and the consequences.

## Index

| ADR | Title | Status |
|---|---|---|
| [001](001-use-pannellum-for-phase-1.md) | Use Pannellum for Phase 1 Viewer | Accepted |
| [002](002-wiki-page-as-tour-definition.md) | Wiki Pages as Tour Definition Storage | Accepted |
| [003](003-image-caching-via-hash-paths.md) | Image Caching via SHA-256 Hash File Paths | Accepted |
| [004](004-dual-toml-json-format-support.md) | Dual TOML + JSON Format Support | Accepted |
| [006](006-toml-json-yaml-format-decision.md) | TOML/JSON/YAML Format Decision — JSON Canonical, TOML Supported, YAML Excluded | Accepted |
| [007](007-hotspot-icon-visibility-postmortem.md) | Studio Hotspot Icon Visibility — Postmortem | Accepted |
| [008](008-toolforge-deployment.md) | Toolforge Deployment — New Tool vs. Extension | Accepted |

## Template

New ADRs should follow this structure:
```markdown
# ADR-NNN: Title

**Date**: YYYY-MM-DD
**Status**: Proposed | Accepted | Deprecated | Superseded
**Superseded by**: ADR-NNN (if applicable)

## Context
## Options Considered
## Decision
## Rationale
## Trade-offs
## Consequences
```
