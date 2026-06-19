/**
 * studio.js — Photosphere Tour Studio (Phase 2)
 *
 * Visual editor for creating 360° photosphere tours.
 * Embed Pannellum for the viewport, capture click coordinates,
 * manage scenes and hotspots, export Pannellum-compatible JSON.
 */

// ── State ────────────────────────────────────────────────────────────────────

const state = {
    /** @type {string|null} */ activeSceneId: null,
    /** @type {Object<string, object>} */ scenes: {},
    /** @type {string[]} */ sceneOrder: [],
    /** @type {object|null} */ pannellumViewer: null,
    /** @type {{pitch: number, yaw: number}|null} */ capturedCoords: null,
    /** @type {{pitch: number, yaw: number}|null} */ liveCoords: null,
    defaultAuthor: 'Wikimedia Commons',
    sceneFadeDuration: 1000,
    /** @type {number|null} index of hotspot being edited, null = adding new */
    editingHotspotIndex: null,
    /** @type {string|null} wiki prefix (commons, en, de, etc.) */
    sourceWiki: null,
    /** @type {string|null} wiki display name (Commons, English Wikipedia, etc.) */
    sourceWikiName: null,
};

// ── DOM Refs ─────────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);
const viewportEl = $('viewport');
const sceneListEl = $('scene-list');
const hotspotListEl = $('hotspot-list');
const coordDisplay = $('coord-display');
const coordYaw = $('coord-yaw');
const coordPitch = $('coord-pitch');
const addHotspotBtn = $('add-hotspot-btn');
const hsCoordPreview = $('hs-coord-preview');
const statusMsg = $('status-msg');
const statusCoords = $('status-coords');

// ── Image Source Normalization ──────────────────────────────────────────────

/**
 * Normalize diverse image source inputs into a canonical form.
 * Handles:
 *   - File:Glenstone_24.jpg
 *   - https://commons.wikimedia.org/wiki/File:Glenstone_24.jpg
 *   - https://commons.wikimedia.org/wiki/Special:FilePath/Glenstone_24.jpg
 *   - https://upload.wikimedia.org/... (direct image URL — passed through)
 *   - Glenstone_24.jpg (bare filename — prefixed with File:)
 */
function normalizeImageSource(input) {
    if (!input || typeof input !== 'string') return '';
    const trimmed = input.trim();
    if (!trimmed) return '';

    // Already a File: ref
    if (trimmed.toLowerCase().startsWith('file:')) {
        return trimmed; // keep original casing
    }

    // Commons file page URL: https://commons.wikimedia.org/wiki/File:...
    const wikiMatch = trimmed.match(/commons\.wikimedia\.org\/wiki\/File:([^\s\?#]+)/i);
    if (wikiMatch) return 'File:' + wikiMatch[1];

    // Special:FilePath URL: https://commons.wikimedia.org/wiki/Special:FilePath/...
    const filePathMatch = trimmed.match(/commons\.wikimedia\.org\/wiki\/Special:FilePath\/([^\s\?#]+)/i);
    if (filePathMatch) return 'File:' + filePathMatch[1];

    // Direct image URL (upload.wikimedia.org, etc.) — pass through
    if (/^https?:\/\//.test(trimmed)) {
        return trimmed;
    }

    // Bare filename — prefix with File:
    return 'File:' + trimmed;
}

// ── Scene Management ─────────────────────────────────────────────────────────

async function addScene(imageUrl, title) {
    const id = 'scene_' + Date.now();
    const scene = {
        title: title || ('Scene ' + (state.sceneOrder.length + 1)),
        hfov: 110,
        yaw: 0,
        pitch: 0,
        type: 'equirectangular',
        panorama: imageUrl,
        hotSpots: [],
    };
    state.scenes[id] = scene;
    state.sceneOrder.push(id);

    // If first scene, auto-select
    if (!state.activeSceneId) {
        state.activeSceneId = id;
    }

    // Resolve the image URL to get cached /images/ path for thumbnails
    try {
        const resolvedUrl = await resolveSceneImage(scene);
        scene.panorama = resolvedUrl;
    } catch(e) {
        console.warn('Failed to resolve image for thumbnail:', e);
    }

    renderSceneList();
    if (state.activeSceneId === id) {
        loadSceneIntoViewport(id);
    }
    updateStatus(`Scene added: ${scene.title}`);
}

function deleteScene(id) {
    if (!confirm(`Delete scene "${state.scenes[id].title}"?`)) return;
    delete state.scenes[id];
    state.sceneOrder = state.sceneOrder.filter(sid => sid !== id);

    if (state.activeSceneId === id) {
        state.activeSceneId = state.sceneOrder[0] || null;
        if (state.activeSceneId) {
            loadSceneIntoViewport(state.activeSceneId);
        } else {
            destroyViewer();
        }
    }
    renderSceneList();
    if (state.activeSceneId) renderProperties();
}

function renderSceneList() {
    sceneListEl.innerHTML = state.sceneOrder.map(id => {
        const scene = state.scenes[id];
        const active = id === state.activeSceneId ? ' active' : '';
        const hotspotCount = scene.hotSpots ? scene.hotSpots.length : 0;
        const thumb = getSceneThumbnail(scene);
        const thumbSpan = thumb
            ? `<span class="thumb" style="background-image:url(${escAttr(thumb)})"></span>`
            : `<span class="thumb"></span>`;
        return `<li class="${active}" onclick="selectScene('${id}')">
            ${thumbSpan}
            <span class="name">${escHtml(scene.title)}</span>
            ${hotspotCount > 0 ? `<span class="badge">${hotspotCount}</span>` : ''}
            <button class="delete-btn" onclick="event.stopPropagation();deleteScene('${id}')" title="Delete">×</button>
        </li>`;
    }).join('');
}

function getSceneThumbnail(scene) {
    const pano = scene.panorama || '';
    // Commons cached paths — use same path (browser will scale with CSS)
    // NOTE: scene._thumb is the direct Commons URL (CORS-blocked), so we ignore it.
    // The pano is already cached locally at /images/<hash>.jpg and CSS scales it.
    if (pano.startsWith('/images/')) return pano;
    // Direct URLs — not common in studio (usually resolved to /images/)
    if (pano.startsWith('http')) return pano;
    return '';
}

function selectScene(id) {
    state.activeSceneId = id;
    state.capturedCoords = null;
    addHotspotBtn.style.display = 'none';
    renderSceneList();
    loadSceneIntoViewport(id);
    renderProperties();

    // Update the URL so the current scene is shareable/bookmarkable.
    // Uses replaceState (not pushState) — scene switches don't create history entries.
    const url = new URL(window.location);
    url.searchParams.set('scene', id);
    history.replaceState(null, '', url);
}

// ── Viewport (Pannellum) ─────────────────────────────────────────────────────

function resolveImageUrl(raw) {
    // For File: references, resolve through API first
    // The caller is async and handles this
    return raw;
}

async function resolveSceneImage(scene) {
    // If the panorama is a File: reference, resolve it
    if (scene.panorama.startsWith('File:')) {
        const filename = scene.panorama.replace(/^File:\s*/i, '');
        try {
            const resp = await fetch(`/api/resolve?file=${encodeURIComponent(filename)}`);
            if (resp.ok) {
                const data = await resp.json();
                scene._thumb = data.thumb || null;
                scene._original = data.original || null;
                return data.url;  // cached image path
            }
        } catch(e) {
            console.warn('Failed to resolve file:', filename, e);
        }
    }
    // If it's a Commons URL, proxy through resolve-url
    if (scene.panorama.startsWith('https://upload.wikimedia.org/') ||
        scene.panorama.startsWith('https://commons.wikimedia.org/')) {
        try {
            const resp = await fetch(`/api/resolve-url?url=${encodeURIComponent(scene.panorama)}`);
            if (resp.ok) {
                const data = await resp.json();
                scene._thumb = data.thumb || null;
                scene._original = data.original || null;
                return data.url;
            }
        } catch(e) {
            console.warn('Failed to resolve URL:', e);
        }
    }
    return scene.panorama;
}

async function loadSceneIntoViewport(id, viewOverride) {
    const scene = state.scenes[id];
    if (!scene) return;

    destroyViewer();

    // Resolve the image URL (handles File: references and Commons URLs)
    updateStatus(`Resolving image...`);
    let panoramaUrl;
    try {
        panoramaUrl = await resolveSceneImage(scene);
    } catch(e) {
        updateStatus('Failed to resolve image: ' + e.message, true);
        return;
    }

    const config = {
        type: 'equirectangular',
        panorama: panoramaUrl,
        autoLoad: true,
        hfov: (viewOverride && viewOverride.hfov != null) ? viewOverride.hfov : (scene.hfov || 110),
        yaw: (viewOverride && viewOverride.yaw != null) ? viewOverride.yaw : (scene.yaw || 0),
        pitch: (viewOverride && viewOverride.pitch != null) ? viewOverride.pitch : (scene.pitch || 0),
        crossOrigin: 'anonymous',
    };

    state.pannellumViewer = pannellum.viewer('viewport', config);

    state.pannellumViewer.on('load', () => {
        updateStatus(`Loaded: ${scene.title}`);
        // Re-apply hotspots
        if (scene.hotSpots) {
            scene.hotSpots.forEach(hs => {
                const subtype = hs.hotspotSubtype || (hs.type === 'scene' ? 'scene' : 'info');
                const typeClass = subtype === 'scene' ? 'studio-scene-hs' : subtype === 'audio' ? 'studio-audio-hs' : subtype === 'video' ? 'studio-video-hs' : 'studio-info-hs';
                // Add icon size class if specified
                const sizeClass = hs.iconStyle ? ` icon-${hs.iconStyle}` : '';
                const hsClass = 'studio-hotspot ' + typeClass + sizeClass;
                try {
                    state.pannellumViewer.addHotSpot({
                        pitch: hs.pitch,
                        yaw: hs.yaw,
                        type: hs.type || 'info',
                        text: hs.text || '',
                        URL: hs.URL || undefined,
                        sceneId: hs.sceneId || undefined,
                        cssClass: hsClass,
                    });
                } catch(e) { /* ignore dupes */ }
            });
        }
        // Studio mode: intercept hotspot clicks → open edit modal instead of navigating
        // Pannellum sets onclick directly on the element (not addEventListener), so we
        // wrap it to replace navigation with the edit modal. We do NOT fire Pannellum's
        // original handler — in edit mode, clicking a hotspot should edit it, not navigate.
        let _nextHsIdx = 0;

        function wrapHotspotOnclick(el) {
            if (el.dataset.hsOnclickWrapped) return;
            el.dataset.hsOnclickWrapped = '1';
            el.dataset.hsIdx = _nextHsIdx++;
            el.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const idx = parseInt(el.dataset.hsIdx, 10);
                if (!isNaN(idx)) {
                    editHotspot(state.activeSceneId, idx);
                }
                return false;
            };
        }

        // Wrap existing hotspot onclick elements
        document.querySelectorAll('.studio-hotspot').forEach(wrapHotspotOnclick);
        // Watch for new hotspots being added
        const hotspotObserver = new MutationObserver((mutations) => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    if (node.classList?.contains('studio-hotspot')) {
                        wrapHotspotOnclick(node);
                    }
                    // Also check nested studio-hotspots
                    node.querySelectorAll?.('.studio-hotspot').forEach(wrapHotspotOnclick);
                }
            }
        });
        hotspotObserver.observe(document.getElementById('viewport'), { childList: true, subtree: true });
        // Refresh UI
        renderHotspotList();
        renderSceneList();
    });

    state.pannellumViewer.on('error', (err) => {
        updateStatus('Error: ' + err, true);
    });

    // Mouse move — track live coordinates
    state.pannellumViewer.on('mousemove', (e) => {
        const coords = state.pannellumViewer.mouseEventToCoords(e);
        if (coords) {
            state.liveCoords = { pitch: coords[0], yaw: coords[1] };
            statusCoords.textContent =
                `Yaw: ${coords[1].toFixed(1)}°  Pitch: ${coords[0].toFixed(1)}°`;
        }
    });

    // Click — capture coordinates (normalize yaw to [-180, 180] per spec)
    state.pannellumViewer.on('mousedown', (e) => {
        const coords = state.pannellumViewer.mouseEventToCoords(e);
        if (coords) {
            const nYaw = normalizeYaw(coords[1]);
            state.capturedCoords = { pitch: coords[0], yaw: nYaw };
            coordYaw.textContent = nYaw.toFixed(2);
            coordPitch.textContent = coords[0].toFixed(2);
            coordDisplay.classList.add('visible');
            addHotspotBtn.style.display = 'block';
            hsCoordPreview.textContent =
                `Yaw: ${nYaw.toFixed(2)}°  Pitch: ${coords[0].toFixed(2)}°`;
            updateStatus(`Coordinates captured — click "Place Hotspot Here" to add`);
        }
    });

    updateStatus(`Loading: ${scene.title}...`);
}

function destroyViewer() {
    if (state.pannellumViewer) {
        try { state.pannellumViewer.destroy(); } catch(e) {}
        state.pannellumViewer = null;
    }
    // Reset the container for fresh Pannellum init
    viewportEl.innerHTML = '';
    coordDisplay.classList.remove('visible');
    addHotspotBtn.style.display = 'none';
    state.capturedCoords = null;
}

// ── Properties Panel ─────────────────────────────────────────────────────────

function renderProperties() {
    const id = state.activeSceneId;
    if (!id || !state.scenes[id]) return;

    const scene = state.scenes[id];
    $('prop-title').value = scene.title || '';
    $('prop-hfov').value = scene.hfov || 110;
    $('prop-yaw').value = scene.yaw || 0;
    $('prop-pitch').value = scene.pitch || 0;

    renderHotspotList();
}

function handleSetDefaultView() {
    if (!state.pannellumViewer || !state.activeSceneId) {
        updateStatus('No scene loaded', true);
        return;
    }
    const viewer = state.pannellumViewer;
    const scene = state.scenes[state.activeSceneId];
    
    // Capture current view from Pannellum
    scene.yaw = normalizeYaw(viewer.getYaw());
    scene.pitch = viewer.getPitch();
    scene.hfov = viewer.getHfov();
    
    // Update the input fields to reflect new values
    $('prop-yaw').value = scene.yaw.toFixed(2);
    $('prop-pitch').value = scene.pitch.toFixed(2);
    $('prop-hfov').value = scene.hfov.toFixed(0);
    
    updateStatus(`Default view set for "${scene.title}"`);
}

function handleHsSetCurrentView() {
    if (!state.pannellumViewer) {
        updateStatus('No viewport loaded', true);
        return;
    }
    const viewer = state.pannellumViewer;
    
    // Capture current view from Pannellum
    const yaw = normalizeYaw(viewer.getYaw());
    const pitch = viewer.getPitch();
    
    // Update state.capturedCoords so confirmAddHotspot uses the new values
    state.capturedCoords = { pitch, yaw };
    
    // Update the modal display
    $('modal-hs-pitch').textContent = pitch.toFixed(2);
    $('modal-hs-yaw').textContent = yaw.toFixed(2);
    
    updateStatus('Coordinates updated to current view');
}

function renderHotspotList() {
    const id = state.activeSceneId;
    if (!id || !state.scenes[id]) {
        hotspotListEl.innerHTML = '<div style="color:var(--muted);font-size:0.8rem;">No scene selected.</div>';
        return;
    }

    const hotspots = state.scenes[id].hotSpots || [];
    if (hotspots.length === 0) {
        hotspotListEl.innerHTML = '<div style="color:var(--muted);font-size:0.8rem;">No hotspots yet.<br>Click in the viewport to capture coordinates, then click "Place Hotspot Here".</div>';
        return;
    }

    hotspotListEl.innerHTML = hotspots.map((hs, idx) => {
        const subtype = hs.hotspotSubtype || (hs.type === 'scene' ? 'scene' : 'info');
        const typeClass = subtype;
        const typeLabel = subtype === 'scene' ? 'SCENE LINK' : subtype === 'audio' ? 'AUDIO' : subtype === 'video' ? 'VIDEO' : 'INFO';
        let detail = '';
        if (subtype === 'scene' || hs.type === 'scene') {
            const targetScene = state.scenes[hs.sceneId];
            detail = `→ ${targetScene ? escHtml(targetScene.title) : hs.sceneId || '(none)'}`;
        } else if (subtype === 'audio' && hs.audioUrl) {
            detail = `🎵 ${escHtml(hs.audioUrl.substring(0, 60))}`;
        } else if (subtype === 'video' && hs.videoUrl) {
            detail = `🎬 ${escHtml(hs.videoUrl.substring(0, 60))}`;
        } else if (hs.URL) {
            detail = `🔗 ${escHtml(hs.URL.substring(0, 60))}`;
        }
        const hsId = `${id}_${idx}`;
        return `<div class="hotspot-card"
            onclick="lookAtHotspot(${hs.yaw}, ${hs.pitch})"
            style="cursor:pointer;" title="Click to view this hotspot">
            <div class="hs-header">
                <span class="hs-type ${typeClass}">${typeLabel}</span>
                <span class="hs-text">${escHtml(hs.text || '(no text)')}</span>
                <button class="hs-edit" onclick="event.stopPropagation(); editHotspot('${id}', ${idx})" title="Edit">✎</button>
                <button class="hs-delete" onclick="event.stopPropagation(); deleteHotspot('${id}', ${idx})" title="Delete">×</button>
            </div>
            <div class="hs-coords">Yaw: ${hs.yaw.toFixed(2)}°  Pitch: ${hs.pitch.toFixed(2)}°</div>
            ${detail ? `<div class="hs-detail">${detail}</div>` : ''}
        </div>`;
    }).join('');
}

// ── Hotspot Operations ───────────────────────────────────────────────────────

function lookAtHotspot(yaw, pitch) {
    if (!state.pannellumViewer) return;
    state.pannellumViewer.lookAt(pitch, yaw, state.pannellumViewer.getHfov());
}

let _cycleIdx = 0;
function cycleHotspots() {
    const id = state.activeSceneId;
    if (!id || !state.scenes[id] || !state.pannellumViewer) return;
    const hotspots = state.scenes[id].hotSpots || [];
    if (hotspots.length === 0) { updateStatus('No hotspots to show', true); return; }
    _cycleIdx = _cycleIdx % hotspots.length;
    const hs = hotspots[_cycleIdx];
    _cycleIdx++;
    // Use lookAt for smooth animation to the hotspot
    state.pannellumViewer.lookAt(hs.pitch, hs.yaw, state.pannellumViewer.getHfov());
    updateStatus(`Showing hotspot ${_cycleIdx} of ${hotspots.length}: ${hs.text}`);
}

function addHotspot() {
    if (!state.capturedCoords && state.editingHotspotIndex === null) {
        updateStatus('Click in the viewport first to capture coordinates', true);
        return;
    }
    if (!state.activeSceneId) {
        updateStatus('No scene selected', true);
        return;
    }

    state.editingHotspotIndex = null; // new hotspot mode

    // Show the hotspot config modal
    $('modal-hs-pitch').textContent = state.capturedCoords.pitch.toFixed(2);
    $('modal-hs-yaw').textContent = state.capturedCoords.yaw.toFixed(2);
    $('modal-hs-text').value = '';
    $('modal-hs-url').value = '';
    $('modal-hs-audio').value = '';
    $('modal-hs-video').value = '';
    $('modal-hs-icon-style').value = 'normal';
    $('modal-hs-type').value = 'scene';

    // Populate target scene dropdown
    populateTargetSceneSelect();
    updateHsModalFields();
    modalShow('modal-add-hs');
    $('modal-add-hs').querySelector('h2').textContent = 'Add Hotspot';
    $('modal-confirm-hs').textContent = 'Add Hotspot';
}

function editHotspot(sceneId, index) {
    const hs = state.scenes[sceneId]?.hotSpots?.[index];
    if (!hs) return;

    state.editingHotspotIndex = index;
    state.capturedCoords = { pitch: hs.pitch, yaw: hs.yaw };

    $('modal-hs-pitch').textContent = hs.pitch.toFixed(2);
    $('modal-hs-yaw').textContent = hs.yaw.toFixed(2);
    $('modal-hs-text').value = hs.text || '';
    $('modal-hs-url').value = hs.URL || '';
    $('modal-hs-audio').value = hs.audioUrl || '';
    $('modal-hs-video').value = hs.videoUrl || '';
    $('modal-hs-icon-style').value = hs.iconStyle || 'normal';
    // Detect subtype: use hotspotSubtype if present, otherwise fall back to Pannellum type
    $('modal-hs-type').value = hs.hotspotSubtype || hs.type || 'info';

    populateTargetSceneSelect();
    if (hs.type === 'scene' && hs.sceneId) {
        $('modal-hs-scene').value = hs.sceneId;
    }
    updateHsModalFields();
    modalShow('modal-add-hs');
    $('modal-add-hs').querySelector('h2').textContent = 'Edit Hotspot';
    $('modal-confirm-hs').textContent = 'Save Changes';
}

function populateTargetSceneSelect() {
    const select = $('modal-hs-scene');
    select.innerHTML = state.sceneOrder
        .filter(sid => sid !== state.activeSceneId)
        .map(sid => `<option value="${sid}">${escHtml(state.scenes[sid].title)}</option>`)
        .join('');
    if (select.options.length === 0) {
        select.innerHTML = '<option value="">No other scenes — add another scene first</option>';
    }
}

function deleteHotspot(sceneId, index) {
    if (!state.scenes[sceneId]) return;
    state.scenes[sceneId].hotSpots.splice(index, 1);

    // Refresh viewer hotspots, preserving the current view position
    if (state.activeSceneId === sceneId && state.pannellumViewer) {
        const v = state.pannellumViewer;
        const view = { pitch: v.getPitch(), yaw: v.getYaw(), hfov: v.getHfov() };
        loadSceneIntoViewport(sceneId, view);
    }
    renderHotspotList();
    renderSceneList();
    updateStatus('Hotspot deleted');
}

async function confirmAddHotspot() {
    const modalType = $('modal-hs-type').value;
    const text = $('modal-hs-text').value.trim();
    const sceneId = state.activeSceneId;
    if (!sceneId) return;

    // Audio and video hotspots map to Pannellum type 'info' (they don't navigate scenes).
    // The custom subtype and media URL are stored alongside for viewer behavior.
    const pannellumType = (modalType === 'audio' || modalType === 'video') ? 'info' : modalType;

    const hs = {
        pitch: state.capturedCoords.pitch,
        yaw: state.capturedCoords.yaw,
        type: pannellumType,
        text: text || 'Click here',
    };

    if (modalType === 'audio') {
        hs.hotspotSubtype = 'audio';
        let audioUrl = $('modal-hs-audio').value.trim();
        if (!audioUrl) {
            updateStatus('Please enter an audio URL', true);
            return;
        }
        // Normalize Commons page URLs → File: references, then resolve to direct URLs.
        // e.g. https://commons.wikimedia.org/wiki/File:Sound.ogg → File:Sound.ogg → upload URL
        audioUrl = normalizeImageSource(audioUrl);
        if (/^File:/i.test(audioUrl)) {
            const fileMatch = audioUrl.match(/^File:\s*(.+)$/i);
            if (fileMatch) {
                updateStatus('Resolving audio file...');
                try {
                    const resp = await fetch(`/api/resolve?file=${encodeURIComponent(fileMatch[1].trim())}`);
                    if (resp.ok) {
                        const data = await resp.json();
                        audioUrl = data.original || data.url || audioUrl;
                    }
                } catch(e) {
                    console.warn('Failed to resolve audio file:', audioUrl, e);
                }
            }
        }
        hs.audioUrl = audioUrl;
    } else if (modalType === 'video') {
        hs.hotspotSubtype = 'video';
        let videoUrl = $('modal-hs-video').value.trim();
        if (!videoUrl) {
            updateStatus('Please enter a video URL', true);
            return;
        }
        // Normalize Commons page URLs → File: references, then resolve to direct URLs.
        // e.g. https://commons.wikimedia.org/wiki/File:Video.webm → File:Video.webm → upload URL
        videoUrl = normalizeImageSource(videoUrl);
        if (/^File:/i.test(videoUrl)) {
            const fileMatch = videoUrl.match(/^File:\s*(.+)$/i);
            if (fileMatch) {
                updateStatus('Resolving video file...');
                try {
                    const resp = await fetch(`/api/resolve?file=${encodeURIComponent(fileMatch[1].trim())}`);
                    if (resp.ok) {
                        const data = await resp.json();
                        videoUrl = data.original || data.url || videoUrl;
                    }
                } catch(e) {
                    console.warn('Failed to resolve video file:', videoUrl, e);
                }
            }
        }
        hs.videoUrl = videoUrl;
    } else if (modalType === 'scene') {
        hs.sceneId = $('modal-hs-scene').value;
        if (!hs.sceneId) {
            updateStatus('Please select a target scene', true);
            return;
        }
    } else if (modalType === 'info') {
        const url = $('modal-hs-url').value.trim();
        if (url) hs.URL = url;
    }

    // Store icon style if not 'normal' (the default)
    const iconStyle = $('modal-hs-icon-style').value;
    if (iconStyle && iconStyle !== 'normal') {
        hs.iconStyle = iconStyle;
    }

    // Add or update
    if (state.editingHotspotIndex !== null) {
        state.scenes[sceneId].hotSpots[state.editingHotspotIndex] = hs;
        updateStatus(`Hotspot updated: ${hs.text}`);
    } else {
        state.scenes[sceneId].hotSpots.push(hs);
        updateStatus(`Hotspot added: ${hs.text}`);
    }

    // Validate the hotspot immediately — warn if required fields are missing
    const hsWarnings = validateHotspot(hs, state.scenes[sceneId].title, state.scenes[sceneId].hotSpots.indexOf(hs));
    if (hsWarnings.length > 0) {
        updateStatus('⚠️ ' + hsWarnings[0], true);
        console.warn('Hotspot validation:', hsWarnings);
    }

    // Reload viewer to reflect changes, preserving the current view position.
    // Capture pitch/yaw/hfov before destroying the viewer so the user isn't
    // warped back to the scene's default orientation.
    if (state.pannellumViewer) {
        const v = state.pannellumViewer;
        const view = { pitch: v.getPitch(), yaw: v.getYaw(), hfov: v.getHfov() };
        loadSceneIntoViewport(sceneId, view);
    } else {
        renderHotspotList();
        renderSceneList();
    }

    // Reset state
    state.capturedCoords = null;
    state.editingHotspotIndex = null;
    addHotspotBtn.style.display = 'none';
    coordDisplay.classList.remove('visible');

    modalHide('modal-add-hs');
}

function updateHsModalFields() {
    const type = $('modal-hs-type').value;
    $('modal-hs-scene-group').style.display = type === 'scene' ? 'block' : 'none';
    $('modal-hs-url-group').style.display = type === 'info' ? 'block' : 'none';
    $('modal-hs-audio-group').style.display = type === 'audio' ? 'block' : 'none';
    $('modal-hs-video-group').style.display = type === 'video' ? 'block' : 'none';
}

// ── Import / Export ──────────────────────────────────────────────────────────

function importTourData(data) {
    // Clear existing state
    state.scenes = {};
    state.sceneOrder = [];
    state.activeSceneId = null;
    destroyViewer();

    // Import scenes
    if (data.scenes) {
        for (const [id, scene] of Object.entries(data.scenes)) {
            state.scenes[id] = {
                title: scene.title || id,
                hfov: scene.hfov || 110,
                yaw: scene.yaw || 0,
                pitch: scene.pitch || 0,
                type: scene.type || 'equirectangular',
                panorama: scene.panorama || '',
                _thumb: scene._thumb || null,
                _original: scene._original || null,
                hotSpots: (scene.hotSpots || []).map(hs => ({
                    pitch: hs.pitch,
                    yaw: hs.yaw,
                    type: hs.type || 'info',
                    text: hs.text || '',
                    URL: hs.URL || undefined,
                    sceneId: hs.sceneId || undefined,
                    hotspotSubtype: hs.hotspotSubtype || undefined,
                    audioUrl: hs.audioUrl || undefined,
                    videoUrl: hs.videoUrl || undefined,
                    iconStyle: hs.iconStyle || undefined,
                })),
            };
            state.sceneOrder.push(id);
        }
    }

    // Set defaults
    if (data.default) {
        state.defaultAuthor = data.default.author || state.defaultAuthor;
        state.sceneFadeDuration = data.default.sceneFadeDuration || state.sceneFadeDuration;
        if (data.default.firstScene && state.scenes[data.default.firstScene]) {
            state.activeSceneId = data.default.firstScene;
        }
    }

    if (!state.activeSceneId && state.sceneOrder.length > 0) {
        state.activeSceneId = state.sceneOrder[0];
    }

    // Store source wiki info from _meta
    if (data._meta) {
        state.sourceWiki = data._meta.sourceWiki || null;
        state.sourceWikiName = data._meta.sourceWikiName || null;
    }

    renderSceneList();
    if (state.activeSceneId) {
        loadSceneIntoViewport(state.activeSceneId);
        renderProperties();
    }

    // Validate imported data — warn about hotspots with missing fields
    const warnings = validateTour();
    let msg = `Imported: ${state.sceneOrder.length} scenes`;
    if (warnings.length > 0) {
        msg += ` ⚠️ ${warnings.length} issue(s)`;
        updateStatus(msg, true);
        // Show first warning prominently so the user sees it
        setTimeout(() => updateStatus(`⚠️ ${warnings[0]}`, true), 1500);
    } else {
        updateStatus(msg);
    }
}

async function importTour() {
    const input = $('modal-import-text').value.trim();
    if (!input) return;

    try {
        let data;

        // Check if it's a wiki page title (no JSON brackets)
        if (!input.startsWith('{') && !input.startsWith('[')) {
            updateStatus(`Fetching tour: ${input}...`);
            const resp = await fetch(`/api/tour?page=${encodeURIComponent(input)}`);
            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error || 'Failed to fetch');
            }
            data = await resp.json();
        } else {
            data = JSON.parse(input);
        }

        importTourData(data);
        modalHide('modal-import');

        // Show source wiki if loaded from wiki
        if (data._meta?.sourceWikiName) {
            updateStatus(`Imported from ${data._meta.sourceWikiName}`);
        }

    } catch (e) {
        updateStatus('Import error: ' + e.message, true);
    }
}

// ── Tour Validation ─────────────────────────────────────────────────────────
//
// INTEGRITY CHECK POLICY (see CAVEATS.md §0):
// Every data boundary (add, edit, import, export, preview) must validate
// hotspot completeness. When adding a new subtype or field:
//   1. Add to confirmAddHotspot()  — storage
//   2. Add to importTourData()     — import mapping
//   3. Add to exportTour()         — export mapping
//   4. Add to previewTour()        — preview mapping
//   5. Add to validateHotspot()    — integrity check (THIS FUNCTION)
//
// Missing any step = silent data loss. All warnings go to status bar + console.

/**
 * Validate a single hotspot object for missing required fields based on its type/subtype.
 * Returns an array of warning strings (empty if valid).
 */
function validateHotspot(hs, sceneTitle, index) {
    const w = [];
    const prefix = `[${sceneTitle} HS#${index + 1}]`;
    const subtype = hs.hotspotSubtype || (hs.type === 'scene' ? 'scene' : null);

    if (subtype === 'audio' || hs.hotspotSubtype === 'audio') {
        if (!hs.audioUrl) w.push(`${prefix} AUDIO hotspot missing audio URL`);
    }
    if (subtype === 'video' || hs.hotspotSubtype === 'video') {
        if (!hs.videoUrl) w.push(`${prefix} VIDEO hotspot missing video URL`);
    }
    if (hs.type === 'scene') {
        if (!hs.sceneId) w.push(`${prefix} SCENE link missing target scene ID`);
    }
    // General: any hotspot should at least have meaningful text
    if (!hs.text || hs.text === 'Click here') {
        // Only warn if it's not a deliberate placeholder
        if (hs.type !== 'scene' && !hs.hotspotSubtype) {
            // Plain info hotspot with no text is probably unfinished
        }
    }
    return w;
}

/**
 * Validate all scenes and hotspots for missing required fields.
 * Returns an array of warning strings, or empty array if all valid.
 * Also logs all warnings to console for debugging.
 */
function validateTour(quiet) {
    const warnings = [];
    for (const id of state.sceneOrder) {
        const scene = state.scenes[id];
        if (!scene.hotSpots) continue;
        for (let i = 0; i < scene.hotSpots.length; i++) {
            warnings.push(...validateHotspot(scene.hotSpots[i], scene.title, i));
        }
    }
    if (warnings.length > 0) {
        console.warn(`Tour validation: ${warnings.length} warning(s)`, warnings);
    }
    return warnings;
}

// ── Export helpers (cached resolution for instant radio toggling) ────────────

/** @type {Object<string, object>|null} */
let _exportResolvedScenes = null;

function buildExportJSON(scope) {
    const sceneIds = scope === 'current' && state.activeSceneId
        ? [state.activeSceneId]
        : state.sceneOrder;

    const scenes = {};
    for (const id of sceneIds) {
        const resolved = _exportResolvedScenes?.[id];
        if (!resolved) continue;
        scenes[id] = resolved;
    }

    const firstScene = scope === 'current' && state.activeSceneId
        ? state.activeSceneId
        : (state.activeSceneId || state.sceneOrder[0] || '');

    return {
        default: {
            firstScene: firstScene,
            author: state.defaultAuthor,
            sceneFadeDuration: state.sceneFadeDuration,
        },
        scenes: scenes,
    };
}

function updateExportTextarea() {
    if (!_exportResolvedScenes) return;
    const scope = document.querySelector('input[name="export-scope"]:checked')?.value || 'all';
    const tour = buildExportJSON(scope);
    $('modal-export-text').value = JSON.stringify(tour, null, 2);
}

async function exportTour() {
    // Validate before resolving — catch missing fields early
    const warnings = validateTour();
    if (warnings.length > 0) {
        updateStatus('⚠️ ' + warnings[0] + (warnings.length > 1 ? ` (+${warnings.length - 1} more)` : ''), true);
        console.warn('Tour validation warnings:', warnings);
    }

    updateStatus('Resolving images...');

    // Resolve all scene data once — stored in _exportResolvedScenes for radio toggling.
    // Use _original (true Commons URL) for portable exports. Unlike preview (which needs
    // same-origin cached paths), exported JSON is consumed elsewhere so it must use the
    // canonical Commons upload URL.
    _exportResolvedScenes = {};
    for (const id of state.sceneOrder) {
        const s = state.scenes[id];
        const panorama = s._original || await resolvePanoramaForPreview(s.panorama);
        _exportResolvedScenes[id] = {
            title: s.title,
            hfov: s.hfov,
            pitch: s.pitch,
            yaw: s.yaw,
            type: s.type || 'equirectangular',
            panorama: panorama,
            hotSpots: (s.hotSpots || []).map(hs => {
                const h = { pitch: hs.pitch, yaw: normalizeYaw(hs.yaw), type: hs.type || 'info', text: hs.text || '' };
                if (hs.type === 'scene' && hs.sceneId) h.sceneId = hs.sceneId;
                if (hs.URL) h.URL = hs.URL;
                if (hs.hotspotSubtype) h.hotspotSubtype = hs.hotspotSubtype;
                if (hs.audioUrl) h.audioUrl = hs.audioUrl;
                if (hs.videoUrl) h.videoUrl = hs.videoUrl;
                if (hs.iconStyle) h.iconStyle = hs.iconStyle;
                return h;
            }),
        };
    }

    // Pre-select "Entire project" radio
    const allRadio = document.querySelector('input[name="export-scope"][value="all"]');
    if (allRadio) allRadio.checked = true;

    // Populate textarea with current scope (all)
    updateExportTextarea();
    modalShow('modal-export');
}

function copyJSON() {
    const text = $('modal-export-text').value;
    navigator.clipboard.writeText(text).then(() => {
        updateStatus('✅ JSON copied to clipboard');
    }).catch(() => {
        updateStatus('Failed to copy — select and copy manually', true);
    });
}

function downloadJSON() {
    const text = $('modal-export-text').value;
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tour.json';
    a.click();
    URL.revokeObjectURL(url);
    updateStatus('✅ Tour downloaded as tour.json');
}

// ── Preview ──────────────────────────────────────────────────────────────────

/**
 * Resolve a single panorama value (File: ref or URL) to a cached image path.
 * Returns the path as-is if already resolved or not recognizable.
 */
async function resolvePanoramaForPreview(panorama) {
    if (!panorama || typeof panorama !== 'string') return panorama;
    // Already a /images/ cache path — use directly
    if (panorama.startsWith('/images/')) return panorama;
    // Direct URL — use directly
    if (panorama.startsWith('http://') || panorama.startsWith('https://')) {
        // If it's a Commons File page or Special:FilePath URL, resolve via server
        if (/commons\.wikimedia\.org\/wiki\/File:/i.test(panorama)) {
            const file = panorama.match(/File:([^\s\?#]+)/)?.[1];
            if (file) {
                const resp = await fetch(`/api/resolve?file=${encodeURIComponent(file)}`);
                if (resp.ok) { const d = await resp.json(); return d.original || d.url || panorama; }
            }
        }
        return panorama;
    }
    // File: reference — resolve via server
    const file = panorama.match(/^File:\s*(.+)$/i)?.[1];
    if (file) {
        const resp = await fetch(`/api/resolve?file=${encodeURIComponent(file)}`);
        if (resp.ok) { const d = await resp.json(); return d.original || d.url || panorama; }
    }
    return panorama;
}

async function previewTour() {
    const warnings = validateTour();
    if (warnings.length > 0) {
        updateStatus('⚠️ ' + warnings[0] + (warnings.length > 1 ? ` (+${warnings.length - 1} more)` : ''), true);
        console.warn('Tour validation warnings:', warnings);
    }

    updateStatus('Resolving images...');
    const resolvedScenes = {};

    // Resolve each scene's panorama through the server for same-origin cached paths.
    // (Unlike export, preview needs same-origin images to work in Pannellum.)
    for (const id of state.sceneOrder) {
        const scene = state.scenes[id];
        const panorama = await resolvePanoramaForPreview(scene.panorama);
        resolvedScenes[id] = {
            title: scene.title,
            hfov: scene.hfov,
            yaw: scene.yaw,
            pitch: scene.pitch,
            type: scene.type || 'equirectangular',
            panorama: panorama,
            hotSpots: (scene.hotSpots || []).map(hs => {
                const out = { pitch: hs.pitch, yaw: normalizeYaw(hs.yaw), type: hs.type || 'info', text: hs.text || '' };
                if (hs.type === 'scene' && hs.sceneId) out.sceneId = hs.sceneId;
                if (hs.URL) out.URL = hs.URL;
                if (hs.hotspotSubtype) out.hotspotSubtype = hs.hotspotSubtype;
                if (hs.audioUrl) out.audioUrl = hs.audioUrl;
                if (hs.videoUrl) out.videoUrl = hs.videoUrl;
                if (hs.iconStyle) out.iconStyle = hs.iconStyle;
                return out;
            }),
        };
    }

    const tour = {
        default: {
            firstScene: state.activeSceneId || state.sceneOrder[0] || '',
            author: state.defaultAuthor,
            sceneFadeDuration: state.sceneFadeDuration,
            autoLoad: true,
        },
        scenes: resolvedScenes,
    };

    try {
        localStorage.setItem('photosphere-preview-tour', JSON.stringify(tour));
        window.open('/tour_viewer.html#preview=local', '_blank');
        updateStatus('Preview opened in new tab');
    } catch(e) {
        updateStatus('Preview error: ' + e.message, true);
    }
}

// ── Property Binding ─────────────────────────────────────────────────────────

function setupPropertyBindings() {
    ['prop-title', 'prop-hfov', 'prop-yaw', 'prop-pitch'].forEach(propId => {
        $(propId).addEventListener('change', () => {
            const id = state.activeSceneId;
            if (!id || !state.scenes[id]) return;
            const scene = state.scenes[id];
            switch (propId) {
                case 'prop-title': scene.title = $(propId).value; break;
                case 'prop-hfov': scene.hfov = parseFloat($(propId).value) || 110; break;
                case 'prop-yaw': scene.yaw = parseFloat($(propId).value) || 0; break;
                case 'prop-pitch': scene.pitch = parseFloat($(propId).value) || 0; break;
            }
            renderSceneList();
            updateStatus('Properties updated');
        });
    });
    
    // Set default view button
    $('set-default-view-btn').addEventListener('click', handleSetDefaultView);
}

// ── Modal Helpers ────────────────────────────────────────────────────────────

function modalShow(id) { $(id).classList.add('show'); }
function modalHide(id) { $(id).classList.remove('show'); }

// Click outside modal to close
function setupModalDismiss() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                overlay.classList.remove('show');
            }
        });
        // Close button within each modal
        const closeBtn = overlay.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => overlay.classList.remove('show'));
        }
    });
}

// ── Coordinate Normalization ────────────────────────────────────────────────

/**
 * Normalize yaw to [-180, 180] per Pannellum JSON Schema.
 * Pannellum's viewer accepts out-of-range values (it wraps internally),
 * but strict spec compliance and other tooling expect [-180, 180].
 *
 * Normalizing at capture time prevents invalid data from ever being stored.
 */
function normalizeYaw(yaw) {
    if (typeof yaw !== 'number' || isNaN(yaw)) return yaw;
    return ((yaw % 360) + 540) % 360 - 180;
}

// ── Utilities ────────────────────────────────────────────────────────────────

function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escAttr(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function updateStatus(msg, isError) {
    statusMsg.textContent = msg;
    statusMsg.style.color = isError ? 'var(--accent)' : 'var(--muted)';
    console.log(isError ? 'ERROR: ' : '', msg);
}

// ── Init ─────────────────────────────────────────────────────────────────────

function init() {
    // Toolbar
    $('btn-export').addEventListener('click', exportTour);
    $('btn-import').addEventListener('click', () => modalShow('modal-import'));
    $('btn-preview').addEventListener('click', previewTour);

    // Add scene
    $('add-scene-btn').addEventListener('click', () => modalShow('modal-add-scene'));
    $('modal-confirm-add').addEventListener('click', async () => {
        const raw = $('modal-img-url').value;
        const title = $('modal-title').value.trim();
        const normalized = normalizeImageSource(raw);
        if (!normalized) { updateStatus('Please enter an image URL or Commons filename', true); return; }
        await addScene(normalized, title);
        modalHide('modal-add-scene');
        $('modal-img-url').value = '';
        $('modal-title').value = '';
    });
    $('modal-cancel-add').addEventListener('click', () => modalHide('modal-add-scene'));

    // Add hotspot button
    addHotspotBtn.addEventListener('click', addHotspot);

    // Add hotspot modal
    $('modal-hs-type').addEventListener('change', updateHsModalFields);
    $('modal-confirm-hs').addEventListener('click', confirmAddHotspot);
    $('modal-cancel-hs').addEventListener('click', () => modalHide('modal-add-hs'));
    $('hs-set-current-view-btn').addEventListener('click', handleHsSetCurrentView);

    // Import modal
    $('modal-confirm-import').addEventListener('click', importTour);
    $('modal-cancel-import').addEventListener('click', () => modalHide('modal-import'));

    // Export modal
    $('modal-copy-json').addEventListener('click', copyJSON);
    $('modal-download-json').addEventListener('click', downloadJSON);

    // Export scope radio buttons — regenerate JSON on toggle
    document.querySelectorAll('input[name="export-scope"]').forEach(radio => {
        radio.addEventListener('change', updateExportTextarea);
    });

    // Properties
    setupPropertyBindings();

    // Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'));
        }
    });

    // Click outside modal to close
    setupModalDismiss();

    updateStatus('Ready — add a scene to get started');

    // Auto-import from URL parameter ?page=...
    const urlParams = new URLSearchParams(window.location.search);
    const autoPage = urlParams.get('page');
    if (autoPage) {
        updateStatus(`Loading tour: ${autoPage}...`);
        fetch(`/api/tour?page=${encodeURIComponent(autoPage)}`)
            .then(r => {
                if (!r.ok) return r.json().then(e => { throw new Error(e.error); });
                return r.json();
            })
            .then(data => {
                importTourData(data);
                // Show source wiki in status
                const wikiName = data._meta?.sourceWikiName || 'Commons';
                updateStatus(`Loaded from ${wikiName}: ${autoPage}`);
                // Jump to a specific scene if ?scene=... is in the URL
                const targetScene = urlParams.get('scene');
                if (targetScene && state.scenes[targetScene]) {
                    selectScene(targetScene);
                }
            })
            .catch(e => updateStatus('Auto-import failed: ' + e.message, true));
    }
}

document.addEventListener('DOMContentLoaded', init);
