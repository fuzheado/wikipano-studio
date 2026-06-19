# Panaedit vs. Our Studio: Direct Feature Comparison

**Date**: 2026-06-18
**Purpose**: Understand what Panaedit does well, what it doesn't do, and how our tool compares

---

## What is Panaedit?

**Repository**: [laszloekovacs/panaedit](https://github.com/laszloekovacs/panaedit)
**Stack**: React + Redux + TypeScript + Vite + Tailwind
**Stars**: 8 | **Forks**: 3
**Last commit**: May 2025 (seems active, but small project)
**Live demo**: https://laszloekovacs.github.io/panaedit/ (requires local folder structure: `articles/`, `panoramas/`, `photos/`)

A web-based visual editor for Pannellum tours. Users load local image folders, place hotspots, link scenes, and export as Pannellum JSON. The README itself describes the workflow:

> "select `try online with demo assets` → from a list of images, press `add scene` → switch to editor tab → select from `scene list` → you can add a hotspot that places an info spot **at the center of the preview** → you can link scenes to eachother"

---

## Architecture Comparison

| Aspect | Panaedit | Our Studio |
|---|---|---|
| **Framework** | React + Redux + TypeScript + Vite | Vanilla JS (no framework) |
| **File size** | ~50+ React components, 11K+ lines | ~700 lines of JS |
| **State management** | Redux store with actions/reducers | Plain `state` object |
| **File I/O** | File System Access API (`showSaveFilePicker`, `showOpenFilePicker`) | Wiki pages via server API |
| **Click-to-place** | **Places at viewport CENTER** (not where you click) | **Places at exact click position** |
| **Build system** | Vite (npm install, npm run dev) | Zero deps — just `node tour_server.mjs` |
| **No server needed** | ✅ Runs entirely in browser | ❌ Requires Node.js server for wiki integration |

---

## Feature Comparison Matrix

| Feature | Panaedit | Our Studio |
|---|---|---|
| **Scene management** | ✅ Add/delete/rename scenes | ✅ Add/delete/rename scenes |
| **Scene thumbnails** | ✅ (from local files) | ✅ (from Commons 200px API) |
| **Scene-to-scene links** | ✅ (bidirectional option) | ✅ (bidirectional, via modal) |
| **Info hotspots (text)** | ✅ Basic text | ✅ Text + editable properties |
| **Web link hotspots** | ✅ (`window.open()` via click handler) | ✅ (URL + text, native Pannellum) |
| **Photo hotspots** | ✅ Image tooltip from local photos | ❌ |
| **Article hotspots** | ✅ Custom `CustomEvent` + `openArticle` | ❌ |
| **Audio hotspots** | ❌ | ✅ (Commons sound files, popup player) |
| **Video hotspots** | ❌ | ✅ (Commons/YouTube, popup overlay) |
| **Wikipedia rich cards** | ❌ | ✅ (REST API lead image + extract on hover) |
| **Floor plan editor** | ✅ Canvas-based 2D map with draggable markers | ❌ |
| **Map overview** | ❌ | ❌ |
| **Gallery strip** | ❌ | ❌ |
| **Yaw normalization** | ❌ | ✅ (-180 to 180 at capture, export, preview) |
| **JSON validation** | ❌ | ✅ (Schema validator + `--fix` auto-repair) |
| **Viewport preservation on edit** | ❌ (uses `triggerRefresh` which reloads) | ✅ (captures view before reload) |
| **URL state (`?scene=`, `?page=`)** | ❌ | ✅ (shareable scene links, replaceState) |
| **localStorage preview** | ❌ | ✅ (cross-tab, no server dependency) |
| **Import from wiki pages** | ❌ | ✅ (`?page=User:Fuzheado/Panellum_Tour`) |
| **Export scope (all/current)** | ❌ (exports entire project only) | ✅ (radio toggle: Entire project / Current scene) |
| **Export with original URLs** | ❌ (uses local paths) | ✅ (`_original` field uses canonical Commons URLs) |
| **Edit hotspot after placing** | ❌ (no post-placement editing UI) | ✅ (modal with full property editor) |
| **Click-to-place exact position** | ❌ (always center) | ✅ (captures click coordinates via Pannellum) |
| **Integrity checks** | ❌ | ✅ (validateHotspot + validateTour at all boundaries) |
| **Dev mode (click coords log)** | ✅ via Pannellum `hotSpotDebug: true` | ❌ (but simple to add) |
| **Offline asset support** | ✅ (local files, photos, articles) | ❌ (requires Commons API) |
| **Custom hotspot icons** | ⚠️ (via `cssClass` injected in code) | ⚠️ (via CSS overrides, fragile) |

---

## Panaedit's Hotspot System (Detailed)

Panaedit has **5 hotspot types** — more than we initially realized:

```ts
type: 'scene' | 'info' | 'photo' | 'article'
```

### 1. Scene links (`type: 'scene'`)
Standard Pannellum `sceneId` links. Adds at current yaw/pitch. Optional bidirectional backlink.

### 2. Info spots (`type: 'info'`)
Plain text tooltip. Places at center of view.

### 3. Article hotspots (`type: 'article'`)
Custom extension — stores `clickHandlerFuncStr` (serialized function) and `clickHandlerArgs`. Dispatches a `CustomEvent('openArticle')` that the editor listens for and renders an `ArticleViewer` panel. Clever but fragile — serializing functions into JSON is inherently risky.

### 4. Photo hotspots (`type: 'photo'`)
Stores `URL` as a path key (not blob URL). Uses `createTooltipFuncStr` to dynamically build an HTML tooltip with the photo rendered from the cache. Requires `window.getPhotoCacheFn()` to be set on the window by the Preview component.

### 5. Web link hotspots (`type: 'info'`)
Uses `clickHandlerFuncStr` to call `window.open(url, '_blank')`. Entered via `prompt()` dialog — no dedicated modal.

**Our equivalents:**
- `scene` → ✅ equivalent (better: modal to select target scene)
- `info` → ✅ equivalent (better: dedicated modal with URL + text)
- `photo` → ❌ no equivalent (not a Wikimedia use case)
- `article` → ❌ no equivalent (Wikipedia rich cards are better)
- `web link` → ✅ equivalent (via native Pannellum URL field, no custom handlers)

---

## Panaedit's Save/Load System

Panaedit uses the **File System Access API** — browser-native file picker dialogs:

```ts
// Save
const filehandle = await window.showSaveFilePicker(fileOptions);
const writable = await filehandle.createWritable();
await writable.write(JSON.stringify(cleanData, null, 2));

// Load
const [filehandle] = await window.showOpenFilePicker(fileOptions);
const file = await filehandle.getFile();
const data = JSON.parse(await file.text());
```

This is elegant for local files — no server needed, no uploads. But it means:
- The browser needs to support File System Access API (Chrome/Edge only, not Firefox/Safari)
- Tours are stored locally on the user's machine
- No collaborative editing, no revision history
- No wiki integration

**Our equivalent**: Wiki page save/load via the Node.js server → MediaWiki Action API. More complex but enables true wiki collaboration.

---

## What Panaedit Does Better

| Feature | Why It Matters |
|---|---|
| **Floor plan editor** | Canvas-based 2D map with draggable scene markers. We have nothing like this. |
| **Offline/local file support** | Works completely offline with local images. We require Commons. |
| **File System Access API** | Native save/open dialogs, no server. Better developer experience for local use. |
| **Article hotspots** | Interesting pattern — embedding articles as clickable overlays in the panorama. We'd use Wikipedia cards for this instead. |
| **Photo hotspots** | Local photo tooltips are useful for local tours. Not applicable to our Wikimedia use case. |

---

## What We Do Better

| Feature | Why It Matters |
|---|---|
| **Exact click-to-place** | Panaedit only places at viewport center. We capture where the user clicks — much more precise. |
| **Post-placement editing** | Panaedit has no way to edit a hotspot after placing it. We have a full modal. |
| **Wiki integration** | Collaborative editing, revision history, no local file management needed. |
| **Audio + video hotspots** | Panaedit has no media support. We built popup players for both. |
| **Wikipedia rich cards** | Unique feature — auto-fetches lead image + extract on Wikipedia hover. |
| **Yaw normalization** | Prevents invalid data; Panaedit doesn't validate. |
| **Export scope selector** | Export entire project or current scene only. Panaedit exports everything. |
| **URL state / shareable links** | `?scene=` and `?page=` make tours shareable. Panaedit has no URL state. |
| **localStorage preview** | Cross-tab preview without a server. |
| **Canonical URL export** | Exports use `upload.wikimedia.org` URLs, not local paths. |
| **Integrity checks** | Every data boundary validated. Panaedit has no validation. |
| **Viewport preservation** | No editing operation resets the view. Panaedit's `triggerRefresh` reloads Pannellum. |

---

## Panaedit's Author's Own Notes (from notes.md in the repo)

The notes.md file reveals what the author themselves identified as future work:

```markdown
- replace redux with zustand maybe
- separate the internal state of the editor from panellum scene file,
  generate state from it for the viewer as needed
  -> have abstract converter that can be implemented for different viewers too
- update vite, tw, remove not used frameworks
```

This is exactly the abstraction layer strategy we identified for our own migration from Pannellum to PSV. The Panaedit author recognized the same problem — tight coupling between editor state and Pannellum's schema. They didn't implement it.

---

## The Fundamental Difference

**Panaedit is a local file editor. Our studio is a wiki collaboration tool.**

That's the core distinction. They solve different problems:

| | Panaedit | Our Studio |
|---|---|---|
| **Use case** | Single user, local files, offline | Collaborative, wiki-hosted, online |
| **Storage** | Local JSON files via File System Access API | Wiki pages on Wikimedia Commons |
| **Audience** | Individual photographers/builders | Wikimedia community |
| **Collaboration** | ❌ None (file-based) | ✅ Full wiki workflows (history, talk, watch) |
| **Revision history** | ❌ None | ✅ Automatic via wiki |
| **Deployment** | Static hosting (GitHub Pages) | Node.js server on Toolforge |

Panaedit is a better local authoring experience. Our tool is a better collaborative platform. These aren't competing products — they're different solutions for different contexts.

---

## Could We Learn from Panaedit?

Yes — two things in particular:

1. **Floor plan editor**: Panaedit's canvas-based 2D floor plan with draggable scene markers is a genuinely useful feature. For museum or building tours, a floor plan overview would be valuable. This aligns well with PSV's PlanPlugin for Phase 3.

2. **The abstraction layer goal**: The Panaedit author's note about separating editor state from Pannellum's schema is exactly what we need for our PSV migration. The abstraction layer we identified in `PSV_STUDIO_MIGRATION.md` is the same concept — our editor state is viewer-agnostic, and we convert to the target library's format at render time.

---

## Summary

| | Panaedit | Our Studio |
|---|---|---|
| **Overall scope** | Broader (floor plans, articles, photos, local files) | Focused (tour authoring + wiki collaboration) |
| **Hotspot precision** | ❌ Center-only | ✅ Click-to-place |
| **Post-placement editing** | ❌ None | ✅ Full modal |
| **Media support** | Photo tooltips only | Audio + video popups |
| **Wikipedia integration** | ❌ | ✅ Rich cards |
| **Wiki storage** | ❌ | ✅ |
| **Collaborative editing** | ❌ | ✅ |
| **Yaw normalization** | ❌ | ✅ |
| **JSON validation** | ❌ | ✅ |
| **Viewport preservation** | ❌ | ✅ |
| **Export flexibility** | ❌ | ✅ (scope selector) |
| **Floor plan editor** | ✅ | ❌ |
| **Offline support** | ✅ | ❌ |
| **Code complexity** | High (React + Redux + 50+ components) | Low (~700 lines vanilla JS) |

**Bottom line**: Panaedit is a more feature-rich local editor (floor plans, articles, photos, File System Access). Our studio is a better wiki collaboration tool (wiki storage, import/export, Wikipedia cards, audio/video, validation, viewport preservation). They serve different primary audiences. Our tool's weaknesses vs. Panaedit (floor plans, offline support) are Phase 3 candidates via PSV migration. Our tool's strengths (wiki integration, exact placement, audio/video, rich cards) are unique to our use case.