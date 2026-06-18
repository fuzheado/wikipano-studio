/**
 * tour_server.mjs — Phase 1 Prototype Server
 *
 * Serves:
 *   - Static files (tour_viewer.html, cached images)
 *   - GET /api/tour?page=User:Fuzheado/Panellum_Tour → resolved Pannellum JSON
 *
 * Images are downloaded from Commons, cached locally, and served from /images/.
 * This avoids CORS issues and provides reliable image loading.
 *
 * Run: node tour_server.mjs
 * Then open: http://localhost:8765/tour_viewer.html
 */

import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8765;

// ── Configuration ───────────────────────────────────────────────────────────

const COMMONS_API   = 'https://commons.wikimedia.org/w/api.php';
const COMMONS_INDEX = 'https://commons.wikimedia.org/w/index.php';
const CACHE_DIR     = join(__dirname, 'cache');
const IMG_CACHE_DIR = join(__dirname, 'images');
const CACHE_TTL     = 3600 * 1000; // 1 hour
const MAX_IMG_WIDTH = 4096;
const USER_AGENT    = 'PhotosphereTour/0.1 (Wikimedia Photosphere Tours; https://github.com/.../photospheres)';

// ── MIME map ────────────────────────────────────────────────────────────────

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.mjs':  'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg':  'image/svg+xml',
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(res, status, data) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(data, null, 2));
}

async function serveStatic(res, pathname) {
    const filePath = join(__dirname, pathname === '/' ? 'tour_viewer.html' : pathname);
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403); res.end('Forbidden'); return;
    }
    try {
        const content = await readFile(filePath);
        const ext = '.' + filePath.split('.').pop();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(content);
    } catch {
        res.writeHead(404); res.end('Not found');
    }
}

// ── Wiki Fetch ──────────────────────────────────────────────────────────────

async function fetchWikiPage(title) {
    const url = `${COMMONS_INDEX}?${new URLSearchParams({ title, action: 'raw' })}`;
    const resp = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`Failed to fetch wiki page "${title}": HTTP ${resp.status}`);
    return await resp.text();
}

// ── TOML Parser ─────────────────────────────────────────────────────────────

function parseTOMLValue(val) {
    val = val.replace(/,\s*$/, '').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        return val.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
    }
    if (val === 'true') return true;
    if (val === 'false') return false;
    const numStr = val.replace(/_/g, '');
    if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(numStr)) {
        return numStr.includes('.') || numStr.includes('e') || numStr.includes('E')
            ? parseFloat(numStr) : parseInt(numStr, 10);
    }
    return val;
}

function parseTOML(toml) {
    const result = {};
    let currentPath = [];

    for (const rawLine of toml.split('\n')) {
        const line = rawLine.replace(/\s+#.*$/, '').trim();
        if (!line) continue;

        // [section] or [section.sub]
        let m = line.match(/^\[([^\]]+)\]$/);
        if (m) {
            currentPath = m[1].split('.').map(s => s.trim().replace(/^"|"$/g, ''));
            let obj = result;
            for (const key of currentPath) {
                if (!(key in obj)) obj[key] = {};
                obj = obj[key];
            }
            continue;
        }

        // [[array.section]]
        m = line.match(/^\[\[([^\]]+)\]\]$/);
        if (m) {
            currentPath = m[1].split('.').map(s => s.trim().replace(/^"|"$/g, ''));
            const arrKey = currentPath[currentPath.length - 1];
            const parentPath = currentPath.slice(0, -1);
            let obj = result;
            for (const key of parentPath) {
                if (!(key in obj)) obj[key] = {};
                obj = obj[key];
            }
            if (!Array.isArray(obj[arrKey])) obj[arrKey] = [];
            obj[arrKey].push({});
            continue;
        }

        // key = value
        m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/s);
        if (m) {
            const key = m[1];
            const val = parseTOMLValue(m[2].trim());
            let obj = result;
            for (const seg of currentPath) {
                obj = Array.isArray(obj[seg]) ? obj[seg][obj[seg].length - 1] : (obj[seg] ??= {});
            }
            obj[key] = val;
        }
    }
    return result;
}

function extractTourDefinition(content) {
    let inner = content;
    const nw = content.match(/<nowiki>(.*?)<\/nowiki>/s);
    if (nw) inner = nw[1].trim();
    const pre = inner.match(/<pre[^>]*>(.*?)<\/pre>/s);
    if (pre) inner = pre[1].trim();
    const sh = inner.match(/<syntaxhighlight[^>]*lang\s*=\s*["']json["'][^>]*>(.*?)<\/syntaxhighlight>/s);
    if (sh) inner = sh[1].trim().replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"');

    try { return { format: 'json', data: JSON.parse(inner) }; } catch {}
    if (/^\s*(\w+\s*=|\[)/m.test(inner)) return { format: 'toml', data: parseTOML(inner) };
    inner = inner.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"');
    try { return { format: 'json', data: JSON.parse(inner) }; } catch {}
    throw new Error('Could not parse tour definition as JSON or TOML');
}

// ── Commons File Resolution ─────────────────────────────────────────────────

async function jsonCacheGet(key, compute) {
    if (!existsSync(CACHE_DIR)) await mkdir(CACHE_DIR, { recursive: true });
    const cachePath = join(CACHE_DIR, Buffer.from(key).toString('base64url') + '.json');
    try {
        const stat = await (await import('node:fs/promises')).stat(cachePath);
        if (Date.now() - stat.mtimeMs < CACHE_TTL) {
            const cached = JSON.parse(await readFile(cachePath, 'utf-8'));
            return cached;
        }
    } catch {}
    const value = await compute();
    await writeFile(cachePath, JSON.stringify(value));
    return value;
}

async function resolveCommonsFile(filename) {
    return jsonCacheGet(`file:${filename}`, async () => {
        // Request both thumburl AND url in same call — when thumburl is present,
        // ii.url correctly returns the original upload URL (not the thumb)
        const resp = await fetch(`${COMMONS_API}?${new URLSearchParams({
            action: 'query', titles: filename, prop: 'imageinfo',
            iiprop: 'url|size|thumburl', format: 'json',
        })}`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(10000) });
        if (!resp.ok) throw new Error(`Commons API error for ${filename}`);
        const data = await resp.json();
        const page = Object.values(data?.query?.pages || {})[0];
        if (page?.missing || page?.invalid) throw new Error(`File not found: ${filename}`);
        const ii = page?.imageinfo?.[0];
        if (!ii) throw new Error(`No image info for ${filename}`);
        return {
            // For the studio's local cache: use thumburl if available, otherwise url
            url: ii.thumburl || ii.url,
            // For export/preview: always use the direct original upload URL
            original: ii.url,
            width: ii.width || 0,
        };
    });
}

/**
 * Download an image and cache it locally in /images/.
 * Returns a simple path like /images/abc123.jpg.
 */
async function cacheImage(sourceUrl) {
    const hash = createHash('sha256').update(sourceUrl).digest('hex').substring(0, 16);
    const extMatch = sourceUrl.match(/\.(jpg|jpeg|png|webp)(\?|$)/i);
    const ext = extMatch ? extMatch[1] : 'jpg';
    const filename = `${hash}.${ext}`;
    const filepath = join(IMG_CACHE_DIR, filename);

    if (!existsSync(IMG_CACHE_DIR)) await mkdir(IMG_CACHE_DIR, { recursive: true });

    // Check cache freshness
    if (existsSync(filepath)) {
        const stat = await (await import('node:fs/promises')).stat(filepath);
        if (Date.now() - stat.mtimeMs < CACHE_TTL) {
            return {
                url: `/images/${filename}`,
                thumb: makeThumbUrl(sourceUrl),
                original: sourceUrl,
            };
        }
    }

    // Download
    const resp = await fetch(sourceUrl, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) throw new Error(`Failed to download image: HTTP ${resp.status}`);
    await writeFile(filepath, Buffer.from(await resp.arrayBuffer()));
    return {
        url: `/images/${filename}`,
        thumb: makeThumbUrl(sourceUrl),
        original: sourceUrl,
    };
}

function makeThumbUrl(url) {
    // Already a thumbnail URL — just swap size to 200px
    // e.g. .../thumb/a/bc/File.jpg/2000px-File.jpg → .../thumb/a/bc/File.jpg/200px-File.jpg
    // e.g. .../thumb/a/bc/File.jpg/3840px-File.jpg → .../thumb/a/bc/File.jpg/200px-File.jpg
    const thumbMatch = url.match(/^(.+)\/(\d+px-)(.+)$/);
    if (thumbMatch) return `${thumbMatch[1]}/200px-${thumbMatch[3]}`;

    // Original URL (no /thumb/ segment) — construct thumb path
    // e.g. .../commons/a/bc/File.jpg → .../commons/thumb/a/bc/File.jpg/200px-File.jpg
    if (url.includes('upload.wikimedia.org/wikipedia/commons/')) {
        const parts = url.split('/');
        const filename = parts.pop();
        const base = parts.join('/');
        const thumbBase = base.replace('/wikipedia/commons/', '/wikipedia/commons/thumb/');
        return `${thumbBase}/200px-${filename}`;
    }
    // For non-Commons URLs, return the original
    return url;
}

async function resolvePanorama(panorama) {
    const fileMatch = panorama.match(/^File:\s*(.+)$/i);
    if (fileMatch) {
        const result = await resolveCommonsFile('File:' + fileMatch[1].trim());
        return cacheImage(result.url);
    }
    if (panorama.startsWith('http://') || panorama.startsWith('https://')) {
        return cacheImage(panorama);
    }
    return { url: panorama, thumb: panorama, original: panorama };
}

// ── Validation ──────────────────────────────────────────────────────────────

function validateTourJSON(tour) {
    if (!tour?.default || typeof tour.default !== 'object')
        return 'Missing or invalid "default" section';
    if (!tour.default.firstScene)
        return 'Missing "firstScene" in default section';
    if (!tour?.scenes || typeof tour.scenes !== 'object' || Object.keys(tour.scenes).length === 0)
        return 'Missing or invalid "scenes" section';
    for (const [id, scene] of Object.entries(tour.scenes)) {
        if (!scene.panorama || typeof scene.panorama !== 'string')
            return `Scene "${id}" is missing "panorama" field`;
    }
    return null;
}

// ── Tour API Handler ────────────────────────────────────────────────────────

async function handleTourAPI(res, pageTitle) {
    try {
        const rawContent = await fetchWikiPage(pageTitle);
        const { format, data: tour } = extractTourDefinition(rawContent);

        const validationError = validateTourJSON(tour);
        if (validationError) return jsonResponse(res, 400, { error: validationError });

        let resolvedCount = 0;
        const errors = [];

        for (const [sceneId, scene] of Object.entries(tour.scenes)) {
            try {
                const resolved = await resolvePanorama(scene.panorama);
                scene.panorama = resolved.url;
                scene._thumb = resolved.thumb || resolved.url;
                scene._original = resolved.original || resolved.url;
                resolvedCount++;
            } catch (e) {
                errors.push(`Scene "${sceneId}": ${e.message}`);
            }
        }

        tour._meta = {
            source: pageTitle,
            sourceFormat: format,
            resolvedAt: new Date().toISOString(),
            scenesResolved: resolvedCount,
            totalScenes: Object.keys(tour.scenes).length,
        };
        if (errors.length > 0) tour._meta.warnings = errors;

        jsonResponse(res, 200, tour);
    } catch (e) {
        jsonResponse(res, 500, { error: e.message });
    }
}

// ── HTTP Server ─────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;

    // API: /api/tour?page=...
    if (pathname === '/api/tour' && req.method === 'GET') {
        const pageTitle = url.searchParams.get('page');
        if (!pageTitle) return jsonResponse(res, 400, { error: 'Missing required parameter: page' });
        if (!/^[A-Za-z0-9_:\/\-\. ]+$/.test(pageTitle))
            return jsonResponse(res, 400, { error: 'Invalid page title' });
        return handleTourAPI(res, pageTitle);
    }

    // API: /api/resolve?file=... — resolve a single Commons file to image URL
    if (pathname === '/api/resolve' && req.method === 'GET') {
        const file = url.searchParams.get('file');
        if (!file) return jsonResponse(res, 400, { error: 'Missing required parameter: file' });
        try {
            const result = await resolveCommonsFile('File:' + file);
            // Cache the thumb (from result.url) locally; use original for original field
            const cached = await cacheImage(result.url);
            cached.original = result.original; // always store the direct original URL
            jsonResponse(res, 200, cached);
        } catch (e) {
            jsonResponse(res, 404, { error: e.message });
        }
        return;
    }

    // API: /api/resolve-url?url=... — cache and resolve a direct Commons URL
    if (pathname === '/api/resolve-url' && req.method === 'GET') {
        const imageUrl = url.searchParams.get('url');
        if (!imageUrl) return jsonResponse(res, 400, { error: 'Missing required parameter: url' });
        try {
            const cached = await cacheImage(imageUrl);
            // Return flat: url (cached local path), thumb, original (source URL)
            jsonResponse(res, 200, cached);
        } catch (e) {
            jsonResponse(res, 404, { error: e.message });
        }
        return;
    }

    // API: POST /api/preview — store tour JSON for preview (returns short key)
    // API: GET /api/preview/:key — retrieve stored preview
    if (pathname === '/api/preview' && req.method === 'POST') {
        let body = '';
        for await (const chunk of req) body += chunk;
        try {
            const key = createHash('sha256').update(body + Date.now()).digest('hex').substring(0, 12);
            const previewDir = join(CACHE_DIR, 'previews');
            if (!existsSync(previewDir)) await mkdir(previewDir, { recursive: true });
            await writeFile(join(previewDir, key + '.json'), body);
            jsonResponse(res, 200, { key });
        } catch (e) {
            jsonResponse(res, 500, { error: e.message });
        }
        return;
    }
    const previewMatch = pathname.match(/^\/api\/preview\/([a-f0-9]+)$/);
    if (previewMatch && req.method === 'GET') {
        try {
            const previewFile = join(CACHE_DIR, 'previews', previewMatch[1] + '.json');
            const data = await readFile(previewFile, 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(data);
        } catch {
            jsonResponse(res, 404, { error: 'Preview not found or expired' });
        }
        return;
    }

    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        });
        res.end();
        return;
    }

    // Static files (includes /images/*)
    await serveStatic(res, pathname);
});

server.listen(PORT, () => {
    console.log(`\n🔭  Wikimedia Photosphere Tour — Phase 1 Prototype`);
    console.log(`    Viewer: http://localhost:${PORT}/tour_viewer.html`);
    console.log(`    API:    http://localhost:${PORT}/api/tour?page=User:Fuzheado/Panellum_Tour`);
    console.log(`    Images: http://localhost:${PORT}/images/ (cached from Commons)\n`);
});
