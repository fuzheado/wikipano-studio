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

// ── Scene Management ─────────────────────────────────────────────────────────

function addScene(imageUrl, title) {
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
        return `<li class="${active}" onclick="selectScene('${id}')">
            <span class="thumb" style="background-image:url(${escAttr(thumb)})"></span>
            <span class="name">${escHtml(scene.title)}</span>
            ${hotspotCount > 0 ? `<span class="badge">${hotspotCount}</span>` : ''}
            <button class="delete-btn" onclick="event.stopPropagation();deleteScene('${id}')" title="Delete">×</button>
        </li>`;
    }).join('');
}

function getSceneThumbnail(scene) {
    // Use server-provided thumbnail if available
    if (scene._thumb) return scene._thumb;
    const pano = scene.panorama || '';
    // Commons cached paths — use same path (browser will scale with CSS)
    if (pano.startsWith('/images/')) return pano;
    // Direct URLs
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

async function loadSceneIntoViewport(id) {
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
        hfov: scene.hfov || 110,
        yaw: scene.yaw || 0,
        pitch: scene.pitch || 0,
        crossOrigin: 'anonymous',
    };

    state.pannellumViewer = pannellum.viewer('viewport', config);

    state.pannellumViewer.on('load', () => {
        updateStatus(`Loaded: ${scene.title}`);
        // Re-apply hotspots
        if (scene.hotSpots) {
            scene.hotSpots.forEach(hs => {
                const hsClass = 'studio-hotspot ' + (hs.type === 'scene' ? 'studio-scene-hs' : 'studio-info-hs');
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

    // Click — capture coordinates
    state.pannellumViewer.on('mousedown', (e) => {
        const coords = state.pannellumViewer.mouseEventToCoords(e);
        if (coords) {
            state.capturedCoords = { pitch: coords[0], yaw: coords[1] };
            coordYaw.textContent = coords[1].toFixed(2);
            coordPitch.textContent = coords[0].toFixed(2);
            coordDisplay.classList.add('visible');
            addHotspotBtn.style.display = 'block';
            hsCoordPreview.textContent =
                `Yaw: ${coords[1].toFixed(2)}°  Pitch: ${coords[0].toFixed(2)}°`;
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
        const typeClass = hs.type === 'scene' ? 'scene' : 'info';
        const typeLabel = hs.type === 'scene' ? 'SCENE LINK' : 'INFO';
        let detail = '';
        if (hs.type === 'scene') {
            const targetScene = state.scenes[hs.sceneId];
            detail = `→ ${targetScene ? escHtml(targetScene.title) : hs.sceneId || '(none)'}`;
        } else if (hs.URL) {
            detail = `🔗 ${escHtml(hs.URL.substring(0, 60))}`;
        }
        const hsId = `${id}_${idx}`;
        return `<div class="hotspot-card"
            onmouseenter="lookAtHotspot(${hs.yaw}, ${hs.pitch})"
            onmouseleave="stopLookAt()">
            <div class="hs-header">
                <span class="hs-type ${typeClass}">${typeLabel}</span>
                <span class="hs-text">${escHtml(hs.text || '(no text)')}</span>
                <button class="hs-edit" onclick="editHotspot('${id}', ${idx})" title="Edit">✎</button>
                <button class="hs-delete" onclick="deleteHotspot('${id}', ${idx})" title="Delete">×</button>
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

function stopLookAt() {
    // No-op — viewport stays where user panned it
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
    $('modal-hs-type').value = hs.type || 'info';

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

    // Refresh viewer hotspots
    if (state.activeSceneId === sceneId) {
        loadSceneIntoViewport(sceneId);
    }
    renderHotspotList();
    renderSceneList();
    updateStatus('Hotspot deleted');
}

function confirmAddHotspot() {
    const type = $('modal-hs-type').value;
    const text = $('modal-hs-text').value.trim();
    const sceneId = state.activeSceneId;
    if (!sceneId) return;

    const hs = {
        pitch: state.capturedCoords.pitch,
        yaw: state.capturedCoords.yaw,
        type: type,
        text: text || 'Click here',
    };

    if (type === 'scene') {
        hs.sceneId = $('modal-hs-scene').value;
        if (!hs.sceneId) {
            updateStatus('Please select a target scene', true);
            return;
        }
    } else if (type === 'info') {
        const url = $('modal-hs-url').value.trim();
        if (url) hs.URL = url;
    }

    // Add or update
    if (state.editingHotspotIndex !== null) {
        state.scenes[sceneId].hotSpots[state.editingHotspotIndex] = hs;
        updateStatus(`Hotspot updated: ${hs.text}`);
    } else {
        state.scenes[sceneId].hotSpots.push(hs);
        updateStatus(`Hotspot added: ${hs.text}`);
    }

    // Reload viewer to reflect changes (handles UI refresh on load event)
    if (state.pannellumViewer) {
        loadSceneIntoViewport(sceneId);
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

    renderSceneList();
    if (state.activeSceneId) {
        loadSceneIntoViewport(state.activeSceneId);
        renderProperties();
    }

    updateStatus(`Imported: ${state.sceneOrder.length} scenes`);
}

async function importTour() {
    const input = $('modal-import-text').value.trim();
    if (!input) return;

    try {
        let data;

        // Check if it's a wiki page title (no JSON brackets)
        if (!input.startsWith('{') && !input.startsWith('[')) {
            updateStatus('Fetching tour from wiki...');
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

    } catch (e) {
        updateStatus('Import error: ' + e.message, true);
    }
}

function exportTour() {
    const scenes = {};
    for (const id of state.sceneOrder) {
        const s = state.scenes[id];
        scenes[id] = {
            title: s.title,
            hfov: s.hfov,
            pitch: s.pitch,
            yaw: s.yaw,
            type: s.type,
            panorama: s.panorama,
            hotSpots: s.hotSpots.map(hs => {
                const h = { pitch: hs.pitch, yaw: hs.yaw, type: hs.type, text: hs.text };
                if (hs.type === 'scene' && hs.sceneId) h.sceneId = hs.sceneId;
                if (hs.URL) h.URL = hs.URL;
                return h;
            }),
        };
    }

    const tour = {
        default: {
            firstScene: state.activeSceneId || state.sceneOrder[0] || '',
            author: state.defaultAuthor,
            sceneFadeDuration: state.sceneFadeDuration,
        },
        scenes: scenes,
    };

    const json = JSON.stringify(tour, null, 2);
    $('modal-export-text').value = json;
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

function previewTour() {
    // Build tour JSON
    const scenes = {};
    for (const id of state.sceneOrder) {
        scenes[id] = { ...state.scenes[id] };
    }
    const tour = {
        default: {
            firstScene: state.activeSceneId || state.sceneOrder[0] || '',
            author: state.defaultAuthor,
            sceneFadeDuration: state.sceneFadeDuration,
            autoLoad: true,
        },
        scenes: scenes,
    };

    // Store in localStorage (persistent, shared across all tabs)
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
    $('modal-confirm-add').addEventListener('click', () => {
        const url = $('modal-img-url').value.trim();
        const title = $('modal-title').value.trim();
        if (!url) { updateStatus('Please enter an image URL or Commons filename', true); return; }
        addScene(url, title);
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

    // Import modal
    $('modal-confirm-import').addEventListener('click', importTour);
    $('modal-cancel-import').addEventListener('click', () => modalHide('modal-import'));

    // Export modal
    $('modal-copy-json').addEventListener('click', copyJSON);
    $('modal-download-json').addEventListener('click', downloadJSON);

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
        updateStatus(`Loading tour from Commons: ${autoPage}...`);
        fetch(`/api/tour?page=${encodeURIComponent(autoPage)}`)
            .then(r => {
                if (!r.ok) return r.json().then(e => { throw new Error(e.error); });
                return r.json();
            })
            .then(data => importTourData(data))
            .catch(e => updateStatus('Auto-import failed: ' + e.message, true));
    }
}

document.addEventListener('DOMContentLoaded', init);
