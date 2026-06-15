<?php
/**
 * tour_config.php — Wikimedia Photosphere Tour Config Resolver
 *
 * Phase 1 Prototype: Fetches a tour JSON definition from a Wikimedia Commons
 * wiki page, resolves File: references to actual image URLs, and returns a
 * Pannellum-compatible tour configuration.
 *
 * Usage:
 *   GET /tour_config.php?tour=User:Fuzheado/Panellum_Tour
 *
 * The `tour` parameter is the full wiki page title (with namespace prefix).
 * The page content should be a JSON object containing Pannellum tour config
 * with "default" and "scenes" keys.
 *
 * For each scene, the "panorama" field can be:
 *   - "File:Example.jpg"  → resolved to a Commons image URL
 *   - "https://..."        → used directly
 */

// ── Configuration ───────────────────────────────────────────────────────────

// Wikimedia Commons API endpoint
define('COMMONS_API', 'https://commons.wikimedia.org/w/api.php');

// Cache directory for resolved file URLs
define('CACHE_DIR', __DIR__ . '/cache');

// Cache TTL in seconds (1 hour)
define('CACHE_TTL', 3600);

// Maximum image width for WebGL compatibility (Pannellum recommended max: 4096)
define('MAX_IMAGE_WIDTH', 4096);

// User agent for Wikimedia API requests (required by policy)
define('USER_AGENT', 'PhotosphereTourPrototype/0.1 (https://panoviewer.toolforge.org/)');

// ── CORS & Content-Type ─────────────────────────────────────────────────────

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');

// Handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    http_response_code(204);
    exit;
}

// ── Input Validation ────────────────────────────────────────────────────────

if (!isset($_GET['tour']) || empty($_GET['tour'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required parameter: tour']);
    exit;
}

$tourPage = trim($_GET['tour']);

// Basic validation: must look like a wiki page title
if (!preg_match('/^[A-Za-z0-9_:\/\-\. ]+$/', $tourPage)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid tour page title']);
    exit;
}

// ── Cache Setup ─────────────────────────────────────────────────────────────

if (!is_dir(CACHE_DIR)) {
    mkdir(CACHE_DIR, 0755, true);
}

/**
 * Get a cached value or compute and cache it.
 */
function cache_get(string $key, callable $compute): mixed {
    $path = CACHE_DIR . '/' . md5($key) . '.json';
    if (file_exists($path) && (time() - filemtime($path)) < CACHE_TTL) {
        return json_decode(file_get_contents($path), true);
    }
    $value = $compute();
    file_put_contents($path, json_encode($value));
    return $value;
}

// ── Wiki Page Fetch ─────────────────────────────────────────────────────────

/**
 * Fetch raw page content from Commons wiki.
 */
function fetchWikiPage(string $title): string {
    $url = COMMONS_API . '?' . http_build_query([
        'action' => 'raw',
        'title'  => $title,
        'format' => 'json',  // not used for raw, but good practice
    ]);

    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => "User-Agent: " . USER_AGENT . "\r\n",
            'timeout' => 15,
        ],
    ]);

    $content = @file_get_contents($url, false, $context);

    if ($content === false) {
        throw new RuntimeException("Failed to fetch wiki page: $title");
    }

    return $content;
}

/**
 * Extract JSON from wiki page content.
 *
 * Handles two formats:
 *   1. Raw JSON as page content
 *   2. JSON wrapped in <syntaxhighlight lang="json">...</syntaxhighlight>
 */
function extractJSON(string $content): string {
    // Try syntaxhighlight wrapper first
    if (preg_match('/<syntaxhighlight[^>]*lang\s*=\s*["\']json["\'][^>]*>(.*?)<\/syntaxhighlight>/s', $content, $matches)) {
        $json = trim($matches[1]);
        // Decode HTML entities that MediaWiki may have inserted
        $json = html_entity_decode($json, ENT_QUOTES, 'UTF-8');
        return $json;
    }

    // Try <pre> wrapper
    if (preg_match('/<pre[^>]*>(.*?)<\/pre>/s', $content, $matches)) {
        return trim(html_entity_decode($matches[1], ENT_QUOTES, 'UTF-8'));
    }

    // Assume raw JSON
    return trim($content);
}

// ── File Resolution ─────────────────────────────────────────────────────────

/**
 * Resolve a File: reference to a usable image URL via Commons API.
 */
function resolveCommonsFile(string $filename): array {
    return cache_get("file:$filename", function() use ($filename) {
        $url = COMMONS_API . '?' . http_build_query([
            'action'    => 'query',
            'titles'    => $filename,
            'prop'      => 'imageinfo',
            'iiprop'    => 'url|size|mime',
            'iiurlwidth' => MAX_IMAGE_WIDTH,
            'format'    => 'json',
        ]);

        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'header' => "User-Agent: " . USER_AGENT . "\r\n",
                'timeout' => 10,
            ],
        ]);

        $response = @file_get_contents($url, false, $context);
        if ($response === false) {
            throw new RuntimeException("Failed to resolve file: $filename");
        }

        $data = json_decode($response, true);
        if (!isset($data['query']['pages'])) {
            throw new RuntimeException("Invalid API response for: $filename");
        }

        $pages = $data['query']['pages'];
        $page = reset($pages);

        if (isset($page['missing']) || isset($page['invalid'])) {
            throw new RuntimeException("File not found: $filename");
        }

        $imageInfo = $page['imageinfo'][0] ?? null;
        if (!$imageInfo) {
            throw new RuntimeException("No image info for: $filename");
        }

        // Use thumbnail URL if available and image is larger than max width,
        // otherwise use the full URL
        $fullUrl = $imageInfo['url'];
        $thumbUrl = $imageInfo['thumburl'] ?? null;
        $width = $imageInfo['width'] ?? 0;

        $url = ($thumbUrl && $width > MAX_IMAGE_WIDTH) ? $thumbUrl : $fullUrl;

        return [
            'url'   => $url,
            'width' => $width,
        ];
    });
}

/**
 * Resolve a panorama value to a URL.
 *
 * Handles:
 *   - "File:Example.jpg" → Commons API resolution
 *   - "https://..."       → direct URL
 *   - "/path/..."         → relative path (passed through)
 */
function resolvePanorama(string $panorama): string {
    // Check for File: prefix
    if (preg_match('/^File:\s*(.+)$/i', $panorama, $matches)) {
        $filename = 'File:' . trim($matches[1]);
        $result = resolveCommonsFile($filename);
        return $result['url'];
    }

    // Direct URL or relative path — return as-is
    return $panorama;
}

// ── Tour JSON Validation ────────────────────────────────────────────────────

/**
 * Basic structural validation of the tour JSON.
 */
function validateTourJSON(array $tour): ?string {
    if (!isset($tour['default']) || !is_array($tour['default'])) {
        return 'Missing or invalid "default" section';
    }
    if (!isset($tour['default']['firstScene'])) {
        return 'Missing "firstScene" in default section';
    }
    if (!isset($tour['scenes']) || !is_array($tour['scenes'])) {
        return 'Missing or invalid "scenes" section';
    }
    if (empty($tour['scenes'])) {
        return 'No scenes defined';
    }
    foreach ($tour['scenes'] as $sceneId => $scene) {
        if (!isset($scene['panorama']) || empty($scene['panorama'])) {
            return "Scene '$sceneId' is missing 'panorama' field";
        }
    }
    return null; // valid
}

// ── Main Logic ──────────────────────────────────────────────────────────────

try {
    // 1. Fetch tour JSON from wiki page
    $rawContent = fetchWikiPage($tourPage);
    $jsonString = extractJSON($rawContent);
    $tour = json_decode($jsonString, true);

    if ($tour === null) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Invalid JSON in tour page',
            'details' => json_last_error_msg(),
        ]);
        exit;
    }

    // 2. Validate structure
    $validationError = validateTourJSON($tour);
    if ($validationError !== null) {
        http_response_code(400);
        echo json_encode(['error' => $validationError]);
        exit;
    }

    // 3. Resolve File: references in each scene
    $resolvedCount = 0;
    $errors = [];
    foreach ($tour['scenes'] as $sceneId => &$scene) {
        try {
            $scene['panorama'] = resolvePanorama($scene['panorama']);
            $resolvedCount++;
        } catch (Exception $e) {
            $errors[] = "Scene '$sceneId': " . $e->getMessage();
        }
    }
    unset($scene); // break reference

    // 4. Add metadata
    $tour['_meta'] = [
        'source' => $tourPage,
        'resolvedAt' => date('c'),
        'scenesResolved' => $resolvedCount,
        'totalScenes' => count($tour['scenes']),
    ];
    if (!empty($errors)) {
        $tour['_meta']['warnings'] = $errors;
    }

    // 5. Output resolved tour JSON
    echo json_encode($tour, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => $e->getMessage(),
    ]);
}
