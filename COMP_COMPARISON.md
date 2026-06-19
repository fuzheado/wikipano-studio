# Competitive Comparison & Strategic Recommendations

> **Date**: 2026-06-18
> **Purpose**: Head-to-head comparison of Matterport, Kuula, and our Wikimedia Photosphere Tours project, with actionable recommendations for Phase 2.5 deployment and Phase 3 features.

---

## 1. Positioning Map

```
                    SIMPLE ◄────────────────────────► COMPLEX
                      │                                   │
             Kuula    │                    Matterport     │
          ($12/mo)    │                  ($55-309/mo)     │
          Any camera  │               Proprietary cam     │
          2D panos    │                 3D mesh model     │
          Quick pub   │                2-8hr processing   │
                      │                                   │
                      │      ╔═══════════════════╗        │
                      │      ║  WIKIMEDIA TOURS  ║        │
                      │      ║      (OURS)       ║        │
                      │      ║  Free / Open       ║        │
                      │      ║  Wiki-collaborative║        │
                      │      ║  Pannellum-based   ║        │
                      │      ╚═══════════════════╝        │
                      │                                   │
                   FLAT 360°                    SPATIAL 3D
```

**Our positioning**: The only **free, open-source, wiki-collaborative** 360° tour platform. We occupy a unique quadrant — simpler than Matterport, more open than Kuula, with collaboration features neither offers.

---

## 2. Three-Way Feature Comparison

### 2.1 Core Technology

| | Matterport | Kuula | Wikimedia Tours (Ours) |
|---|---|---|---|
| **Rendering engine** | Proprietary 3D | Proprietary 360° | Pannellum 2.5.7 (MIT) |
| **3D mesh model** | ✅ Yes | ❌ No | ❌ No |
| **Data format** | Proprietary | Proprietary | Open JSON + TOML on wiki |
| **Viewer license** | Proprietary | Proprietary | MIT (Pannellum) |
| **Storage** | Matterport Cloud | Kuula servers | Wikimedia Commons wiki pages |
| **Hosting cost** | $55-309/mo | $12-36/mo | Free (Toolforge) |

### 2.2 Capture & Processing

| | Matterport | Kuula | Ours |
|---|---|---|---|
| **Hardware required** | Pro3 ($6K) or LiDAR phone | Any 360° camera | Any 360° camera → Commons upload |
| **Processing time** | 2-8 hours (cloud) | Instant | Instant (no processing) |
| **Depth data** | ✅ LiDAR/depth sensors | ❌ No | ❌ No |
| **Auto floor plans** | ✅ Generated from mesh | ❌ Manual upload only | ❌ No |
| **Measurements** | ✅ Point-to-point, area | ❌ No | ❌ No |

### 2.3 Tour Navigation

| | Matterport | Kuula | Ours |
|---|---|---|---|
| **Scene transitions** | Smooth 3D walk | Fade/crossfade/wipe | Fade (Pannellum `sceneFadeDuration`) |
| **Click-to-navigate** | White pucks on floor | Hotspots or Click Anywhere | Hotspots only |
| **Walkthrough alignment** | Built-in (3D nav) | Walkthrough Mode (aligns camera orientation) | ❌ No — each scene loads its default view |
| **Dollhouse view** | ✅ Yes | ❌ No | ❌ No |
| **Floor plan overlay** | ✅ Auto-generated | ✅ Manual upload image | ❌ No |
| **Free exploration** | ✅ Click anywhere on floor | ✅ Click Anywhere (Pro) | ❌ Hotspots only |

### 2.4 Hotspot System

| | Matterport | Kuula | Ours |
|---|---|---|---|
| **Scene links** | ✅ (pucks) | ✅ | ✅ (➤ red) |
| **Info popups** | ✅ (Tags) | ✅ (Interactive Cards) | ✅ (ⓘ blue) |
| **Audio hotspots** | Via embed in Tags | ✅ Dedicated audio | ✅ (🎵 green) |
| **Video hotspots** | Via embed in Tags | ✅ Dedicated video | ✅ (🎬 purple) |
| **Wikipedia cards** | ❌ No | ❌ No | ✅ **Unique feature** |
| **Click-to-place** | ✅ In 3D space | ✅ In viewport | ✅ In viewport |
| **Icon customization** | Color + stem length | Color, size (600%), animation, custom SVG/PNG, 3D rotation, opacity | 4 size variants (`iconStyle`) |
| **Backlinks** | ❌ No | ✅ 50% time savings | ❌ No |
| **Masters (batch)** | ❌ No | ✅ Apply to all scenes | ❌ No |
| **Drag-to-connect** | ❌ No | ✅ Drag thumbnail | ❌ No |
| **Invisible hotspots** | ❌ No | ✅ (opacity 0 + 600% size) | ❌ No |

### 2.5 Rich Content

| | Matterport | Kuula | Ours |
|---|---|---|---|
| **Text annotations** | ✅ Tags + Labels | ✅ Cards + inline labels | ✅ Info hotspots |
| **Image galleries** | ✅ In Tags | ✅ Cards with carousel | ❌ No |
| **Video embeds** | ✅ In Tags | ✅ Cards (YouTube, Vimeo, MP4) | ✅ Popup overlay (Commons + YouTube) |
| **Audio** | Via video embed | ✅ Background + per-hotspot | ✅ Per-hotspot (Commons audio) |
| **Forms/surveys** | ❌ No | ✅ Google Forms in cards | ❌ No |
| **Maps** | ❌ No | ✅ Google Maps in cards | ❌ No |
| **Cross-tour links** | ❌ No | ✅ (Pro) | ❌ No |

### 2.6 Editing & Authoring

| | Matterport | Kuula | Ours |
|---|---|---|---|
| **Editor type** | Web (Workshop) | Web (WYSIWYG) | Web (Studio) |
| **WYSIWYG in viewport** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Mobile editing** | ✅ Tablet/phone | ✅ Tablet/phone | ❌ Desktop only |
| **Viewport preservation** | ✅ | ✅ | ✅ (SC-2.0) |
| **Import from source** | Scan upload | Photo upload | Wiki page + paste JSON |
| **Export format** | Limited data export | Export Editor config | JSON download/copy (canonical URLs) |
| **Validation** | Built-in integrity | Tour Integrity Audit | JSON Schema validator + `--fix` |
| **Version history** | ❌ No | ❌ No | ✅ Wiki page history |
| **Collaborative editing** | Views (multi-user, not simultaneous) | ❌ No | ✅ Wiki talk pages + history |
| **AI-assisted creation** | ✅ Auto-Tours | ❌ No | ❌ No |
| **Set default view** | ✅ Start Position | ✅ Heading | ✅ "Set as Default View" |
| **Hotspot reposition** | ✅ Drag Tags | ✅ Fine-tune position | ✅ "Set to Current View" |

### 2.7 Sharing & Distribution

| | Matterport | Kuula | Ours |
|---|---|---|---|
| **Share link** | ✅ | ✅ | ✅ Via wiki page URL |
| **Embed** | ✅ Iframe | ✅ Iframe + JS API | ✅ Pannellum embed (future) |
| **Branding** | Limited | White-label, custom domains | N/A (Wikimedia no branding) |
| **Privacy** | Unlisted, password | Public, unlisted, private, password | Public (Commons is public) |
| **Analytics** | Built-in | Google Analytics (Business) | Wikimedia pageview stats |
| **QR codes** | ❌ No | ✅ | ❌ No |
| **VR support** | ❌ No native VR | ✅ WebXR, Meta Quest, Cardboard | ⚠️ Pannellum has WebXR but not tested |

### 2.8 Collaboration & Community

| | Matterport | Kuula | Ours |
|---|---|---|---|
| **Multi-user editing** | ❌ No | ❌ No | ✅ **Wiki-native** |
| **Version history** | ❌ No | ❌ No | ✅ **Full page history** |
| **Discussion** | ❌ No | ❌ No | ✅ **Talk pages** |
| **Watchlists** | ❌ No | ❌ No | ✅ **Wiki watchlists** |
| **Permissions** | Workspace roles | Account owner only | Wiki page protection levels |
| **Discovery** | Gallery/folders | Profile page | ✅ Categories, search, what links here |

---

## 3. What We Already Do Better

These are areas where our project has **genuine advantages** over both commercial platforms:

### 3.1 Wiki-Native Collaboration
Neither Matterport nor Kuula supports collaborative editing. Our tours live on wiki pages with full version history, talk page discussions, watchlists, and granular permissions. This is a **structural advantage** that neither competitor can easily replicate — it's baked into the Wikimedia ecosystem.

### 3.2 Wikipedia Information Cards
Our automatic Wikipedia article enrichment (lead image + extract on hotspot hover) has no equivalent in either platform. It's a natural fit for Wikimedia Commons tours of museums, historical sites, and cultural landmarks — the exact use case our project targets.

### 3.3 Open Format & No Lock-in
Tours are stored as plain JSON/TOML on wiki pages. Anyone can download, fork, or remix a tour. Neither Matterport nor Kuula offers this — their formats are proprietary and tours are trapped on their platforms.

### 3.4 Zero Cost
Our platform is completely free — no subscriptions, no per-tour fees, no upload limits. This is a fundamental differentiator. Kuula's $12/mo and Matterport's $55/mo are trivial for professionals but barriers for volunteers, educators, and small cultural institutions — exactly the Wikimedia audience.

### 3.5 Commons Integration
Seamless use of Wikimedia Commons for image storage, categorization, and discoverability. Upload a 360° photo to Commons and it's immediately available for tour authoring. Neither competitor integrates with any open media repository.

---

## 4. Feature Gap Analysis (What We're Missing)

### 4.1 Critical Gaps (Should Address in Phase 2.5/3)

| Feature | Source | Importance | Difficulty |
|---|---|---|---|
| **Backlinks (bidirectional hotspots)** | Kuula | HIGH — saves 50% of linking time | Low |
| **One-way street detection (lint)** | Kuula | HIGH — prevents dead-end navigation | Low |
| **Walkthrough camera alignment** | Kuula | HIGH — feels professional | Medium |
| **Drag-to-connect thumbnails** | Kuula | MEDIUM — UX improvement | Medium |
| **Tour duplication / "Save as copy"** | Kuula | MEDIUM — iteration workflow | Low |
| **Tour integrity audit** | Kuula | MEDIUM — error prevention | Low |
| **Guided/story mode** | Matterport | MEDIUM — slideshow experience | Medium-High |
| **OAuth save-to-wiki** | N/A (our own) | HIGH — completes the authoring loop | Medium |
| **Floor plan / map overlay** | Both | MEDIUM — spatial context | Medium |

### 4.2 Nice-to-Have (Phase 3)

| Feature | Source | Importance | Difficulty |
|---|---|---|---|
| **Hotspot animation (pulse/bounce)** | Kuula | LOW — visual polish | Low |
| **Masters / Apply-to-all scenes** | Kuula | MEDIUM — large tours | Medium |
| **Click-anywhere navigation** | Kuula | LOW — alternative nav | High |
| **Custom hotspot color** | Kuula | LOW — visual customization | Low |
| **Multi-perspective Views** | Matterport | LOW — advanced use case | High |
| **Panorama retouching (level/horizon)** | Kuula | LOW — pre-processing concern | Medium |
| **Image replace without data loss** | Kuula | LOW — re-shooting | Low |
| **Google Street View publish** | Kuula | LOW — different ecosystem | High |

### 4.3 Out of Scope (Not Our Problem)

These Matterport features rely on 3D mesh data and are not achievable without depth sensors:

- Dollhouse view
- Auto-generated floor plans from mesh
- Point-to-point measurements
- 3D mesh model navigation
- Auto-Tours (AI room detection)

---

## 5. Strategic Recommendations

### 5.1 Phase 2.5 Priorities (Deployment + Quick Wins)

**Recommendation 1: Implement Backlinks Immediately**
This is the single highest-leverage feature we can borrow from Kuula. When a user creates a hotspot from scene A → scene B with type `scene`, auto-create the reverse hotspot from B → A. The implementation is straightforward: add a `backlink` flag to the hotspot creation flow, defaulting to `true`. The user can toggle it off if they want a one-way link.

**The principle**: One-way scene links are almost always a mistake. If a user can walk from the living room to the kitchen, they must be able to walk back. Dead-end navigation is disorienting and breaks the spatial metaphor of a walkthrough. Backlinks as the default encode this principle into the tool.

**Estimated effort**: ~2 hours. Impact: 50% reduction in scene-linking time.

**Recommendation 2: One-Way Street Detection (Tour Linting)**
Extend `scripts/validate-pannellum.mjs` with a new **backlink integrity check** — the linter's headline feature:

- **Detect one-way scene links**: For every `type: "scene"` hotspot from scene A → scene B, verify that scene B has a `type: "scene"` hotspot linking back to scene A. Flag any unreciprocated link as a warning (or error in `--strict` mode).
- **Degrees of severity**:
  - A → B has a scene link, B → A has none → **WARNING**: "One-way link: visitors can go from 'Kitchen' to 'Living Room' but cannot return"
  - A → B has a scene link, B → A has only an info hotspot mentioning A → **WARNING**: "Missing return scene link"
  - All scene links are reciprocal → ✅ **PASS**
- **Dangling `sceneId` references**: Hotspot points to a scene that doesn't exist → **ERROR**
- **Orphaned scenes**: Scene has no incoming links from any other scene → **WARNING** (unless it's `firstScene`, which is the natural entry point)
- **Missing `panorama` URLs** → **ERROR**
- **Inconsistent `firstScene`** → **ERROR**

**Why this matters**: One-way streets are the most common structural bug in hand-authored tours. A creator links the kitchen → living room but forgets the reverse, and the tour is published with a navigation trap. Neither Kuula nor Matterport expose this as a check — Kuula prevents the problem via backlinks at creation time, but has no linting for existing tours. Our linter would catch it both at creation (via backlinks) and retrospectively (via validation).

**Estimated effort**: ~1.5 hours. Impact: Prevents the most common navigation bug in tour authoring.

**Recommendation 3: Walkthrough Camera Alignment**
When navigating from scene A → scene B via a scene-link hotspot, set scene B's initial view to match the yaw from scene A's exit hotspot, or at least rotate to face the connecting hotspot in scene B. This creates the "walkthrough" feel that Kuula's Walkthrough Mode provides.

Pannellum supports this via the `sceneId` + `targetYaw`/`targetPitch` parameters on scene-link hotspots. We already store yaw/pitch on hotspots — we just need to use them as target parameters.

**Estimated effort**: ~3 hours. Impact: Dramatically more professional navigation feel.

**Recommendation 4: Tour Duplication**
Add a "Duplicate Tour" button to the Studio that copies the current tour JSON (renaming the tour, incrementing a version number) and saves it as a new wiki page or exports it. This enables iterative development of tours without losing the original.

**Estimated effort**: ~1 hour. Impact: Enables A/B testing and iterative tour design.

### 5.2 Phase 3 Priorities (Rich Features)

**Recommendation 5: Spatial Map Overlay**
This is the feature that would bring our tours closest to Matterport's spatial understanding without requiring 3D mesh data. If scenes have GPS coordinates (from EXIF data on Commons), render scene markers on an OpenStreetMap or uploaded floor plan. This gives users spatial context — "where am I in the building/city?" — and enables map-based scene selection.

Pannellum doesn't natively support this, but it can be implemented as a collapsible side panel or overlay. Photo-Sphere-Viewer (our potential Phase 3 migration target) has a built-in map plugin.

**Estimated effort**: ~15 hours. Impact: Major UX upgrade, spatial context.

**Recommendation 6: Guided/Story Mode**
Implement a "slideshow mode" inspired by Matterport's Story Mode:
- Curated sequence of viewpoints (not necessarily scene transitions)
- On-screen captions at each stop
- Auto-advance timer or manual swipe
- Mobile-optimized layout

This would be a new viewing mode in `tour_viewer.html`, defined by an optional `guidedTour` section in the JSON format specifying a sequence of `{scene, yaw, pitch, hfov, caption}` entries.

**Estimated effort**: ~10 hours. Impact: Enables storytelling, educational tours.

**Recommendation 7: Drag-to-Connect in the Studio**
Replace (or augment) the current dropdown-based scene-linking with drag-and-drop: drag a scene thumbnail from the sidebar into the viewport to create a scene-link hotspot at that position. This is more intuitive and matches Kuula's workflow.

**Estimated effort**: ~5 hours. Impact: More intuitive scene linking, lower barrier for new users.

**Recommendation 8: Multi-Perspective Annotations**
Inspired by Matterport's Views/Layers: allow a single tour to have multiple annotation layers. Example: a museum tour could have a "Visitor's Highlights" layer (key exhibits) and a "Scholar's Tour" layer (detailed art history annotations). Layers would be toggleable in the viewer.

This could be implemented as multiple `hotSpots` arrays per scene (e.g., `hotSpots_visitor`, `hotSpots_scholar`) with a layer selector in the viewer UI.

**Estimated effort**: ~8 hours. Impact: One tour serves multiple audiences.

### 5.3 What NOT to Build

- **3D mesh or depth sensing**: Requires proprietary hardware and fundamentally different technology stack. Not achievable with equirectangular photos alone.
- **Proprietary mobile app**: Our web-based Studio is sufficient. The Wikimedia audience doesn't need a native app.
- **Payment/subscription system**: Counter to Wikimedia's free knowledge mission.
- **Proprietary embed/widget marketplace**: The wiki ecosystem has its own embed patterns (templates, iframes).
- **Auto-Tours equivalent (without 3D data)**: AI room detection requires spatial data we don't have. GPS-based "nearest neighbor" is a simpler alternative.

---

## 6. UX Philosophy: What to Steal From Each

### From Kuula: The "It Just Works" Feeling
- **Immediate visual feedback**: Every action in the editor is instantly reflected in the viewport
- **Progressive disclosure**: Basic tools visible, advanced features in expandable panels
- **Backlinks as default**: The platform assumes you want bidirectional links and makes that the easy path
- **No save button anxiety**: Changes are auto-saved; explicit save is for sharing/publishing

### From Matterport: The "Professional Result" Feeling
- **Multiple ways to experience the same space**: 3D walk, dollhouse, floor plan, guided tour — all from one scan
- **Start with a great default, then customize**: Auto-Tours generates the initial tour; the human refines it
- **Views for different audiences**: The same space can tell different stories to different viewers

### For Our Project: The "Collaborative Knowledge" Feeling
- **Wiki-native workflows**: Version history, talk pages, watchlists are features, not afterthoughts
- **Transparent format**: The JSON is readable, forkable, and remixable by anyone
- **Commons integration**: Every photo in a tour is a Commons file with its own metadata, categories, and reuse history
- **Wikipedia enrichment**: Cultural context is automatically pulled from Wikipedia — something neither commercial platform can do

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Pannellum maintenance declines | Medium | High | Evaluate Photo-Sphere-Viewer migration in Phase 3 |
| Toolforge resource limits for image caching | Low | Medium | Monitor cache size; add TTL-based cleanup (already 1hr) |
| Commons 360° photo inventory insufficient for tours | Low | Medium | Encourage uploads; partner with Wiki Loves Monuments |
| User adoption too low | Medium | High | Recruit from Wiki Loves Monuments participants; create tutorials |
| Complexity creep — trying to match Matterport | Medium | Medium | Strictly limit features to what's achievable without depth data |

---

## 8. Summary: Our Unique Value Proposition

In a sentence: **We are the only free, open-source, wiki-collaborative 360° tour platform — positioned between Kuula's simplicity and Matterport's depth, with unique Wikipedia enrichment and Commons integration that neither competitor can offer.**

The next 3-6 months should focus on:
1. **Deploy to Toolforge** (Phase 2.5) — make it real
2. **Backlinks + walkthrough alignment** — the two features that most improve the tour creation and viewing experience
3. **Guided/Story Mode** — the feature that enables our most distinctive use case (educational/cultural tours with Wikipedia context)

Longer term, **Phase 3's spatial map overlay** is the bridge feature that could make our tours feel closer to Matterport's spatial understanding, without requiring 3D capture hardware — just by leveraging the GPS data already embedded in many Commons photos.
