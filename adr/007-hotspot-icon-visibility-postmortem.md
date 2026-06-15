# ADR-007: Studio Hotspot Icon Visibility — Postmortem

**Date**: 2026-06-15
**Status**: Accepted (postmortem of issue)

## Problem

Hotspot icons were invisible in the Studio viewport despite correct DOM elements and CSS classes being applied. The "Show All" cycle counter also showed unbounded values like "4 of 3".

## Root Causes

### 1. Pannellum sprite override
Pannellum sets an inline `background-image` (sprite sheet) on all hotspot elements. Our custom CSS `background` was being applied, but the `::after` pseudo-elements (➤ / ⓘ symbols) were rendered BEHIND or OBSCURED by Pannellum's sprite rendering layer. The fix required:
- `background-image: none !important` on `.pnlm-sprite` combined selectors
- Explicit `z-index: 999` on `::after` pseudo-elements

### 2. Insufficient visual contrast
The original subtle gradient backgrounds (`linear-gradient(...)`) blended into busy 360° photo backgrounds. The fix used:
- **Solid, saturated colors** — `#e94560` (red) and `#5bc0de` (blue)
- **White border** (3px) for contrast against any background
- **Glow box-shadow** (`0 0 18px + 0 0 40px`) to create a visible halo
- **Pulsing CSS animation** (`@keyframes hs-pulse`) to draw attention
- **Larger sizes** — 50px (scene) and 40px (info), up from 44px/32px

### 3. Unwrapped cycle counter
The `_cycleIdx` variable incremented without modulo wrapping:
```javascript
// BROKEN:
_cycleIdx++;  // grows forever: 1, 2, 3, 4, 5...

// FIXED:
_cycleIdx = _cycleIdx % hotspots.length;  // wrap first
_cycleIdx++;  // then increment: 1, 2, 3, 1, 2, 3...
```

### 4. `setYaw`/`setPitch` vs `lookAt`
Using `setYaw()` and `setPitch()` individually caused instant camera jumps that didn't trigger Pannellum's hotspot visibility recalculation. Switching to `lookAt(pitch, yaw, hfov)` provides smooth animation and properly updates hotspot visibility.

## Lessons

1. **Pannellum's sprite system is aggressive** — always use `!important` + combined selectors (`.custom-class.pnlm-sprite`) when overriding hotspot appearance
2. **Solid colors > gradients** for small UI elements on photo backgrounds
3. **Animation catches the eye** — a subtle pulse makes icons findable even on busy backgrounds
4. **Always wrap counters** — modulo before increment, not after
5. **Use `lookAt()` for programmatic camera movement** — it triggers the full render pipeline
